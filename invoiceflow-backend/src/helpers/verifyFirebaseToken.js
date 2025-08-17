// invoiceflow-backend/src/helpers/verifyFirebaseToken.js
const admin = require('./firebaseAdmin');

async function verifyFirebaseToken(request) {
    const authorizationHeader = request.headers.get('authorization');

    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        return { error: 'Unauthorized', status: 401 };
    }

    const idToken = authorizationHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        // Return the full decoded token, which includes uid, email, and custom claims like 'role'
        return { decodedToken }; 
    } catch (error) {
        return { error: 'Invalid token', status: 403 };
    }
}

module.exports = verifyFirebaseToken;