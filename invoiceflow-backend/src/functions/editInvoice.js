const { app } = require('@azure/functions');
const { v4: uuidv4 } = require("uuid");
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const { container } = require('../helpers/cosmosClient');

app.http('editInvoice', {
    methods: ['POST', 'OPTIONS'], // Handle both POST and the OPTIONS preflight request
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Define and handle CORS
        const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
        const corsHeaders = {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-workspace-id'
        };

        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

         try {
            const decodedToken = await validateFirebaseToken(request);
            if (!decodedToken) { return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized" } }; }
            
            const userId = decodedToken.uid;
            const workspaceId = request.headers.get('x-workspace-id');
            const invoiceId = request.query.get('id');
            const updatedData = await request.json();
            
            if (!workspaceId || !invoiceId || !updatedData) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "Bad Request: Missing ID, workspace, or body." } };
            }

           const { resource: existingInvoice } = await container.item(invoiceId, workspaceId).read();

            if (!existingInvoice) {
                return { status: 404, headers: corsHeaders, jsonBody: { error: "Invoice not found or you do not have permission." } };
            }
            
            // Logic to create a "learning record" if a category is changed
            if (updatedData.category && existingInvoice.category === 'Uncategorized' && updatedData.category !== 'Uncategorized') {
                const textFragment = (existingInvoice.lineItems || []).map(item => item.description).join(' ').toLowerCase();
                const correctionLog = {
                    id: uuidv4(),
                    docType: "correctionLog",
                    userId: userId,
                    sourceInvoiceId: existingInvoice.id,
                    textFragment: textFragment,
                    vendorName: existingInvoice.vendorName,
                    assignedCategory: updatedData.category,
                    createdAt: new Date().toISOString()
                };
                await container.items.create(correctionLog);
            }

            // Update the main invoice document
            const itemToUpdate = { ...existingInvoice, ...updatedData, id: existingInvoice.id, userId: existingInvoice.userId };
          itemToUpdate.workspaceId = existingInvoice.workspaceId; 
            const { resource: savedInvoice } = await container.items.upsert(itemToUpdate);
            
            return { status: 200, headers: corsHeaders, jsonBody: savedInvoice };

        } catch (error) {
            context.error("An unexpected error occurred in editInvoice:", error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An internal server error occurred." } };
        }
    }
});