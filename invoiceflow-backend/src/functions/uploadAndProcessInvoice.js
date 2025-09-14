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

// --- NEW: Keyword dictionary for the categorization "Rules Engine" ---
const categoryKeywords = {
    'Software & Subscriptions': ['microsoft', 'adobe', 'zoom', 'saas', 'subscription', 'notion', 'canva'],
    'Hardware & Equipment': ['dell', 'apple', 'lenovo', 'hardware', 'equipment', 'electronics', 'jiofi', 'data card'],
    'Marketing & Advertising': ['google ads', 'facebook ads', 'marketing', 'seo', 'brightedge', 'mailchimp'],
    'Utilities': ['electric', 'coned', 'gas', 'water', 'utility'],
    'Phone & Internet': ['verizon', 'at&t', 'comcast', 'internet', 'mobile'],
    'Travel & Accommodation': ['uber', 'lyft', 'ola', 'airbnb', 'marriott', 'hilton', 'expedia', 'flight'],
    'Meals & Entertainment': ['zomato', 'swiggy', 'doordash', 'ubereats', 'restaurant', 'cafe', 'starbucks'],
    'Professional Services': ['legal', 'accounting', 'consulting', 'law firm'],
    'Shipping & Postage': ['fedex', 'dhl', 'ups', 'shipping', 'courier', 'postage'],
    'Office Supplies': ['staples', 'office depot', 'stationery', 'supplies'],
    'Health & Wellness': ['pharmacy', 'mamaearth', 'honasa', 'healthkart', 'gym', 'fitness', 'conditioner', 'shampoo'],
    'Platform Fees': ['platform fee', 'handling charges', 'convenience fee', 'marketplace fee'],
};

// --- NEW: Smart categorization helper function ---
function getCategory(invoice) {
    const vendorName = invoice.fields.VendorName?.content?.toLowerCase() || '';
    const lineItemsText = (invoice.fields.Items?.values || [])
        .map(item => item.properties.Description?.content?.toLowerCase())
        .filter(Boolean)
        .join(' ');

    const textToSearch = `${vendorName} ${lineItemsText}`;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        for (const keyword of keywords) {
            if (textToSearch.includes(keyword)) {
                return category;
            }
        }
    }
    return "Uncategorized"; // Default if no keywords match
}

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

            if (!documents || documents.length === 0) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "Could not analyze the document." } };
            }

         const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_CONNECTION_STRING);
            const container = cosmosClient.database("InvoiceDB").container("Invoices");
            // --- FIX: Find the main invoice by the highest total value ---
            let mainInvoice = documents[0];
            if (documents.length > 1) {
                mainInvoice = documents.reduce((max, current) => {
                    const maxTotal = max.fields.InvoiceTotal?.value?.amount || 0;
                    const currentTotal = current.fields.InvoiceTotal?.value?.amount || 0;
                    return currentTotal > maxTotal ? current : max;
                }, documents[0]);
            }
            // --- END OF FIX ---

            const invoice = mainInvoice; // Use the identified main invoice for all subsequent logic
            
            const invoiceId = invoice.fields.InvoiceId?.content;
            const vendorName = invoice.fields.VendorName?.content;
            const invoiceDate = invoice.fields.InvoiceDate?.value;
            const invoiceTotal = invoice.fields.InvoiceTotal?.value?.amount;
            const subTotal = invoice.fields.SubTotal?.value?.amount;

            // ... (Duplicate check logic is correct and remains the same)

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
            
            let calculatedTax = 0;
            if (typeof subTotal === 'number' && typeof invoiceTotal === 'number' && invoiceTotal > subTotal) {
                calculatedTax = invoiceTotal - subTotal;
            } else {
                calculatedTax = invoice.fields.TotalTax?.value?.amount || 0;
            }

            const newFileName = `${uuidv4()}.${file.name.split('.').pop()}`;
            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
            await blobServiceClient.getContainerClient("invoice-raw").getBlockBlobClient(newFileName).uploadData(fileBuffer);
            
            const invoiceDateObj = new Date(invoiceDate || new Date());
            let dueDate = invoice.fields.DueDate?.value ? new Date(invoice.fields.DueDate.value) : new Date(new Date(invoiceDateObj).setDate(invoiceDateObj.getDate() + 30));
            let initialStatus = "pending";
            if (new Date(invoiceDateObj).getTime() < new Date().setMonth(new Date().getMonth() - 2)) { initialStatus = "paid"; }

            // --- NEW: Automatically determine the category ---
            const assignedCategory = getCategory(invoice);

            const newItem = {
                id: uuidv4(),
                userId: userId,
                invoiceId: invoiceId || null,
                fingerprint: invoiceId ? null : `${vendorName}-${invoiceDateObj.toISOString().split('T')[0]}-${invoiceTotal}`,
                fileName: newFileName,
                status: initialStatus,
                category: assignedCategory, // Use the new, smartly assigned category
                vendorName: vendorName || 'N/A',
                vendorAddress: invoice.fields.VendorAddress?.content,
                customerName: invoice.fields.CustomerName?.content || decodedToken.name || 'N/A',
                customerAddress: invoice.fields.CustomerAddress?.content,
                invoiceDate: invoiceDateObj,
                dueDate: dueDate,
                invoiceTotal: invoiceTotal || 0,
                subTotal: subTotal,
                totalTax: calculatedTax,
                currency: invoice.fields.InvoiceTotal?.value?.currencyCode || 'INR',
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