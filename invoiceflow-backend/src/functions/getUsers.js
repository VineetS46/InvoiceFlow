// invoiceflow-backend/src/functions/getUsers.js (FINAL, WITH CORS FIX)

const { app } = require('@azure/functions');
const admin = require('../helpers/firebaseAdmin');
const { validateFirebaseToken } = require('../helpers/firebase-auth');

// --- THIS IS THE CRITICAL FIX ---
// Define the allowed origin and the complete CORS headers once.
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

app.http('getUsers', {
    methods: ['GET', 'OPTIONS'], // We must handle both methods
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Handle the browser's pre-flight request by sending back the permission slip.
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        // --- The rest of the function logic continues below ---

        // 1. Authenticate and Authorize: Must be an admin
        const callerToken = await validateFirebaseToken(request);
        if (!callerToken || callerToken.role !== 'admin') {
            return { status: 403, headers: corsHeaders, body: "Forbidden: You do not have permission to view users." };
        }

        try {
            // 2. If authorized, get all user documents from Firestore
            const db = admin.firestore();
            const usersSnapshot = await db.collection('users').get();
            const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            return { status: 200, headers: corsHeaders, jsonBody: usersList };

        } catch (error) {
            context.log("Error fetching users:", error);
            return { status: 500, headers: corsHeaders, body: "An error occurred while fetching users." };
        }
    }
});