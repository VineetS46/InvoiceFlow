// invoiceflow-backend/src/functions/markInvoiceAsPaid.js

const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const { validateFirebaseToken } = require('../helpers/firebase-auth');

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS', // This function uses POST
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

app.http('markInvoiceAsPaid', {
    methods: ['POST', 'OPTIONS'], // We use POST for actions that change data
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        // 1. Authenticate the user
        const decodedToken = await validateFirebaseToken(request);
        if (!decodedToken) {
            return { status: 401, headers: corsHeaders, body: "Unauthorized." };
        }
        const userId = decodedToken.uid;
        context.log(`Request to mark invoice as paid for user: ${userId}`);

        // 2. Get the invoiceId from the request body
        let invoiceId;
        try {
            const body = await request.json();
            invoiceId = body.id;
        } catch (e) {
            return { status: 400, headers: corsHeaders, body: "Invalid request body." };
        }
        
        if (!invoiceId) {
            return { status: 400, headers: corsHeaders, body: "Please provide an invoice 'id'." };
        }

        try {
            // 3. Connect to Cosmos DB
            const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_CONNECTION_STRING);
            const container = cosmosClient.database("InvoiceDB").container("Invoices");

            // 4. Find the specific invoice for this user
            const { resource: invoiceToUpdate } = await container.item(invoiceId, userId).read();

            if (!invoiceToUpdate) {
                return { status: 404, headers: corsHeaders, body: "Invoice not found or you do not have permission to modify it." };
            }

            // 5. Perform the update
            const updatedInvoice = {
                ...invoiceToUpdate,
                status: 'paid',
                paymentDate: new Date().toISOString()
            };

            await container.item(invoiceId, userId).replace(updatedInvoice);
            context.log(`Successfully marked invoice ${invoiceId} as paid.`);

            // 6. Return success
            return { status: 200, headers: corsHeaders, body: "Invoice marked as paid." };

        } catch (error) {
            context.log(`Error marking invoice as paid:`, error.message);
            return { status: 500, headers: corsHeaders, body: "An error occurred." };
        }
    }
});