const { app } = require('@azure/functions');
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const { container } = require('../helpers/cosmosClient'); // Use the central, correct client

app.http('markInvoiceAsPaid', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
        const corsHeaders = {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

            // --- THIS IS THE UPDATED LOGIC ---
            const workspaceId = request.headers.get('x-workspace-id');
            const { id: invoiceId } = await request.json();

            if (!workspaceId || !invoiceId) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "Missing workspace or invoice ID." } };
            }

            // First, read the item to ensure it exists and belongs to the workspace.
            // This is a security check and is necessary before patching.
            const { resource: existingInvoice } = await container.item(invoiceId, workspaceId).read();

            if (!existingInvoice) {
                return { status: 404, headers: corsHeaders, jsonBody: { error: "Invoice not found or you do not have permission." } };
            }

            // Use a 'patch' operation for a more efficient update.
            // This only sends the changed fields to the database.
            const operations = [
                { op: "set", path: "/status", value: "paid" },
                { op: "set", path: "/paymentDate", value: new Date().toISOString() }
            ];

            const { resource: updatedInvoice } = await container.item(invoiceId, workspaceId).patch(operations);
            // --- END OF UPDATE ---

            return { status: 200, headers: corsHeaders, jsonBody: updatedInvoice };

        } catch (error) {
            // Handle cases where the item might not be found during the read
            if (error.code === 404) {
                return { status: 404, headers: corsHeaders, jsonBody: { error: "Invoice not found or you do not have permission." } };
            }
            context.error("Error in markInvoiceAsPaid:", error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An internal server error occurred." } };
        }
    }
});