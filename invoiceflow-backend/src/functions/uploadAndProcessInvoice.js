const { app } = require('@azure/functions');
const { BlobServiceClient } = require("@azure/storage-blob");
const OpenAI = require("openai");
const { CosmosClient } = require("@azure/cosmos");
const { v4: uuidv4 } = require("uuid");
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const pdfParse = require('pdf-parse');

const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
};

const CATEGORIES_LIST = [
    "Office Supplies", "Software & Subscriptions", "Utilities", "Rent & Lease", 
    "Marketing & Advertising", "Travel & Accommodation", "Meals & Entertainment", 
    "Professional Services", "Contractors & Freelancers", "Hardware & Equipment", 
    "Shipping & Postage", "Insurance", "Phone & Internet", "Employee Benefits", 
    "Health & Wellness", "Platform Fees", "Other"
].join(', ');

app.http('uploadAndProcessInvoice', {
    methods: ['POST','OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        const decodedToken = await validateFirebaseToken(request);
        if (!decodedToken) return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized." } };
        const userId = decodedToken.uid;

        try {
            const formData = await request.formData();
            const file = formData.get('invoiceFile');
            if (!file) return { status: 400, headers: corsHeaders, jsonBody: { error: "No file uploaded." } };

            const fileBuffer = Buffer.from(await file.arrayBuffer());
            const pdfData = await pdfParse(fileBuffer);
            const pdfText = pdfData.text;

            // Initialize Azure OpenAI client
            const openAIClient = new OpenAI({
                apiKey: process.env.AZURE_OPENAI_KEY,
                baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
                defaultQuery: { "api-version": "2024-02-01" },
                defaultHeaders: { "api-key": process.env.AZURE_OPENAI_KEY },
            });

            // GPT extraction prompt
            const extractionPrompt = `
You are an intelligent invoice parser.
Extract key fields from the invoice text. Respond ONLY with a valid JSON object.
Use null for missing values. Dates: YYYY-MM-DD. Numbers: only digits.
Required keys:
- invoiceId
- vendorName
- customerName
- invoiceDate
- dueDate
- subTotal
- totalTax
- invoiceTotal
- lineItems (array of objects with description, quantity, amount)
- mainProduct (the most important product or service name)
- mainProductPrice (the price of that product)

Invoice Text: """${pdfText}"""
`;

            const gptResponse = await openAIClient.chat.completions.create({
                model: "gpt-4.1",
                messages: [{ role: "user", content: extractionPrompt }],
                response_format: { type: "json_object" },
                temperature: 0
            });

            const aiResponse = gptResponse.choices[0].message.content;
            if (!aiResponse) throw new Error("AI extraction failed to return a response.");

            const parsedData = JSON.parse(aiResponse);
            const {
                vendorName, customerName, invoiceDate, dueDate,
                subTotal, totalTax, invoiceTotal, lineItems,
                mainProduct, mainProductPrice
            } = parsedData;

            // GPT category prompt
            const categoryPrompt = `Based on vendor "${vendorName}" and line items "${(lineItems||[]).map(i=>i.description).join(', ')}", choose the best category from: ${CATEGORIES_LIST}. Respond ONLY with the category name.`;
            const categoryResp = await openAIClient.chat.completions.create({
                model: "gpt-4.1",
                messages: [{ role: "user", content: categoryPrompt }],
                temperature: 0
            });
            let assignedCategory = categoryResp.choices[0].message.content.trim();
            if (!CATEGORIES_LIST.includes(assignedCategory)) assignedCategory = "Uncategorized";

            // Upload PDF to Blob Storage
            const newFileName = `${uuidv4()}.${file.name.split('.').pop()}`;
            const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
            await blobServiceClient.getContainerClient("invoice-raw").getBlockBlobClient(newFileName).uploadData(fileBuffer);

            // Save to Cosmos DB
            const cosmosClient = new CosmosClient(process.env.AZURE_COSMOS_CONNECTION_STRING);
            const container = cosmosClient.database("InvoiceDB").container("Invoices");

            const fingerprint = `${vendorName}-${invoiceDate}-${invoiceTotal}`;
            const { resources: existing } = await container.items.query({
                query: "SELECT c.id FROM c WHERE c.userId=@userId AND c.fingerprint=@fingerprint AND c.docType='invoice'",
                parameters: [{ name: "@userId", value: userId }, { name: "@fingerprint", value: fingerprint }]
            }).fetchAll();

            if (existing.length > 0) {
                return { status: 409, headers: corsHeaders, jsonBody: { error: "Duplicate invoice detected." } };
            }

            const newItem = {
                id: uuidv4(),
                docType: "invoice",
                userId,
                invoiceId: parsedData.invoiceId || null,
                fingerprint,
                fileName: newFileName,
                status: "pending",
                category: assignedCategory,
                vendorName: vendorName || "N/A",
                customerName: customerName || decodedToken.name || "N/A",
                invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
                dueDate: dueDate ? new Date(dueDate) : new Date(new Date().setDate(new Date().getDate()+30)),
                invoiceTotal: invoiceTotal || 0,
                subTotal: subTotal || null,
                totalTax: totalTax || null,
                mainProduct: mainProduct || "N/A",
                mainProductPrice: mainProductPrice || null,
                lineItems: lineItems || [],
                uploadedAt: new Date(),
                currency: 'INR'
            };

            const { resource: createdItem } = await container.items.create(newItem);
            return { status: 201, headers: corsHeaders, jsonBody: createdItem };

        } catch (err) {
            context.error("Error in uploadAndProcessInvoice:", err);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "Internal server error during processing." } };
        }
    }
});
