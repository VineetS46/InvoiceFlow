// invoiceflow-backend/src/functions/markInvoiceAsPaid.js
const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const { validateFirebaseToken } = require('../helpers/firebase-auth');

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

app.http('markInvoiceAsPaid', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        const decodedToken = await validateFirebaseToken(request);
        if (!decodedToken) {
            return { status: 401, headers: corsHeaders, body: "Unauthorized." };
        }
        const userId = decodedToken.uid;
        context.log(`Request to mark invoice as paid for user: ${userId}`);

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
            const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_CONNECTION_STRING);
            const container = cosmosClient.database("InvoiceDB").container("Invoices");

            const { resource: invoiceToUpdate } = await container.item(invoiceId, userId).read();

            if (!invoiceToUpdate) {
                return { status: 404, headers: corsHeaders, body: "Invoice not found or you do not have permission." };
            }

            const updatedInvoice = {
                ...invoiceToUpdate,
                status: 'paid',
                paymentDate: new Date().toISOString()
            };

            await container.item(invoiceId, userId).replace(updatedInvoice);
            context.log(`Successfully marked invoice ${invoiceId} as paid.`);

            return { status: 200, headers: corsHeaders, jsonBody: { message: "Invoice marked as paid." } };

        } catch (error) {
            context.log(`Error marking invoice as paid:`, error.message);
            return { status: 500, headers: corsHeaders, body: "An error occurred." };
        }
    }
});