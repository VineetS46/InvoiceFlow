// invoiceflow-backend/src/functions/getUsers.js (CORRECTED & SECURE)

const { app } = require('@azure/functions');
const admin = require('../helpers/firebaseAdmin');
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const db = admin.firestore();

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const corsHeaders = {
   'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-workspace-id'
};

app.http('getUsers', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        try {
            // 1. Authenticate the user making the request
            const decodedToken = await validateFirebaseToken(request);
            if (!decodedToken) {
                return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized." } };
            }

            // *** THE CRITICAL FIX ***
            // 2. Authorize by checking the user's role in their FIRESTORE document
            const callerId = decodedToken.uid;
            const callerDoc = await db.collection('users').doc(callerId).get();

          if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
                return { status: 403, headers: corsHeaders, jsonBody: { error: "Forbidden: You do not have permission." } };
            }

            const usersSnapshot = await db.collection('users').get();
            const usersList = usersSnapshot.docs.map(doc => ({ 
                id: doc.id,
                ...doc.data() 
            }));

            return { status: 200, headers: corsHeaders, jsonBody: usersList };

        } catch (error) {
            // Log the detailed error to the console for easier debugging in the future
            context.log.error("Error in getUsers:", error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An internal server error occurred." } };
        }
    }
});