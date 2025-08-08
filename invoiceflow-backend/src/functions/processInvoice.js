const { app } = require('@azure/functions');
const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");

app.storageBlob('processInvoice', {
    path: 'invoice-raw/{name}',
    connection: 'AZURE_STORAGE_CONNECTION_STRING',
    handler: async (invoiceBlob, context) => {
        context.log(`Processing invoice: ${context.triggerMetadata.name} (${invoiceBlob.length} Bytes)`);

        // --- 1. Get AI Service credentials ---
        const endpoint = process.env.AZURE_DOC_INTEL_ENDPOINT;
        const key = process.env.AZURE_DOC_INTEL_KEY;

        if (!endpoint || !key) {
            context.log.error("AI service endpoint or key is not set.");
            return;
        }

        try {
            // --- 2. Call the AI Service ---
            const credential = new AzureKeyCredential(key);
            const client = new DocumentAnalysisClient(endpoint, credential);
            const poller = await client.beginAnalyzeDocument("prebuilt-invoice", invoiceBlob);
            const { documents } = await poller.pollUntilDone();
            
            context.log("--- Analysis Complete ---");

            // --- 3. Extract and log the results ---
            const invoice = documents[0];
            if (invoice) {
                const vendorName = invoice.fields.VendorName?.value || 'N/A';
                // The InvoiceTotal field is an object; we need to access its 'amount' property.
                const invoiceTotalAmount = invoice.fields.InvoiceTotal?.value?.amount || 'N/A';
                const invoiceDate = invoice.fields.InvoiceDate?.value || 'N/A';

                context.log(`Vendor: ${vendorName}`);
                context.log(`Date: ${invoiceDate}`);
                context.log(`Total: ${invoiceTotalAmount}`);
                
                // TODO: Save the extracted data to a Cosmos DB database.
                
            } else {
                context.log.warn("No invoice document found in the result.");
            }

        } catch (error) {
            context.log.error("An error occurred during AI analysis:", error.message);
        }
    }
});