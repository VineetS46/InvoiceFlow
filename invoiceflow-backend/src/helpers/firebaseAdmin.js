// invoiceflow-backend/src/helpers/firebaseAdmin.js (FINAL, ROBUST INITIALIZATION)
const admin = require('firebase-admin');

// This block ensures the SDK is initialized only once.
try {
  // Check if the app is already initialized to prevent errors on hot-reloads.
  if (admin.apps.length === 0) {
    
    // --- THIS IS THE CRITICAL FIX ---
    // We explicitly parse the service account JSON from our settings file.
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccountString) {
      throw new Error("The FIREBASE_SERVICE_ACCOUNT environment variable is not set. Please check your local.settings.json file.");
    }
    
    const serviceAccount = JSON.parse(serviceAccountString);

    // We explicitly initialize the app with the parsed credentials.
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log("Firebase Admin SDK initialized successfully.");
  }
} catch (e) {
  console.error('CRITICAL ERROR: Failed to initialize Firebase Admin SDK. Please check the FIREBASE_SERVICE_ACCOUNT in your local.settings.json file.', e);
}

// Export the initialized admin object for use in other functions
module.exports = admin;