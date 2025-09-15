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

            // --- STEP 1: Fetch the user's personalized category list ONCE ---
            const workspaceDocRef = db.collection('workspaces').doc(workspaceId);
            const workspaceDoc = await workspaceDocRef.get();
            if (!workspaceDoc.exists) {
                throw new Error(`Workspace with ID ${workspaceId} not found.`);
            }
            const userCategoryNames = (workspaceDoc.data().categories || []).map(cat => cat.name);

            // --- STEP 2: Extract structured data from the invoice text ---
            const openAIClient = new OpenAI({
                apiKey: process.env.AZURE_OPENAI_KEY,
                baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
                defaultQuery: { "api-version": "2024-02-01" },
                defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
            });

            const extractionPrompt = `You are an intelligent invoice parser. From the provided invoice text, extract the key fields. Respond ONLY with a single, minified, valid JSON object. Use null for missing values. Dates must be in YYYY-MM-DD format. Numerical values must be numbers only. Required keys: "invoiceId", "vendorName", "customerName", "invoiceDate", "dueDate", "subTotal", "totalTax", "invoiceTotal", "lineItems" (array of objects with 'description', 'quantity', and 'amount'), "mainProduct" (the most important product/service name), and "mainProductPrice" (the price of that specific product).\n\nInvoice Text: """${pdfText}"""`;
            const gptResponse = await openAIClient.chat.completions.create({
                model: "gpt-4.1",
                messages: [{ role: "user", content: extractionPrompt }],
                response_format: { type: "json_object" },
                temperature: 0.1
            });
            const parsedData = JSON.parse(gptResponse.choices[0].message.content);
            const { vendorName, invoiceId, invoiceDate, invoiceTotal, mainProduct } = parsedData;

            // --- STEP 3: Perform a robust, workspace-aware duplicate check ---
            const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_CONNECTION_STRING);
            const container = cosmosClient.database("InvoiceDB").container("Invoices");

            if (invoiceId) {
                const { resources: existingById } = await container.items.query({
                    query: "SELECT c.id FROM c WHERE c.workspaceId=@workspaceId AND c.invoiceId=@invoiceId AND c.docType='invoice'",
                    parameters: [{ name: "@workspaceId", value: workspaceId }, { name: "@invoiceId", value: invoiceId }]
                }).fetchAll();
                if (existingById.length > 0) {
                    return { status: 409, headers: corsHeaders, jsonBody: { error: `Duplicate: An invoice with ID '${invoiceId}' already exists.` } };
                }
            } else {
                const fingerprint = `${vendorName}-${invoiceDate}-${invoiceTotal}`;
                const { resources: existingByFingerprint } = await container.items.query({
                    query: "SELECT c.id FROM c WHERE c.workspaceId=@workspaceId AND c.fingerprint=@fingerprint AND c.docType='invoice'",
                    parameters: [{ name: "@workspaceId", value: workspaceId }, { name: "@fingerprint", value: fingerprint }]
                }).fetchAll();
                if (existingByFingerprint.length > 0) {
                    return { status: 409, headers: corsHeaders, jsonBody: { error: "Duplicate: An invoice from this vendor with the same date and total already exists." } };
                }
            }

            // --- STEP 4: Get the category using the personalized list ---
            const categoryPrompt = `Based on vendor "${vendorName}" and product "${mainProduct}", choose the best category from this user's PERSONALIZED list: [${userCategoryNames.join(', ')}]. Respond ONLY with the category name.`;
            const categoryResp = await openAIClient.chat.completions.create({
                model: "gpt-4.1",
                messages: [{ role: "user", content: categoryPrompt }],
                temperature: 0
            });
            let assignedCategory = categoryResp.choices[0].message.content.trim();
            if (!userCategoryNames.includes(assignedCategory)) {
                assignedCategory = "Uncategorized";
            }
            
            // --- STEP 5: Save to Cloud ---
            const newFileName = `${uuidv4()}.${file.name.split('.').pop()}`;
            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
            await blobServiceClient.getContainerClient("invoice-raw").getBlockBlobClient(newFileName).uploadData(fileBuffer);
            
            const newItem = {
                id: uuidv4(),
                docType: "invoice",
                workspaceId,
                uploadedBy: userId,
                invoiceId: parsedData.invoiceId || null,
                fingerprint: !parsedData.invoiceId ? `${vendorName}-${invoiceDate}-${invoiceTotal}` : null,
                fileName: newFileName,
                status: "pending",
                category: assignedCategory,
                vendorName: vendorName || "N/A",
                customerName: parsedData.customerName || decodedToken.name || "N/A",
                invoiceDate: parsedData.invoiceDate ? new Date(parsedData.invoiceDate) : new Date(),
                dueDate: parsedData.dueDate ? new Date(parsedData.dueDate) : new Date(new Date().setDate(new Date().getDate()+30)),
                invoiceTotal: typeof parsedData.invoiceTotal === 'number' ? parsedData.invoiceTotal : 0,
                subTotal: parsedData.subTotal,
                totalTax: parsedData.totalTax,
                mainProduct: mainProduct || "N/A",
                mainProductPrice: parsedData.mainProductPrice || null,
                lineItems: parsedData.lineItems || [],
                uploadedAt: new Date(),
                currency: 'INR'
            };

            const { resource: createdItem } = await container.items.create(newItem);
            return { status: 201, headers: corsHeaders, jsonBody: createdItem };

        } catch (err) {
            context.error("Error in uploadAndProcessInvoice:", err);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An internal server error occurred during processing." } };
        }
    }
});