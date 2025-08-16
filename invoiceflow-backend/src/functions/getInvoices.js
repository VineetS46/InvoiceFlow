// invoiceflow-backend/src/functions/getInvoices.js (FINAL, CORRECTED VERSION)
const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const { validateFirebaseToken } = require('../helpers/firebase-auth');

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

app.http('getInvoices', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        const decodedToken = await validateFirebaseToken(request);
        if (!decodedToken) {
            return { status: 401, headers: corsHeaders, body: "Unauthorized: Invalid or missing token." };
        }
        const userId = decodedToken.uid;

        try {
            const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_CONNECTION_STRING);
            const container = cosmosClient.database("InvoiceDB").container("Invoices");

            const querySpec = {
                query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.uploadedAt DESC",
                parameters: [ { name: "@userId", value: userId } ]
            };
            const { resources: invoices } = await container.items.query(querySpec).fetchAll();
            
            const today = new Date();
            const processedInvoices = invoices.map(invoice => {
                if (invoice.status === 'pending' && new Date(invoice.dueDate) < today) {
                    return { ...invoice, status: 'overdue' };
                }
                return invoice;
            });

            return { status: 200, headers: corsHeaders, jsonBody: processedInvoices };
        } catch (error) {
            context.log(`Error fetching invoices for user ${userId}:`, error.message);
            return { status: 500, headers: corsHeaders, body: "An error occurred while fetching invoices." };
        }
    }
});