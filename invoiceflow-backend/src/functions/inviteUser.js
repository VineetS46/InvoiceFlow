const { app } = require('@azure/functions');
const { v4: uuidv4 } = require("uuid");
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const admin = require('../helpers/firebaseAdmin');
const db = admin.firestore();

app.http('inviteUser', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
        const corsHeaders = {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-workspace-id'
        };

        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        try {
            const decodedToken = await validateFirebaseToken(request);
            if (!decodedToken) {
                return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized" } };
            }
            const inviterId = decodedToken.uid;
            
            const workspaceId = request.headers.get('x-workspace-id');
            const { email: inviteeEmail, role, workspaceName } = await request.json();

            if (!workspaceId || !inviteeEmail || !role || !workspaceName) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "Missing required fields." } };
            }

            // Security Check 1: Verify the inviter is the owner of the workspace
            const userDocRef = db.collection('users').doc(inviterId);
            const userDoc = await userDocRef.get();
            if (!userDoc.exists || userDoc.data().workspaces?.[workspaceId] !== 'owner') {
                return { status: 403, headers: corsHeaders, jsonBody: { error: "Forbidden: You must be the owner of the workspace to invite users." } };
            }
            
            // --- THIS IS THE NEW VALIDATION LOGIC ---
            // Security Check 2: Verify the invitee is not already a member
            const usersRef = db.collection("users");
            const userQuery = usersRef.where("email", "==", inviteeEmail.toLowerCase());
            const existingUserSnapshot = await userQuery.get();

            if (!existingUserSnapshot.empty) {
                const existingUserDoc = existingUserSnapshot.docs[0];
                if (existingUserDoc.data().workspaces?.[workspaceId]) {
                    // This user already exists and is part of this workspace
                    return { status: 409, headers: corsHeaders, jsonBody: { error: "This user is already a member of this workspace." } };
                }
            }
            // --- END OF NEW LOGIC ---

            // Security Check 3: Check for an existing PENDING invite
            const invitesRef = db.collection("invites");
            const inviteQuery = invitesRef.where("email", "==", inviteeEmail.toLowerCase()).where("workspaceId", "==", workspaceId).where("status", "==", "pending");
            const existingInvites = await inviteQuery.get();
            if (!existingInvites.empty) {
                return { status: 409, headers: corsHeaders, jsonBody: { error: "A pending invitation for this email address to this workspace already exists." } };
            }

            // If all checks pass, create the new invite document
            const newInviteId = `inv_${uuidv4()}`;
            const inviteDocRef = db.collection('invites').doc(newInviteId);
            const newInvite = {
                inviteId: newInviteId,
                workspaceId: workspaceId,
                workspaceName: workspaceName,
                email: inviteeEmail.toLowerCase(),
                role: role,
                invitedBy: inviterId,
                status: "pending",
                createdAt: new Date().toISOString()
            };

            await inviteDocRef.set(newInvite);

            return { status: 201, headers: corsHeaders, jsonBody: { message: `Invitation sent to ${inviteeEmail}.`, invite: newInvite } };

        } catch (error) {
            context.error("Error in inviteUser:", error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An internal server error occurred." } };
        }
    }
});