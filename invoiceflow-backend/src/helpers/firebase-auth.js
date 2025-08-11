
const admin = require('firebase-admin');

// Initialize the Firebase Admin SDK once when the server starts
try {
  // We securely parse the service account JSON from our settings file
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  
  // Check if the app is already initialized to prevent errors
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (e) {
  console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT or initialize Firebase Admin SDK:', e);
}

/**
 * Validates a Firebase ID token from an HTTP request's Authorization header.
 * @param {object} request - The Azure Function request object.
 * @returns {Promise<object|null>} The decoded token payload (which includes uid, email, etc.) or null if invalid.
 */
async function validateFirebaseToken(request) {
  const authorizationHeader = request.headers.get('authorization');
  
  // Check if the 'Authorization' header exists and is in the correct 'Bearer <token>' format
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return null;
  }

  // Extract the token string
  const token = authorizationHeader.split('Bearer ')[1];
  
  try {
    // Use the Firebase Admin SDK to verify the token is valid
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error.message);
    return null; // Return null if the token is expired, invalid, or verification fails
  }
}

// Export the helper function so other files can use it
module.exports = { validateFirebaseToken };