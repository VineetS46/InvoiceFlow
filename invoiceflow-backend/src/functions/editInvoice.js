const { app } = require('@azure/functions');
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const { container } = require('../helpers/cosmosClient');

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

app.http('editInvoice', {
    methods: ['POST', 'OPTIONS'],
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
            const updatedData = await request.json();
            
            if (!invoiceId || !updatedData) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "Bad Request: Missing ID or body." } };
            }

            const { resource: existingInvoice } = await container.item(invoiceId, userId).read();

            // *** THE FIX IS HERE: Add a specific check for an undefined result ***
            if (!existingInvoice) {
                context.warn(`Attempted to edit non-existent invoice. ID: '${invoiceId}', UserID: '${userId}'`);
                return { status: 404, headers: corsHeaders, jsonBody: { error: "Invoice not found or you do not have permission." } };
            }
            
            const itemToUpdate = { ...existingInvoice, ...updatedData, id: existingInvoice.id, userId: existingInvoice.userId };
            const { resource: savedInvoice } = await container.items.upsert(itemToUpdate);
            
            return { status: 200, headers: corsHeaders, jsonBody: savedInvoice };

        } catch (error) {
            context.error("An unexpected error occurred in editInvoice:", error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An internal server error occurred." } };
        }
    }
});