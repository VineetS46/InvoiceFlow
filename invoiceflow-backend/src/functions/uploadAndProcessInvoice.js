const { app } = require('@azure/functions');
const { BlobServiceClient } = require("@azure/storage-blob");
const OpenAI = require("openai");
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const admin = require('../helpers/firebaseAdmin');
const db = admin.firestore();
const pdfParse = require('pdf-parse');

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

            const openAIClient = new OpenAI({
                apiKey: process.env.AZURE_OPENAI_KEY,
                baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
                defaultQuery: { "api-version": "2024-02-01" },
                defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
            });

            // The definitive, all-in-one prompt for extraction and categorization
            const masterPrompt = `
You are an expert invoice processing AI. From the provided invoice text, perform two tasks:

TASK 1: Extract the following fields and return them in a valid JSON object. For numbers, provide only the number (e.g., 169.00, not "₹169.00"). If a value is not found, use null.
- "invoiceId"
- "vendorName"
- "invoiceDate" (in YYYY-MM-DD format)
- "dueDate" (in YYYY-MM-DD format)
- "invoiceTotal" (the final, grand total amount)
- "subTotal" (the total before taxes and fees)
- "totalTax" (the total amount of tax)
- "lineItems" (an array of all objects, each with 'description' and 'amount')

TASK 2: Based on the vendor and line items you just identified, choose the single best category for this entire invoice from the list provided below. Add this category to your JSON response with the key "category".

Personalized Category List:
[${userCategoryNames.join(', ')}]

Respond ONLY with a single, minified, valid JSON object containing all extracted fields from TASK 1 and your chosen category from TASK 2.

Invoice Text: """${pdfText}"""
`;
            
            const gptResponse = await openAIClient.chat.completions.create({
                model: "gpt-4.1",
                messages: [{ role: "user", content: masterPrompt }],
                response_format: { type: "json_object" },
                temperature: 0.1
            });

            const aiResponse = gptResponse.choices[0].message.content;
            if (!aiResponse) {
                throw new Error("AI processing failed to return a response.");
            }

            const parsedData = JSON.parse(aiResponse);
            const { vendorName, invoiceId, invoiceDate, invoiceTotal, lineItems, category } = parsedData;

            // Validate the category returned by the AI
            let assignedCategory = category;
            if (!userCategoryNames.includes(assignedCategory)) {
                assignedCategory = "Uncategorized";
            }
            
            const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_CONNECTION_STRING);
            const container = cosmosClient.database("InvoiceDB").container("Invoices");

            // Perform duplicate check on the clean, AI-extracted data
            if (invoiceId) {
                const { resources: existingById } = await container.items.query({
                    query: "SELECT c.id FROM c WHERE c.workspaceId=@workspaceId AND c.invoiceId=@invoiceId AND c.docType='invoice'",
                    parameters: [{ name: "@workspaceId", value: workspaceId }, { name: "@invoiceId", value: invoiceId }]
                }).fetchAll();
                if (existingById.length > 0) {
                    return { status: 409, headers: corsHeaders, jsonBody: { error: `Duplicate: An invoice with ID '${invoiceId}' already exists.` } };
                }
            } else if (vendorName && invoiceDate && invoiceTotal) {
                const fingerprint = `${vendorName}-${invoiceDate}-${invoiceTotal}`;
                const { resources: existingByFingerprint } = await container.items.query({
                    query: "SELECT c.id FROM c WHERE c.workspaceId=@workspaceId AND c.fingerprint=@fingerprint AND c.docType='invoice'",
                    parameters: [{ name: "@workspaceId", value: workspaceId }, { name: "@fingerprint", value: fingerprint }]
                }).fetchAll();
                if (existingByFingerprint.length > 0) {
                    return { status: 409, headers: corsHeaders, jsonBody: { error: "Duplicate: An invoice from this vendor with the same date and total already exists." } };
                }
            }
            
            const newFileName = `${uuidv4()}.${file.name.split('.').pop()}`;
            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
            await blobServiceClient.getContainerClient("invoice-raw").getBlockBlobClient(newFileName).uploadData(fileBuffer);
            
            const newItem = {
                id: uuidv4(),
                docType: "invoice",
                workspaceId,
                uploadedBy: userId,
                invoiceId: invoiceId || null,
                fingerprint: !invoiceId ? `${vendorName}-${invoiceDate}-${invoiceTotal}` : null,
                fileName: newFileName,
                status: "pending",
                category: assignedCategory,
                vendorName: vendorName || "N/A",
                customerName: parsedData.customerName || decodedToken.name || "N/A",
                invoiceDate: parsedData.invoiceDate ? new Date(parsedData.invoiceDate) : new Date(),
                dueDate: parsedData.dueDate ? new Date(parsedData.dueDate) : new Date(new Date().setDate(new Date().getDate()+30)),
                invoiceTotal: typeof parsedData.invoiceTotal === 'number' ? parsedData.invoiceTotal : 0,
                subTotal: typeof parsedData.subTotal === 'number' ? parsedData.subTotal : null,
                totalTax: typeof parsedData.totalTax === 'number' ? parsedData.totalTax : null,
                lineItems: lineItems || [],
                uploadedAt: new Date(),
                currency: 'INR' // Assuming INR, but could be added to the prompt
            };

            const { resource: createdItem } = await container.items.create(newItem);
            return { status: 201, headers: corsHeaders, jsonBody: createdItem };

        } catch (err) {
            context.error("Error in uploadAndProcessInvoice:", err);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An internal server error occurred during processing." } };
        }
    }
});