const { app } = require('@azure/functions');
const { BlobServiceClient } = require("@azure/storage-blob");
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const admin = require('../helpers/firebaseAdmin');
const db = admin.firestore();
const pdfParse = require('pdf-parse');
const Groq = require('groq-sdk'); // Use the correct Groq SDK

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

            // --- THIS IS THE CORRECTED GROQ IMPLEMENTATION ---
            const groq = new Groq({
                apiKey: process.env.GROQ_API_KEY
            });
            
           const masterPrompt = `
You are a world-class, highly precise financial document processing API. Your task is to analyze the raw text from a document and convert it into a structured JSON object with an exceptionally high degree of accuracy.

**Instructions:**

1.  **Identify Primary Financial Document:** Analyze the entire document. Find the single main "Tax Invoice", "Receipt", or "Bill of Sale" that represents the primary transaction. All subsequent tasks must be based on data from this single, most important document.

2.  **Validity Check:** Determine if this primary document is a valid financial record (invoice, bill, or receipt). Return a boolean field in your JSON called \`isInvoice\`. If it's \`false\`, you must return only \`{ "isInvoice": false }\` and stop processing.

3.  **Core Field Extraction:** If \`isInvoice\` is \`true\`, meticulously extract the following fields. Financial values must be numbers. Dates must be in YYYY-MM-DD format. Use null for any field that is not found.
    *   \`invoiceId\`: The official invoice, bill, or receipt number.
    *   \`vendorName\`: The seller's name. **(Improvement)** If the item was "Sold by" one company but "Ordered through" a marketplace like Amazon or Flipkart, prefer the marketplace name.
    *   \`invoiceDate\`: The date the invoice was issued.
    *   \`dueDate\`: The payment due date.
    *   \`invoiceTotal\`: The final, grand total amount payable.
    *   \`subTotal\`: The total before taxes and fees.
    *   \`totalTax\`: The total sum of all taxes (e.g., IGST, CGST, VAT).
    *   \`totalDiscount\`: The total discount amount.
    *   \`currency\`: The currency of the invoice (e.g., "INR", "USD"). **(New Field)**
    *   \`lineItems\`: An array of objects for each item purchased, each with a \`description\` and \`amount\`.

4.  **Personalized Categorization:** Based on the \`vendorName\` and \`lineItems\`, choose the single best category from the user's PERSONALIZED list provided below.

5.  **Definitive Status Assignment (V4.0 LOGIC - MAJOR UPGRADE):** Now, determine the invoice's \`status\` with high confidence. Apply these rules in strict priority order. Stop as soon as a rule is met. Today's date is **${new Date().toISOString().split('T')[0]}**.
    *   **Priority 1 (Age Heuristic):** If the \`invoiceDate\` is very old (e.g., more than 90 days before today's date), it is a historical record. The status MUST be \`Paid\`.
    *   **Priority 2 (Explicit Payment Confirmation):** If the invoice is recent, search the document for definitive proof of payment. This includes:
        *   Keywords like: "Receipt", "Paid in Full", "Cash Memo", "Payment Confirmation".
        *   Zero balance indicators like: "Amount Due: 0", "Balance: 0.00".
        *   Mention of a specific payment method used: "Paid by Visa", "UPI Transaction ID:", "Mode of Payment: Online".
        *   If any of these are found, the status MUST be \`Paid\`.
    *   **Priority 3 (Contextual Payment Inference):** If no explicit proof of payment is found, infer the status from the business context.
        *   If the transaction is from a known prepaid source like an **e-commerce marketplace (Flipkart, Amazon, Myntra)** or an **in-person retail store (supermarket, restaurant)**, the payment was made at the time of purchase. The status MUST be \`Paid\`.
    *   **Priority 4 (Default Bill Logic):** If the document has passed all the above checks, it is a bill that requires future payment.
        *   If its \`dueDate\` is in the past, the status MUST be \`Overdue\`.
        *   Otherwise (if the due date is in the future, "Due on receipt", or not specified), the status MUST be \`Pending\`.

**Personalized Category List:**
[${userCategoryNames.join(', ')}]

**Final Output Requirement:**
You MUST respond with ONLY a single, minified, valid JSON object containing all the required fields. Do not include any explanations, markdown, or other text outside of the JSON object.

**Invoice Text to Process:**
"""
${pdfText}
"""
`;

            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: "user", content: masterPrompt }],
                model: "llama-3.3-70b-versatile", // Using the correct Groq model ID
                response_format: { type: "json_object" },
                temperature: 0.1
            });

            const aiResponse = chatCompletion.choices[0]?.message?.content;
            if (!aiResponse) {
                throw new Error("Groq AI processing failed to return a response.");
            }
            // --- END OF GROQ IMPLEMENTATION ---

            const parsedData = JSON.parse(aiResponse);

            if (parsedData.isInvoice === false) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "The uploaded document does not appear to be a valid invoice." } };
            }
            
            const { vendorName, invoiceId, invoiceDate, invoiceTotal, lineItems, category, status } = parsedData;

            const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_CONNECTION_STRING);
            const container = cosmosClient.database("InvoiceDB").container("Invoices");

            if (invoiceId) {
                const { resources: existingById } = await container.items.query({ query: "SELECT c.id FROM c WHERE c.workspaceId=@workspaceId AND c.invoiceId=@invoiceId AND c.docType='invoice'", parameters: [{ name: "@workspaceId", value: workspaceId }, { name: "@invoiceId", value: invoiceId }] }).fetchAll();
                if (existingById.length > 0) {
                    return { status: 409, headers: corsHeaders, jsonBody: { error: `Duplicate: An invoice with ID '${invoiceId}' already exists.` } };
                }
            } else if (vendorName && invoiceDate && invoiceTotal) {
                const fingerprint = `${vendorName}-${invoiceDate}-${invoiceTotal}`;
                const { resources: existingByFingerprint } = await container.items.query({ query: "SELECT c.id FROM c WHERE c.workspaceId=@workspaceId AND c.fingerprint=@fingerprint AND c.docType='invoice'", parameters: [{ name: "@workspaceId", value: workspaceId }, { name: "@fingerprint", value: fingerprint }] }).fetchAll();
                if (existingByFingerprint.length > 0) {
                    return { status: 409, headers: corsHeaders, jsonBody: { error: "Duplicate: An invoice from this vendor with the same date and total already exists." } };
                }
            }
            
            const newFileName = `${uuidv4()}.${file.name.split('.').pop()}`;
            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
            await blobServiceClient.getContainerClient("invoice-raw").getBlockBlobClient(newFileName).uploadData(fileBuffer);
            
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
                fileName: newFileName,
                status: status || "pending",
                category: assignedCategory,
                vendorName: vendorName || "N/A",
                customerName: parsedData.customerName || decodedToken.name || "N/A",
                invoiceDate: parsedData.invoiceDate ? new Date(parsedData.invoiceDate) : new Date(),
                dueDate: parsedData.dueDate ? new Date(parsedData.dueDate) : null,
                invoiceTotal: typeof parsedData.invoiceTotal === 'number' ? parsedData.invoiceTotal : 0,
                subTotal: typeof parsedData.subTotal === 'number' ? parsedData.subTotal : null,
                totalDiscount: typeof parsedData.totalDiscount === 'number' ? parsedData.totalDiscount : 0,
                totalTax: typeof parsedData.totalTax === 'number' ? parsedData.totalTax : null,
                amountPaid: typeof parsedData.amountPaid === 'number' ? parsedData.amountPaid : null,
                lineItems: lineItems || [],
                uploadedAt: new Date(),
                currency: parsedData.currency || 'INR'
            };

            const { resource: createdItem } = await container.items.create(newItem);
            return { status: 201, headers: corsHeaders, jsonBody: createdItem };

        } catch (err) {
            context.error("Error in uploadAndProcessInvoice:", err);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An internal server error occurred during processing." } };
        }
    }
});