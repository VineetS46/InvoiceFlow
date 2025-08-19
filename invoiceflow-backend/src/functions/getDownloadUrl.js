const { app } = require('@azure/functions');
const { BlobServiceClient } = require("@azure/storage-blob");
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const { container } = require('../helpers/cosmosClient');

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

app.http('getDownloadUrl', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        try {
            const decodedToken = await validateFirebaseToken(request);
            if (!decodedToken) { return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized" } }; }
            
            const userId = decodedToken.uid;
            const invoiceId = request.query.get('id');

            const { resource: invoice } = await container.item(invoiceId, userId).read();

            if (!invoice) {
                context.warn(`Invoice not found for ID: '${invoiceId}' and UserID: '${userId}'`);
                return { status: 404, headers: corsHeaders, jsonBody: { error: "Invoice not found or you do not have permission." } };
            }

            const blobName = invoice.fileName; 
            if (!blobName) {
                context.error("Data integrity error: The invoice document is missing a 'fileName'.");
                return { status: 500, headers: corsHeaders, jsonBody: { error: "Server Error: Invoice record is missing file reference." } };
            }

            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
            const containerClient = blobServiceClient.getContainerClient('invoice-raw');
            const blobClient = containerClient.getBlobClient(blobName);
            
            // --- THIS IS THE UPDATED SECTION ---
            const sasUrl = await blobClient.generateSasUrl({
                permissions: "r", // read-only
                expiresOn: new Date(new Date().valueOf() + 300 * 1000), // 5 minutes
                contentDisposition: "inline" // This is the new line. It tells the browser to try and display the file.
            });
            // ------------------------------------
            
            return { status: 200, headers: corsHeaders, jsonBody: { downloadUrl: sasUrl } };

        } catch (error) {
            context.error("An unexpected error occurred in getDownloadUrl:", error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An internal server error occurred." } };
        }
    }
});