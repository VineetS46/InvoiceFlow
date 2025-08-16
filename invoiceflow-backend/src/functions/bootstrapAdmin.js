// invoiceflow-backend/src/functions/bootstrapAdmin.js (ONE-TIME USE)
const { app } = require('@azure/functions');
const admin = require('../helpers/firebaseAdmin');

app.http('bootstrapAdmin', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // --- IMPORTANT: Paste YOUR actual User ID (UID) here ---
        // You can get this from your user document in Firestore.
        const firstAdminUid = "014aL9a8G0MrAf8EZE6kYyf8PNp2"; 
        
        try {
            // This sets a "custom claim" on your Firebase token.
            await admin.auth().setCustomUserClaims(firstAdminUid, { role: 'admin' });
            context.log(`Successfully set 'admin' role claim for user ${firstAdminUid}`);
            return { body: `Success! The 'admin' role has been set for user ${firstAdminUid}. You should now DELETE this function.` };
        } catch (error) {
            context.log.error(`Error bootstrapping admin role:`, error);
            return { status: 500, body: "Failed to set admin role." };
        }
    }
});