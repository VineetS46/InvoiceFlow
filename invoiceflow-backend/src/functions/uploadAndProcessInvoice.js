// invoiceflow-backend/src/functions/uploadAndProcessInvoice.js (FINAL, WITH CORS FIX)

const { app } = require('@azure/functions');
const { BlobServiceClient } = require("@azure/storage-blob");
const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");
const { validateFirebaseToken } = require('../helpers/firebase-auth');

// --- THIS IS THE CRITICAL FIX ---
// Define the allowed origin and the complete CORS headers once.
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS', // This function uses POST
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

app.http('uploadAndProcessInvoice', {
    methods: ['POST', 'OPTIONS'], // We must handle both methods
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Handle the browser's pre-flight request
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        // 1. Authenticate the user
        const decodedToken = await validateFirebaseToken(request);
        if (!decodedToken) {
            return { status: 401, headers: corsHeaders, body: "Unauthorized." };
        }
        const userId = decodedToken.uid;

        try {
            // 2. Get the file from the request body
            const formData = await request.formData();
            const file = formData.get('invoiceFile');
            if (!file) {
                return { status: 400, headers: corsHeaders, body: "No file uploaded." };
            }
            const fileBuffer = Buffer.from(await file.arrayBuffer());

            // 3. AI Analysis
            const aiClient = new DocumentAnalysisClient(process.env.AZURE_DOC_INTEL_ENDPOINT, new AzureKeyCredential(process.env.AZURE_DOC_INTEL_KEY));
            const poller = await aiClient.beginAnalyzeDocument("prebuilt-invoice", fileBuffer);
            const { documents } = await poller.pollUntilDone();
            const invoice = documents[0];
            if (!invoice) {
                return { status: 400, headers: corsHeaders, body: "Could not analyze the document." };
            }

            // 4. Intelligent Duplicate Check
            const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_CONNECTION_STRING);
            const container = cosmosClient.database("InvoiceDB").container("Invoices");
            
            const invoiceId = invoice.fields.InvoiceId?.value;
            if (invoiceId) {
                const { resources: existing } = await container.items.query({ query: "SELECT c.id FROM c WHERE c.userId = @userId AND c.invoiceId = @invoiceId", parameters: [{ name: "@userId", value: userId }, { name: "@invoiceId", value: invoiceId }] }).fetchAll();
                if (existing.length > 0) {
                    return { status: 409, headers: corsHeaders, body: `Duplicate: An invoice with ID '${invoiceId}' already exists.` };
                }
            }
            // (Fingerprint check can be added here as well)

            // 5. If unique, save the file to Blob Storage for archival
            const newFileName = `${uuidv4()}.${file.name.split('.').pop()}`;
            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
            const blobContainerClient = blobServiceClient.getContainerClient("invoice-raw");
            const blockBlobClient = blobContainerClient.getBlockBlobClient(newFileName);
            await blockBlobClient.uploadData(fileBuffer);
            
            // 6. Prepare and save the structured data to Cosmos DB
            const newItem = {
                id: uuidv4(),
                userId: userId,
                invoiceId: invoiceId || null,
                fileName: newFileName,
                status: "pending",
                vendorName: invoice.fields.VendorName?.value || 'N/A',
                invoiceDate: invoice.fields.InvoiceDate?.value || new Date(),
                dueDate: invoice.fields.DueDate?.value || new Date(new Date().setDate(new Date().getDate() + 30)),
                invoiceTotal: invoice.fields.InvoiceTotal?.value?.amount || 0,
                currency: invoice.fields.InvoiceTotal?.value?.currencyCode || invoice.fields.InvoiceTotal?.value?.currencySymbol,
                uploadedAt: new Date(),
                paymentDate: null
            };
            const { resource: createdItem } = await container.items.create(newItem);

            // 7. Return success
            return { status: 201, headers: corsHeaders, jsonBody: createdItem };

        } catch (error) {
            context.log("Error in uploadAndProcessInvoice:", error.message);
            return { status: 500, headers: corsHeaders, body: "An internal server error occurred." };
        }
    }
});