// invoiceflow-backend/src/functions/uploadAndProcessInvoice.js (FINAL, COMPLETE, AND ROBUST)

const { app } = require('@azure/functions');
const { BlobServiceClient } = require("@azure/storage-blob");
const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");
const { validateFirebaseToken } = require('../helpers/firebase-auth');

// Define the allowed origin from settings for production readiness
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

// Define the complete set of CORS headers required for all responses.
const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

// Helper function to clean up messy descriptions from the AI
function cleanDescription(description) {
    if (!description) return 'N/A';
    const stopWords = ['warranty:', 'imei/serial no:', 'hsn/sac:', 'fsn:'];
    let cleanDesc = description;
    for (const word of stopWords) {
        if (cleanDesc.toLowerCase().includes(word)) {
            cleanDesc = cleanDesc.substring(0, cleanDesc.toLowerCase().indexOf(word));
        }
    }
    return cleanDesc.trim();
}

app.http('uploadAndProcessInvoice', {
    methods: ['POST', 'OPTIONS'], // We must handle both methods for CORS
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Handle the browser's pre-flight request by sending back the permission slip.
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
            const vendorName = invoice.fields.VendorName?.value;
            const invoiceDate = invoice.fields.InvoiceDate?.value;
            const amountDue = invoice.fields.AmountDue?.value?.amount;
            const invoiceTotal = invoice.fields.InvoiceTotal?.value?.amount;
            const finalTotal = amountDue ?? invoiceTotal ?? 0;

            if (invoiceId) {
                const { resources: existing } = await container.items.query({ query: "SELECT c.id FROM c WHERE c.userId = @userId AND c.invoiceId = @invoiceId", parameters: [{ name: "@userId", value: userId }, { name: "@invoiceId", value: invoiceId }] }).fetchAll();
                if (existing.length > 0) {
                    return { status: 409, headers: corsHeaders, body: `Duplicate: An invoice with ID '${invoiceId}' already exists.` };
                }
            } else if (vendorName && invoiceDate && finalTotal) {
                const fingerprint = `${vendorName}-${new Date(invoiceDate).toISOString().split('T')[0]}-${finalTotal}`;
                const { resources: existing } = await container.items.query({ query: "SELECT c.id FROM c WHERE c.userId = @userId AND c.fingerprint = @fingerprint", parameters: [{ name: "@userId", value: userId }, { name: "@fingerprint", value: fingerprint }] }).fetchAll();
                if (existing.length > 0) {
                    return { status: 409, headers: corsHeaders, body: `Duplicate: An invoice from '${vendorName}' for the same amount and date already exists.` };
                }
            }

            // 5. Extract and Clean Line Items
            let lineItems = [];
            if (invoice.fields.Items?.values) {
                lineItems = invoice.fields.Items.values.map(item => ({
                    description: cleanDescription(item.properties.Description?.value),
                    quantity: item.properties.Quantity?.value || 1,
                    unitPrice: item.properties.UnitPrice?.value?.amount || 0,
                    amount: item.properties.Amount?.value?.amount || 0
                }));
            }

            // 6. Archive the original file in Blob Storage
            const newFileName = `${uuidv4()}.${file.name.split('.').pop()}`;
            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
            await blobServiceClient.getContainerClient("invoice-raw").getBlockBlobClient(newFileName).uploadData(fileBuffer);
            
            // 7. Prepare and Save the Final Data to Cosmos DB
            const currency = invoice.fields.InvoiceTotal?.value?.currencyCode || invoice.fields.InvoiceTotal?.value?.currencySymbol;
            if (!currency) { return { status: 400, headers: corsHeaders, body: "Could not determine currency from invoice." }; }
            
            const invoiceDateObj = new Date(invoiceDate || new Date());
            let dueDate;
            if (invoice.fields.DueDate?.value) { dueDate = new Date(invoice.fields.DueDate.value); } 
            else { dueDate = new Date(invoiceDateObj); dueDate.setDate(invoiceDateObj.getDate() + 30); }

            let initialStatus = "pending";
            const sixtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 60));
            if (invoiceDateObj < sixtyDaysAgo) { initialStatus = "paid"; }

            const newItem = {
                id: uuidv4(),
                userId: userId,
                invoiceId: invoiceId || null,
                fingerprint: invoiceId ? null : `${vendorName}-${invoiceDateObj.toISOString().split('T')[0]}-${finalTotal}`,
                fileName: newFileName,
                status: initialStatus,
                vendorName: vendorName || 'N/A',
                invoiceDate: invoiceDateObj,
                dueDate: dueDate,
                invoiceTotal: finalTotal,
                currency: currency,
                lineItems: lineItems,
                uploadedAt: new Date(),
                paymentDate: initialStatus === 'paid' ? invoiceDateObj : null
            };
            const { resource: createdItem } = await container.items.create(newItem);

            // 8. Return Success
            return { status: 201, headers: corsHeaders, jsonBody: createdItem };

        } catch (error) {
            context.log("Error in uploadAndProcessInvoice:", error.message);
            return { status: 500, headers: corsHeaders, body: "An internal server error occurred." };
        }
    }
});