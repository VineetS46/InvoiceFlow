// invoiceflow-backend/src/functions/adminData.js (FINAL V2 - Full Code)

const { app } = require('@azure/functions');
const admin = require('../helpers/firebaseAdmin');
const cosmosClient = require('../helpers/cosmosClient'); // Ensure you have this helper for Cosmos DB
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const db = admin.firestore();

// Define CORS headers once to be used by all responses
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-workspace-id'
};

/**
 * Main handler that acts as a secure gateway for all admin actions.
 * It authenticates and authorizes the caller before routing to the correct sub-function.
 */
const adminDataHandler = async (request, context) => {
    // 1. Authenticate the user making the request
    const decodedToken = await validateFirebaseToken(request);
    if (!decodedToken) {
        return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized." } };
    }

    // 2. CRITICAL: Authorize the caller by checking their role in the Firestore 'users' document
    const callerId = decodedToken.uid;
    const callerDoc = await db.collection('users').doc(callerId).get();
    if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
        return { status: 403, headers: corsHeaders, jsonBody: { error: "Forbidden: You do not have permission to perform this action." } };
    }

    // 3. If authorized, route to the correct logic based on the 'queryType' parameter
    const queryType = request.query.get('queryType');

    switch (queryType) {
        case 'workspacesForUser':
            return getWorkspacesForUser(request, context);
        case 'invoicesForWorkspace':
            return getInvoicesForWorkspace(request, context);
        case 'allInvoices':
            return getAllInvoices(request, context);
        default:
            return { status: 400, headers: corsHeaders, jsonBody: { error: "Invalid or missing 'queryType' parameter." } };
    }
};

// --- Action-Specific Helper Functions ---

/**
 * Fetches all workspaces a specific user is a member of.
 */
const getWorkspacesForUser = async (request, context) => {
    const targetUserId = request.query.get('userId');
    if (!targetUserId) {
        return { status: 400, headers: corsHeaders, jsonBody: { error: "Missing 'userId' query parameter." } };
    }

    const workspacesSnapshot = await db.collection('workspaces').where('members', 'array-contains', targetUserId).get();

    if (workspacesSnapshot.empty) {
        return { status: 200, headers: corsHeaders, jsonBody: [] };
    }

    const workspaces = workspacesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        userRole: doc.data().memberRoles[targetUserId] || 'member'
    }));

    return { status: 200, headers: corsHeaders, jsonBody: workspaces };
};

/**
 * Fetches all invoices belonging to a specific workspace.
 */
const getInvoicesForWorkspace = async (request, context) => {
    const targetWorkspaceId = request.query.get('workspaceId');
    if (!targetWorkspaceId) {
        return { status: 400, headers: corsHeaders, jsonBody: { error: "Missing 'workspaceId' query parameter." } };
    }

   const container = cosmosClient.container;
    const querySpec = {
        query: "SELECT * FROM c WHERE c.workspaceId = @workspaceId AND c.docType = 'invoice'",
        parameters: [{ name: "@workspaceId", value: targetWorkspaceId }]
    };

    const { resources: invoices } = await container.items.query(querySpec).fetchAll();
    return { status: 200, headers: corsHeaders, jsonBody: invoices };
};

/**
 * Fetches ALL invoices from the entire database and enriches them with user info.
 */
const getAllInvoices = async (request, context) => {
    const container = cosmosClient.container;
    const { resources: invoices } = await container.items.query("SELECT * FROM c ORDER BY c.uploadedAt DESC").fetchAll();

    if (!invoices || invoices.length === 0) {
        return { status: 200, headers: corsHeaders, jsonBody: [] };
    }
    
    // Create a map of user IDs to display names for data enrichment
    const userRecords = await admin.auth().listUsers(1000); // Note: For >1000 users, pagination is needed.
    const userMap = {};
    userRecords.users.forEach(user => {
        userMap[user.uid] = user.displayName || user.email;
    });

    const enrichedInvoices = invoices.map(invoice => ({
        ...invoice,
        uploaderName: userMap[invoice.uploadedBy] || 'Unknown User'
    }));

    return { status: 200, headers: corsHeaders, jsonBody: enrichedInvoices };
};


// --- Register the function with Azure ---

app.http('adminData', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'platform-data',
    handler: async (request, context) => {
        // Handle CORS preflight request
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }
        try {
            // Pass all requests to our secure handler
            return await adminDataHandler(request, context);
        } catch (error) {
            context.error("Unhandled error in adminData function:", error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An internal server error occurred." } };
        }
    }
});