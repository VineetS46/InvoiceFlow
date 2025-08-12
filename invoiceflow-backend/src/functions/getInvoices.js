// invoice-backend/src/functions/getInvoices.js (FINAL, CORRECTED ERROR HANDLING)

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
        // Handle CORS pre-flight request
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        // 1. Authenticate the user
        const decodedToken = await validateFirebaseToken(request);

        // --- THIS IS THE CRITICAL FIX ---
        // We must check if the token is null (invalid) before using it.
        if (!decodedToken) {
            context.log("Authentication failed: Invalid or missing token.");
            return { 
                status: 401, // 401 Unauthorized
                headers: corsHeaders, 
                body: "Unauthorized: Invalid or missing token." 
            };
        }
        
        const userId = decodedToken.uid;
        context.log(`Request to get invoices for user: ${userId}`);

        try {
            // 2. Connect to Cosmos DB
            const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_CONNECTION_STRING);
            const container = cosmosClient.database("InvoiceDB").container("Invoices");

            // 3. Define and execute the query
            const querySpec = {
                query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.uploadedAt DESC",
                parameters: [ { name: "@userId", value: userId } ]
            };
            const { resources: invoices } = await container.items.query(querySpec).fetchAll();
            
            // 4. Calculate overdue status on the fly
            const today = new Date();
            const processedInvoices = invoices.map(invoice => {
                if (invoice.status === 'pending' && new Date(invoice.dueDate) < today) {
                    return { ...invoice, status: 'overdue' };
                }
                return invoice;
            });

            context.log(`Found ${invoices.length} invoices, returning ${processedInvoices.length} with calculated statuses.`);

            // 5. Return the results
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