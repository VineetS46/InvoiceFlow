// invoice-backend/src/functions/getUploadUrl.js (FINAL CORS FIX)

const { app } = require('@azure/functions');
const { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions } = require("@azure/storage-blob");
const { v4: uuidv4 } = require('uuid');
const { validateFirebaseToken } = require('../helpers/firebase-auth');

const CONTAINER_NAME = "invoice-raw";
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';

// --- THIS IS THE CRITICAL CHANGE ---
// Define the headers once in a constant.
const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

app.http('getUploadUrl', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // Handle the pre-flight request
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        const decodedToken = await validateFirebaseToken(request);
        if (!decodedToken) {
            // Add headers to the error response
            return { status: 401, headers: corsHeaders, body: "Unauthorized: Invalid or missing token." };
        }
        const userId = decodedToken.uid;
        context.log(`Request authenticated for user: ${userId}`);

        const originalFileName = request.query.get('fileName');
        if (!originalFileName) {
            // Add headers to the error response
            return { status: 400, headers: corsHeaders, body: "Please provide a 'fileName' query parameter." };
        }
        const fileExtension = originalFileName.split('.').pop();
        const newUniqueFileName = `${uuidv4()}.${fileExtension}`;

        try {
            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
            const blobClient = containerClient.getBlobClient(newUniqueFileName);
            
            const sasToken = generateBlobSASQueryParameters({
                containerName: CONTAINER_NAME,
                blobName: newUniqueFileName,
                permissions: BlobSASPermissions.parse("w"),
                startsOn: new Date(),
                expiresOn: new Date(Date.now() + 5 * 60 * 1000)
            }, blobServiceClient.credential).toString();

            const sasUrl = `${blobClient.url}?${sasToken}`;
            
            return {
                status: 200,
                headers: corsHeaders, // Add headers to the SUCCESSFUL response
                jsonBody: {
                    success: true,
                    uploadUrl: sasUrl,
                    fileName: newUniqueFileName
                }
            };
        } catch (error) {
            context.log.error("Error generating SAS URL:", error.message);
            // Add headers to the error response
            return { status: 500, headers: corsHeaders, body: "An error occurred on the server." };
        }
    }
});