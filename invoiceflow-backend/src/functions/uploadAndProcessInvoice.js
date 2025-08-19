const { app } = require('@azure/functions');
const { BlobServiceClient } = require("@azure/storage-blob");
const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");
const { validateFirebaseToken } = require('../helpers/firebase-auth');

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

function cleanDescription(description) {
    if (!description) return 'N/A';
    const stopWords = ['warranty:', 'imei/serial no:', 'hsn/sac:', 'fsn:'];
    let cleanDesc = description;
    for (const word of stopWords) {
        if (cleanDesc.toLowerCase().includes(word)) {
            cleanDesc = cleanDesc.substring(0, cleanDesc.toLowerCase().indexOf(word));
        }
    }
    return cleanDesc.replace(/\s+/g, ' ').trim();
}

app.http('uploadAndProcessInvoice', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        const decodedToken = await validateFirebaseToken(request);
        if (!decodedToken) {
            return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized." } };
        }
        const userId = decodedToken.uid;

        try {
            const formData = await request.formData();
            const file = formData.get('invoiceFile');
            if (!file) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "No file uploaded." } };
            }
            const fileBuffer = Buffer.from(await file.arrayBuffer());

            const aiClient = new DocumentAnalysisClient(process.env.AZURE_DOC_INTEL_ENDPOINT, new AzureKeyCredential(process.env.AZURE_DOC_INTEL_KEY));
            const poller = await aiClient.beginAnalyzeDocument("prebuilt-invoice", fileBuffer);
            const { documents } = await poller.pollUntilDone();
            const invoice = documents[0];
            if (!invoice) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "Could not analyze the document." } };
            }

            const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_CONNECTION_STRING);
            const container = cosmosClient.database("InvoiceDB").container("Invoices");
            
            const invoiceId = invoice.fields.InvoiceId?.content;
            const vendorName = invoice.fields.VendorName?.content;
            const invoiceDate = invoice.fields.InvoiceDate?.value;
            const invoiceTotal = invoice.fields.InvoiceTotal?.value?.amount;
            const subTotal = invoice.fields.SubTotal?.value?.amount;

            if (invoiceId) {
                const { resources: existing } = await container.items.query({ query: "SELECT c.id FROM c WHERE c.userId = @userId AND c.invoiceId = @invoiceId", parameters: [{ name: "@userId", value: userId }, { name: "@invoiceId", value: invoiceId }] }).fetchAll();
                if (existing.length > 0) {
                    return { status: 409, headers: corsHeaders, jsonBody: { error: `Duplicate: An invoice with ID '${invoiceId}' already exists.` } };
                }
            } else if (vendorName && invoiceDate && invoiceTotal) {
                const fingerprint = `${vendorName}-${new Date(invoiceDate).toISOString().split('T')[0]}-${invoiceTotal}`;
                const { resources: existing } = await container.items.query({ query: "SELECT c.id FROM c WHERE c.userId = @userId AND c.fingerprint = @fingerprint", parameters: [{ name: "@userId", value: userId }, { name: "@fingerprint", value: fingerprint }] }).fetchAll();
                if (existing.length > 0) {
                    return { status: 409, headers: corsHeaders, jsonBody: { error: `Duplicate: An invoice from '${vendorName}' for the same amount and date already exists.` } };
                }
            }
            
            let uniqueLineItems = [];
            if (invoice.fields.Items?.values) {
                const rawLineItems = invoice.fields.Items.values.map(item => ({
                    description: cleanDescription(item.properties.Description?.content),
                    quantity: item.properties.Quantity?.value || 1,
                    unitPrice: item.properties.UnitPrice?.value?.amount || 0,
                    amount: item.properties.Amount?.value?.amount || 0,
                    discount: item.properties.Discount?.value?.amount || 0,
                }));
                uniqueLineItems = Array.from(new Map(rawLineItems.map(item =>
                    [`${item.description}-${item.amount}`, item]
                )).values());
            }
            
            // --- SMART TAX CALCULATION ---
            let calculatedTax = 0;
            if (typeof subTotal === 'number' && typeof invoiceTotal === 'number' && invoiceTotal > subTotal) {
                calculatedTax = invoiceTotal - subTotal;
            } else {
                calculatedTax = invoice.fields.TotalTax?.value?.amount || 0;
            }
            // ---

            const newFileName = `${uuidv4()}.${file.name.split('.').pop()}`;
            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
            await blobServiceClient.getContainerClient("invoice-raw").getBlockBlobClient(newFileName).uploadData(fileBuffer);
            
            const invoiceDateObj = new Date(invoiceDate || new Date());
            let dueDate = invoice.fields.DueDate?.value ? new Date(invoice.fields.DueDate.value) : new Date(new Date(invoiceDateObj).setDate(invoiceDateObj.getDate() + 30));
            let initialStatus = "pending";
            if (new Date(invoiceDateObj).getTime() < new Date().setMonth(new Date().getMonth() - 2)) { initialStatus = "paid"; }

            const newItem = {
                id: uuidv4(),
                userId: userId,
                invoiceId: invoiceId || null,
                fingerprint: invoiceId ? null : `${vendorName}-${invoiceDateObj.toISOString().split('T')[0]}-${invoiceTotal}`,
                fileName: newFileName,
                status: initialStatus,
                
                vendorName: vendorName || 'N/A',
                vendorAddress: invoice.fields.VendorAddress?.content,
                customerName: invoice.fields.CustomerName?.content || decodedToken.name || 'N/A',
                customerAddress: invoice.fields.CustomerAddress?.content,
                
                invoiceDate: invoiceDateObj,
                dueDate: dueDate,
                
                invoiceTotal: invoiceTotal || 0,
                subTotal: subTotal,
                totalTax: calculatedTax,
                currency: invoice.fields.InvoiceTotal?.value?.symbol || 'INR', 
                
                lineItems: uniqueLineItems,
                
                uploadedAt: new Date(),
                paymentDate: initialStatus === 'paid' ? invoiceDateObj : null
            };

            const { resource: createdItem } = await container.items.create(newItem);

            return { status: 201, headers: corsHeaders, jsonBody: createdItem };

        } catch (error) {
            context.error("Error in uploadAndProcessInvoice:", error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An internal server error occurred." } };
        }
    }
});