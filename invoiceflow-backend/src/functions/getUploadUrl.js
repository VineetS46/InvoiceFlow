// invoice-backend/src/functions/getUploadUrl.js

const { app } = require('@azure/functions');
const { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions, generateBlobSASQueryParameters } = require("@azure/storage-blob");

// These values should match your Azure Storage account and container
const ACCOUNT_NAME = "invoiceflow46"; // Your storage account name
const CONTAINER_NAME = "invoice-raw"; // The container you created

app.http('getUploadUrl', {
    methods: ['GET'],
    authLevel: 'anonymous', // We will secure this later if needed
    handler: async (request, context) => {
        context.log(`HTTP trigger function processed a request for getUploadUrl.`);

        // --- 1. Get the Connection String from local.settings.json ---
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            context.log.error("Azure Storage connection string is not set.");
            return { status: 500, body: "Server configuration error: Storage connection string missing." };
        }

        // --- 2. Get the file name from the request query ---
        // Example: /api/getUploadUrl?fileName=my-invoice.pdf
        const fileName = request.query.get('fileName');
        if (!fileName) {
            return { status: 400, body: "Please provide a 'fileName' query parameter." };
        }

        try {
            // --- 3. Create a BlobServiceClient ---
            const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
            const blobClient = containerClient.getBlobClient(fileName);

            // --- 4. Define the SAS Token options ---
            // This token will grant temporary WRITE permission for one specific file
            const sasOptions = {
                containerName: CONTAINER_NAME,
                blobName: fileName,
                permissions: BlobSASPermissions.parse("w"), // "w" grants Write permission
                startsOn: new Date(),
                expiresOn: new Date(new Date().valueOf() + 10 * 60 * 1000) // URL is valid for 10 minutes
            };
            
            // --- 5. Generate the SAS Token ---
            // The SDK uses the account key from the connection string to sign this token
            const sasToken = generateBlobSASQueryParameters(
                sasOptions,
                blobServiceClient.credential
            ).toString();

            // --- 6. Construct the full URL ---
            const sasUrl = `${blobClient.url}?${sasToken}`;
            
            context.log(`Successfully generated SAS URL for ${fileName}`);

            // --- 7. Return the secure URL to the client ---
            return {
    status: 200,
    headers: {
        'Access-Control-Allow-Origin': 'http://localhost:3000'
    },
    jsonBody: {
        success: true,
        message: "Secure upload URL generated successfully.",
        uploadUrl: sasUrl,
        fileName: fileName
    }
};

        } catch (error) {
            context.log.error("Error generating SAS URL:", error.message);
            return { status: 500, body: "An error occurred on the server." };
        }
    }
});