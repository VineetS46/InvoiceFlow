// invoiceflow-backend/src/functions/getUsers.js
const { app } = require('@azure/functions');
const admin = require('../helpers/firebaseAdmin');
const { validateFirebaseToken } = require('../helpers/firebase-auth');

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const corsHeaders = { /* ... (same as before) ... */ };

app.http('getUsers', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') { /* ... (same as before) ... */ }

        // 1. Authenticate and Authorize: Must be an admin
        const callerToken = await validateFirebaseToken(request);
        if (!callerToken || callerToken.role !== 'admin') {
            return { status: 403, headers: corsHeaders, body: "Forbidden: You do not have permission to view users." };
        }

        try {
            // 2. If authorized, get all user documents from Firestore
            const db = admin.firestore();
            const usersSnapshot = await db.collection('users').get();
            const usersList = usersSnapshot.docs.map(doc => doc.data());

            return { status: 200, headers: corsHeaders, jsonBody: usersList };

        } catch (error) {
            context.log.error("Error fetching users:", error);
            return { status: 500, headers: corsHeaders, body: "An error occurred while fetching users." };
        }
    }
});