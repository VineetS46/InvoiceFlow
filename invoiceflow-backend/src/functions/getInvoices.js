const { app } = require('@azure/functions');
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const { container } = require('../helpers/cosmosClient');

app.http('getInvoices', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
        const corsHeaders = {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-workspace-id' // Allow the custom header
        };

        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        try {
            const decodedToken = await validateFirebaseToken(request);
            if (!decodedToken) {
                return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized" } };
            }
            const userId = decodedToken.uid; // We still need the user's ID for security checks

            
            // 1. Read the workspaceId from the custom header
            const workspaceId = request.headers.get('x-workspace-id');
            if (!workspaceId) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "Workspace ID is missing." } };
            }
            // (A future security check would verify that 'userId' is a member of 'workspaceId' in Firestore)
            // ---

            // 2. Update the query to filter by 'workspaceId'
            const querySpec = {
                query: "SELECT * FROM c WHERE c.workspaceId = @workspaceId AND c.docType = 'invoice' ORDER BY c.uploadedAt DESC",
                parameters: [
                    { name: "@workspaceId", value: workspaceId }
                ]
            };

            const { resources: invoices } = await container.items.query(querySpec).fetchAll();
            
            const today = new Date();
            const processedInvoices = invoices.map(invoice => {
                if (invoice.status === 'pending' && new Date(invoice.dueDate) < today) {
                    return { ...invoice, status: 'overdue' };
                }
                return invoice;
            });

            return {
                status: 200,
                headers: corsHeaders,
                jsonBody: processedInvoices
            };

        } catch (error) {
            context.error(`Error in getInvoices:`, error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An error occurred." } };
        }
    }
});