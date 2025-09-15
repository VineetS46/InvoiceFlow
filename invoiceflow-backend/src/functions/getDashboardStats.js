const { app } = require('@azure/functions');
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const { container } = require('../helpers/cosmosClient');

app.http('getDashboardStats', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
        const corsHeaders = {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-workspace-id'
        };

        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        try {
            const decodedToken = await validateFirebaseToken(request);
            if (!decodedToken) {
                return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized" } };
            }

            const workspaceId = request.headers.get('x-workspace-id');
            if (!workspaceId) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "Workspace ID is missing." } };
            }

            const querySpec = {
                query: "SELECT c.id, c.vendorName, c.invoiceTotal, c.status, c.dueDate, c.uploadedAt, c.docType FROM c WHERE c.workspaceId = @workspaceId AND (c.docType = 'invoice' OR NOT IS_DEFINED(c.docType))",
                parameters: [{ name: "@workspaceId", value: workspaceId }]
            };
            const { resources: allInvoices } = await container.items.query(querySpec).fetchAll();

            let totalAmountPaid = 0;
            let overdueCount = 0;
            const today = new Date();

            allInvoices.forEach(invoice => {
                if (invoice.status === 'paid') {
                    totalAmountPaid += (invoice.invoiceTotal || 0);
                }
                if (invoice.status === 'pending' && invoice.dueDate && new Date(invoice.dueDate) < today) {
                    overdueCount++;
                }
            });

            const recentInvoices = allInvoices
                .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
                .slice(0, 5);

            const stats = {
                totalCount: allInvoices.length,
                totalAmountPaid: totalAmountPaid,
                overdueCount: overdueCount,
                recentInvoices: recentInvoices
            };

            return { status: 200, headers: corsHeaders, jsonBody: stats };

        } catch (error) {
            context.error("Error in getDashboardStats:", error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "Could not fetch dashboard stats." } };
        }
    }
});