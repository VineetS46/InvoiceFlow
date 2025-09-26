const { app } = require('@azure/functions');
const { db } = require('../helpers/firebaseAdmin');
const { verifyFirebaseToken, requireAdmin } = require('../helpers/firebase-auth');

app.http('adminSetAdminStatus', {
    methods: ['POST'],
    authLevel: 'anonymous',
    // V2.5 FIX: Renamed route from 'admin' to 'management' to avoid conflict
    route: 'management/users/{targetUid}',
    handler: async (req, context) => {
        // ... the rest of the handler function code remains exactly the same ...
        context.log('HTTP trigger function processed a request for adminSetAdminStatus.');

        const decodedToken = await verifyFirebaseToken(req, context);
        if (!decodedToken) return context.res;
        req.user = decodedToken;

        const adminUser = await requireAdmin(req, context);
        if (!adminUser) return context.res;

        const { targetUid } = req.params;
        const { isAdmin } = await req.json();

        if (typeof isAdmin !== 'boolean') {
            return { status: 400, body: 'Request body must include an "isAdmin" boolean field.' };
        }
        if (adminUser.uid === targetUid && isAdmin === false) {
            return { status: 403, body: 'Forbidden: You cannot revoke your own admin privileges.' };
        }
        try {
            const userRef = db.collection('users').doc(targetUid);
            const userDoc = await userRef.get();
            if (!userDoc.exists()) {
                return { status: 404, body: 'Target user not found.' };
            }
            await userRef.update({ isAdmin: isAdmin });
            return { status: 200, body: `User's admin status updated successfully.` };
        } catch (error) {
            context.log.error('Error updating user admin status:', error);
            return { status: 500, body: 'Failed to update user status.' };
        }
    }
});