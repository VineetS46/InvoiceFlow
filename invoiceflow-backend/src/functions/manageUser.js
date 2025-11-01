// invoiceflow-backend/src/functions/manageUser.js (FINAL with Edit & Delete)

const { app } = require('@azure/functions');
const admin = require('../helpers/firebaseAdmin');
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const db = admin.firestore();

const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-workspace-id'
};

app.http('manageUser', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        try {
            // Standard Auth check (no changes here)
            const decodedToken = await validateFirebaseToken(request);
            if (!decodedToken) { return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized." } }; }
            const callerDoc = await db.collection('users').doc(decodedToken.uid).get();
            if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
                return { status: 403, headers: corsHeaders, jsonBody: { error: "Forbidden: You do not have permission." } };
            }

            // --- THIS IS THE FIX ---
            const body = await request.json();
            const action = body.action;
            const newData = body.newData;
            // We check for 'targetUserId' first, and if it's not there, we fall back to 'userId'.
            const finalTargetUserId = body.targetUserId || body.userId; 
            // --- END OF FIX ---

            if (!action || !finalTargetUserId) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "Missing action or targetUserId." } };
            }

            // --- DELETE ACTION ---
            if (action === 'delete') {
                const targetUserDoc = await db.collection('users').doc(finalTargetUserId).get();
                if (!targetUserDoc.exists) { return { status: 404, headers: corsHeaders, jsonBody: { error: "Target user not found." } }; }
                if (targetUserDoc.data().role === 'admin') {
                    return { status: 400, headers: corsHeaders, jsonBody: { error: "Cannot delete an admin. Demote to 'user' first." } };
                }
                await admin.auth().deleteUser(finalTargetUserId);
                await db.collection('users').doc(finalTargetUserId).delete();
                return { status: 200, headers: corsHeaders, jsonBody: { message: `User ${finalTargetUserId} deleted.` } };
            }

            // --- EDIT ACTION ---
            else if (action === 'edit') {
                if (!newData) { return { status: 400, headers: corsHeaders, jsonBody: { error: "Missing 'newData' for edit action." } }; }

                const firestoreUpdate = {};
                const authUpdate = {};

                if (newData.displayName) {
                    firestoreUpdate.displayName = newData.displayName;
                    authUpdate.displayName = newData.displayName;
                }
                
                if (Object.keys(authUpdate).length > 0) { await admin.auth().updateUser(finalTargetUserId, authUpdate); }
                if (Object.keys(firestoreUpdate).length > 0) { await db.collection('users').doc(finalTargetUserId).update(firestoreUpdate); }

                return { status: 200, headers: corsHeaders, jsonBody: { message: `User ${finalTargetUserId} updated.` } };
            }

            return { status: 400, headers: corsHeaders, jsonBody: { error: `Invalid action: ${action}` } };

        } catch (error) {
            context.log.error("Error in manageUser:", error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An internal server error occurred." } };
        }
    }
});