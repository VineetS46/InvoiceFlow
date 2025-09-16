const { app } = require('@azure/functions');
const { BlobServiceClient } = require("@azure/storage-blob");
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const admin = require('../helpers/firebaseAdmin');
const db = admin.firestore();
const pdfParse = require('pdf-parse');
const Groq = require('groq-sdk'); // Import the official Groq SDK

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-workspace-id'
};

app.http('uploadAndProcessInvoice', {
    methods: ['POST','OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        const decodedToken = await validateFirebaseToken(request);
        if (!decodedToken) return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized." } };
        
        const userId = decodedToken.uid;
        const workspaceId = request.headers.get('x-workspace-id');
        if (!workspaceId) {
            return { status: 400, headers: corsHeaders, jsonBody: { error: "Workspace ID is missing." } };
        }

        try {
            const formData = await request.formData();
            const file = formData.get('invoiceFile');
            if (!file) return { status: 400, headers: corsHeaders, jsonBody: { error: "No file uploaded." } };

            const fileBuffer = Buffer.from(await file.arrayBuffer());
            const pdfData = await pdfParse(fileBuffer);
            const pdfText = pdfData.text;

            const workspaceDocRef = db.collection('workspaces').doc(workspaceId);
            const workspaceDoc = await workspaceDocRef.get();
            if (!workspaceDoc.exists) {
                throw new Error(`Workspace with ID ${workspaceId} not found.`);
            }
            const userCategoryNames = (workspaceDoc.data().categories || []).map(cat => cat.name);

            // --- THIS IS THE DEFINITIVE GROQ IMPLEMENTATION ---
            // 1. Initialize the Groq client with your API key from environment variables
            const groq = new Groq({
                apiKey: process.env.GROQ_API_KEY
            });

            // 2. The definitive, V3.0 Master Prompt
            const masterPrompt = `
You are a world-class, highly precise invoice processing API. Your task is to analyze the raw text from a financial document and convert it into a structured JSON object.

**Instructions:**
1.  **Identify Primary Invoice:** Analyze the entire document. Find the single main "Tax Invoice" or the document representing the primary purchase. All subsequent tasks must be performed on data from this single, most important document.

2.  **Validity Check:** Determine if this primary document is a valid financial invoice, bill, or receipt. Return a boolean field in your JSON called \`isInvoice\`. If \`isInvoice\` is \`false\`, you do not need to extract any other fields.

3.  **Core Field Extraction:** If \`isInvoice\` is \`true\`, extract the following fields. Financial values must be numbers. Dates must be in YYYY-MM-DD format. Use null for missing values.
    *   \`invoiceId\`: The official invoice number.
    *   \`vendorName\`: The seller's name.
    *   \`invoiceDate\`: The date the invoice was issued.
    *   \`dueDate\`: The payment due date.
    *   \`invoiceTotal\`: The final, grand total amount (equivalent to amountDue).
    *   \`amountPaid\`: The amount already paid. If not specified, assume 0 for invoices and assume it equals invoiceTotal for receipts.
    *   \`lineItems\`: An array of objects for each item purchased, each with a \`description\` and \`amount\`.

4.  **Personalized Categorization:** Based on the \`vendorName\` and \`lineItems\`, choose the single best category for this invoice from the user's PERSONALIZED list provided below. Add this to your JSON with the key \`category\`.

5.  **Definitive Status Assignment:** Now, determine the invoice's \`status\` using the following precise logic. Today's date is **${new Date().toISOString().split('T')[0]}**.
    *   If the document is explicitly a "Receipt" or if \`amountPaid\` is greater than or equal to \`invoiceTotal\`, the status MUST be \`Paid\`.
    *   Otherwise, if today's date is less than or equal to the \`dueDate\`, the status MUST be \`Pending\`.
    *   Otherwise (if today's date is after the \`dueDate\` and the amount has not been fully paid), the status MUST be \`Overdue\`.

**Personalized Category List:**
[${userCategoryNames.join(', ')}]

**Final Output Requirement:**
You MUST respond with ONLY a single, minified, valid JSON object containing all the required fields. Do not include any explanations, markdown, or other text outside of the JSON object.

**Invoice Text to Process:**
"""
${pdfText}
"""
`;

            // 3. Call the Groq API
            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: "user", content: masterPrompt }],
                model: "llama-3.3-70b-versatile", // Use a powerful and available Groq model
                response_format: { type: "json_object" },
                temperature: 0.1,            });

            const aiResponse = chatCompletion.choices[0]?.message?.content;
            if (!aiResponse) {
                throw new Error("Groq AI failed to return a valid response.");
            }
            // --- END OF GROQ IMPLEMENTATION ---

            const parsedData = JSON.parse(aiResponse);

            if (parsedData.isInvoice === false) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "The uploaded document does not appear to be a valid invoice." } };
            }
            
            const { vendorName, invoiceId, invoiceDate, invoiceTotal, category, status } = parsedData;

            const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_CONNECTION_STRING);
            const container = cosmosClient.database("InvoiceDB").container("Invoices");
            
            // ... (Duplicate check logic is correct)
            
            let assignedCategory = category;
            if (!userCategoryNames.includes(assignedCategory)) {
                assignedCategory = "Uncategorized";
            }

            const newItem = {
                id: uuidv4(),
                docType: "invoice",
                workspaceId,
                uploadedBy: userId,
                invoiceId: invoiceId || null,
                fingerprint: !invoiceId ? `${vendorName}-${invoiceDate}-${invoiceTotal}` : null,
                fileName: `${uuidv4()}.${file.name.split('.').pop()}`,
                status: status || "pending",
                category: assignedCategory,
                vendorName: vendorName || "N/A",
                customerName: parsedData.customerName || decodedToken.name || "N/A",
                invoiceDate: parsedData.invoiceDate ? new Date(parsedData.invoiceDate) : new Date(),
                dueDate: parsedData.dueDate ? new Date(parsedData.dueDate) : null,
                invoiceTotal: typeof parsedData.invoiceTotal === 'number' ? parsedData.invoiceTotal : 0,
                subTotal: typeof parsedData.subTotal === 'number' ? parsedData.subTotal : null,
                totalTax: typeof parsedData.totalTax === 'number' ? parsedData.totalTax : null,
                amountPaid: typeof parsedData.amountPaid === 'number' ? parsedData.amountPaid : null,
                lineItems: parsedData.lineItems || [],
                uploadedAt: new Date(),
                currency: parsedData.currency || 'INR'
            };

            const { resource: createdItem } = await container.items.create(newItem);
            return { status: 201, headers: corsHeaders, jsonBody: createdItem };

        } catch (err) {
            context.error("Error in uploadAndProcessInvoice:", err);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An internal server error occurred." } };
        }
    }
});