// invoiceflow-backend/src/functions/setRole.js (CORRECTED)
const { app } = require('@azure/functions');
const admin = require('../helpers/firebaseAdmin'); // Now this file exists
const { validateFirebaseToken } = require('../helpers/firebase-auth'); // This is our other helper

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

app.http('setRole', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        const callerToken = await validateFirebaseToken(request);
        
        // IMPORTANT: The role is on the decoded token itself, not a sub-property
        if (!callerToken || callerToken.role !== 'admin') {
            return { status: 403, headers: corsHeaders, body: "Forbidden: You do not have permission." };
        }
        
        let targetUid, newRole;
        try {
            const body = await request.json();
            targetUid = body.uid;
            newRole = body.role;
        } catch (e) {
            return { status: 400, headers: corsHeaders, body: "Invalid request body." };
        }

        if (!targetUid || !['admin', 'user'].includes(newRole)) {
            return { status: 400, headers: corsHeaders, body: "Please provide a valid 'uid' and 'role'." };
        }

        try {
            await admin.auth().setCustomUserClaims(targetUid, { role: newRole });

            const db = admin.firestore();
            await db.collection('users').doc(targetUid).update({ role: newRole });

            context.log(`Admin ${callerToken.uid} set role of user ${targetUid} to '${newRole}'`);
            return { status: 200, headers: corsHeaders, body: `Successfully set role for user ${targetUid} to '${newRole}'.` };

        } catch (error) {
            context.log(`Error setting role for user ${targetUid}:`, error.message);
            return { status: 500, headers: corsHeaders, body: "An error occurred." };
        }
    }
});