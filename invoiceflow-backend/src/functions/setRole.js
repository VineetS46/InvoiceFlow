// invoiceflow-backend/src/functions/setRole.js (FINAL & CORRECTED)

const { app } = require('@azure/functions');
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const admin = require('../helpers/firebaseAdmin');
const db = admin.firestore();

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const corsHeaders = {
   'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-workspace-id'
};

// Renamed to 'setRole' to match the frontend API call
app.http('setRole', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        try {
            // 1. Authenticate the user just ONCE at the beginning
            const decodedToken = await validateFirebaseToken(request);
            if (!decodedToken) {
                return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized." } };
            }

            // 2. Perform the SINGLE, CORRECT security check: Is the caller an admin in Firestore?
            const callerId = decodedToken.uid;
            const callerDoc = await db.collection('users').doc(callerId).get();
            if (!callerDoc.exists() || callerDoc.data().role !== 'admin') {
                return { status: 403, headers: corsHeaders, jsonBody: { error: "Forbidden: You do not have permission to perform this action." } };
            }

            // 3. If the check passes, proceed with the logic
            const { userId, role } = await request.json();
            if (!userId || !role) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "Missing userId or role in request body." } };
            }

            const userRef = db.collection('users').doc(userId);
            await userRef.update({ role: role });

            return { status: 200, headers: corsHeaders, jsonBody: { message: `Successfully set role for user ${userId} to ${role}.` } };

        } catch (error) {
            context.log.error('Error in setUserRole:', error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: 'Internal Server Error' } };
        }
    }
});