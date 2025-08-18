// src/functions/getAllInvoices.js (NEW FILE - DEFINITIVE VERSION)
const { app } = require('@azure/functions');
const cosmosClient = require('../helpers/cosmosClient');
const admin = require('../helpers/firebaseAdmin');
const verifyFirebaseToken = require('../helpers/verifyFirebaseToken');
const addCorsHeaders = require('../helpers/addCorsHeaders');

app.http('getAllInvoices', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // --- PREFLIGHT CHECK ---
        if (request.method === 'OPTIONS') {
            return {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:3000',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                }
            };
        }
        // --- END PREFLIGHT ---

        try {
            const { decodedToken, error, status } = await verifyFirebaseToken(request);
            if (error) { return addCorsHeaders({ status: status, body: error }); }
            
            if (decodedToken.role !== 'admin') {
                return addCorsHeaders({ status: 403, body: "Forbidden: You must be an admin." });
            }
            
            const { resources: invoices } = await cosmosClient.container.items.query("SELECT * FROM c ORDER BY c.uploadedAt DESC").fetchAll();
            
            if (!invoices || invoices.length === 0) {
                return addCorsHeaders({ status: 200, jsonBody: [] });
            }
            
            const userRecords = await admin.auth().listUsers(1000);
            const userMap = {};
            userRecords.users.forEach(user => {
                userMap[user.uid] = user.username || user.displayName || user.email.split('@[0]');
            });

            const enrichedInvoices = invoices.map(invoice => ({
                ...invoice,
                username: userMap[invoice.userId] || 'Unknown User'
            }));

            return addCorsHeaders({
                status: 200,
                jsonBody: enrichedInvoices
            });

        } catch (err) {
            context.log("Error in getAllInvoices:", err.message);
            return addCorsHeaders({ status: 500, body: "Internal server error." });
        }
    }
});