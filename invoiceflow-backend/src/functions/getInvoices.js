// invoiceflow-backend/src/functions/getInvoices.js (FINAL, PRODUCTION-READY)

const { app } = require('@azure/functions');
const { CosmosClient } = require("@azure/cosmos");
const { validateFirebaseToken } = require('../helpers/firebase-auth');

// Define the allowed origin from settings for production readiness
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

// Define the complete set of CORS headers required for all responses.
const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

app.http('getInvoices', {
    methods: ['GET', 'OPTIONS'], // We must handle OPTIONS requests for CORS
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Handle the browser's pre-flight request.
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        // 1. Authenticate the user's token.
        const decodedToken = await validateFirebaseToken(request);
        if (!decodedToken) {
            return { status: 401, headers: corsHeaders, body: "Unauthorized: Invalid or missing token." };
        }
        const userId = decodedToken.uid;

        try {
            // 2. Connect to Cosmos DB.
            const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_CONNECTION_STRING);
            const container = cosmosClient.database("InvoiceDB").container("Invoices");

            // 3. Define and execute the query to get all invoices for this user.
            const querySpec = {
                query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.uploadedAt DESC",
                parameters: [
                    {
                        name: "@userId",
                        value: userId
                    }
                ]
            };

            const { resources: invoices } = await container.items.query(querySpec).fetchAll();
            
            // 4. Dynamically calculate overdue status before sending the response.
            const today = new Date();
            const processedInvoices = invoices.map(invoice => {
                if (invoice.status === 'pending' && new Date(invoice.dueDate) < today) {
                    return { ...invoice, status: 'overdue' };
                }
                return invoice;
            });

            // 5. Return the successful response with the data.
            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: processedInvoices
            };

        } catch (error) {
            context.log(`Error fetching invoices for user ${userId}:`, error.message);
            return { status: 500, headers: corsHeaders, body: "An error occurred while fetching invoices." };
        }
    }
});