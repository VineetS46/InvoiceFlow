// invoice-backend/src/functions/processInvoice.js (FINAL, CORRECTED LOGGING)

const { app } = require('@azure/functions');
const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");

app.storageBlob('processInvoice', {
    path: 'invoice-raw/{name}',
    connection: 'AZURE_STORAGE_CONNECTION_STRING',
    handler: async (invoiceBlob, context) => {
        context.log(`Processing invoice blob: ${context.triggerMetadata.name}`);

        // Initialize Cosmos DB client inside the handler
        const cosmosConnectionString = process.env.AZURE_COSMOS_CONNECTION_STRING;
        if (!cosmosConnectionString) {
            // Use context.log for all log levels
            context.log("Error: Azure Cosmos DB connection string is not set.");
            return;
        }
        const cosmosClient = new CosmosClient(cosmosConnectionString);
        const database = cosmosClient.database("InvoiceDB");
        const container = database.container("Invoices");
        
        const userId = context.triggerMetadata.metadata.userid;
        if (!userId) {
            // Use context.log for all log levels
            context.log(`Error: Blob ${context.triggerMetadata.name} is missing 'userid' metadata. Skipping.`);
            return;
        }
        context.log(`Invoice belongs to user: ${userId}`);

        const endpoint = process.env.AZURE_DOC_INTEL_ENDPOINT;
        const key = process.env.AZURE_DOC_INTEL_KEY;

        try {
            // 1. Analyze with Document Intelligence
            const credential = new AzureKeyCredential(key);
            const client = new DocumentAnalysisClient(endpoint, credential);
            const poller = await client.beginAnalyzeDocument("prebuilt-invoice", invoiceBlob);
            const { documents } = await poller.pollUntilDone();
            const invoice = documents[0];

            if (invoice) {
                // 2. Extract data
                const vendorName = invoice.fields.VendorName?.value || 'N/A';
                const invoiceTotalObject = invoice.fields.InvoiceTotal?.value;
                const invoiceTotal = invoiceTotalObject?.amount || 0;
                const invoiceDate = invoice.fields.InvoiceDate?.value || new Date();

                // 3. Create the database item
                const newItem = {
                    id: uuidv4(),
                    userId: userId,
                    fileName: context.triggerMetadata.name,
                    status: "processed",
                    vendorName: vendorName,
                    invoiceDate: invoiceDate,
                    invoiceTotal: invoiceTotal,
                    uploadedAt: new Date()
                };

                // 4. Save to Cosmos DB
                const { resource: createdItem } = await container.items.create(newItem);
                context.log(`Successfully saved processed invoice data for user ${userId} with id: ${createdItem.id}`);
            } else {
                // Use context.log for all log levels
                context.log(`Warning: No invoice document found in the result for blob ${context.triggerMetadata.name}.`);
            }

        } catch (error) {
            // Use context.log for all log levels
            context.log(`Error: An error occurred during invoice processing for blob ${context.triggerMetadata.name}:`, error.message);
        }
    }
});