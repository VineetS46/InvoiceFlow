// invoice-backend/src/functions/processInvoice.js

// Import required libraries from Azure Functions and third-party packages.
const { app, output } = require('@azure/functions');
const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");

// Define the connection to our Cosmos DB database.
// This is an "Output Binding" that lets us save data with just one line of code.
const cosmosOutput = output.cosmosDB({
    databaseName: 'InvoiceDB',
    containerName: 'Invoices',
    connection: 'COSMOS_DB_CONNECTION_STRING', // Reads the secret key from settings
    createIfNotExists: true,
});

// Configure the main function.
app.storageBlob('processInvoice', {
    // This function will automatically run when a new file appears in 'invoice-raw'.
    path: 'invoice-raw/{name}',
    connection: 'AZURE_STORAGE_CONNECTION_STRING',
    
    // Link the Cosmos DB output binding we defined above to this function.
    extraOutputs: [cosmosOutput], 
    
    // This is the main handler function that executes on a trigger.
    handler: async (invoiceBlob, context) => {
        context.log(`Processing invoice blob: ${context.triggerMetadata.name}`);
        
        // Securely load credentials from environment variables (local.settings.json).
        const endpoint = process.env.AZURE_DOC_INTEL_ENDPOINT;
        const key = process.env.AZURE_DOC_INTEL_KEY;

        if (!endpoint || !key) {
            context.log("Error: AI service endpoint or key is not set.");
            return;
        }

        try {
            // Create the client to connect to the Document Intelligence AI service.
            const credential = new AzureKeyCredential(key);
            const client = new DocumentAnalysisClient(endpoint, credential);

            // Send the uploaded file (invoiceBlob) to the AI for analysis.
            const poller = await client.beginAnalyzeDocument("prebuilt-invoice", invoiceBlob);
            
            // Wait for the AI to finish reading the document.
            const { documents } = await poller.pollUntilDone();
            
            context.log("--- Invoice Analysis Complete ---");

            const invoice = documents[0];
            if (invoice) {
                // Create a clean JSON object with the extracted data.
                const invoiceDataToSave = {
                    id: context.triggerMetadata.name, // Use filename as a unique ID
                    userId: "user-123-abc", // This is temporary, will be dynamic later
                    fileName: context.triggerMetadata.name,
                    vendor: invoice.fields.VendorName?.value || 'N/A',
                    total: invoice.fields.InvoiceTotal?.value?.amount || 0,
                    invoiceDate: invoice.fields.InvoiceDate?.value || null,
                    status: 'processed',
                    uploadedOn: new Date()
                };

                // Save the structured data to Cosmos DB using the output binding.
                // This single line handles the entire database operation.
                context.extraOutputs.set(cosmosOutput, invoiceDataToSave);

                context.log(`Successfully extracted and saved data for invoice: ${invoiceDataToSave.id}`);
            } else {
                context.log("Warning: No invoice document found in the result.");
            }
        } catch (error) {
            // Log any errors that occur during the process.
            context.log("Error during processing:", error.message);
        }
    }
});