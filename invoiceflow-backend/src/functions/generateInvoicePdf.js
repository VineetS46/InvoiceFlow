const { app } = require('@azure/functions');
const puppeteer = require('puppeteer');
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const { container } = require('../helpers/cosmosClient');
const fs = require('fs');
const path = require('path');

const formatCurrency = (amount, currency = 'INR') => {
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount || 0);
    } catch {
        return `${(amount || 0).toFixed(2)}`;
    }
};

app.http('generateInvoicePdf', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
        const corsHeaders = {  
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

            const workspaceId = request.headers.get('x-workspace-id');
            const invoiceId = request.query.get('id');
            const action = request.query.get('action') || 'view';

            if (!workspaceId || !invoiceId) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "Missing workspace or invoice ID." } };
            }

            const { resource: invoice } = await container.item(invoiceId, workspaceId).read();
            if (!invoice) {
                return { status: 404, headers: corsHeaders, jsonBody: { error: "Invoice data not found." } };
            }

                 let statusStampHtml = '';
            const status = (invoice.status || 'pending').toLowerCase();
            if (status === 'paid' || status === 'pending' || status === 'overdue') {
                statusStampHtml = `<div class="status-stamp ${status}">${status}</div>`;
            }

            const templatePath = path.resolve(__dirname, '../assets/invoice-template.html');
            let htmlTemplate = fs.readFileSync(templatePath, 'utf-8');
            const logoPath = path.resolve(__dirname, '../assets/logo.png');
            const logoBase64 = fs.readFileSync(logoPath, 'base64');
            const logoDataUri = `data:image/png;base64,${logoBase64}`;

            let lineItemsHtml = '';
            (invoice.lineItems || []).forEach(item => {
                lineItemsHtml += `
                    <tr>
                        <td>${item.description || 'N/A'}</td>
                        <td style="text-align: center;">${item.quantity || 1}</td>
                        <td style="text-align: right;">${formatCurrency(item.amount, invoice.currency)}</td>
                    </tr>
                `;
            });

            htmlTemplate = htmlTemplate
                 .replace('{{STATUS_STAMP_HTML}}', statusStampHtml) // Inject the stamp
                .replace(new RegExp('{{INVOICE_ID}}', 'g'), invoice.invoiceId || 'N/A')
                .replace(new RegExp('{{CUSTOMER_NAME}}', 'g'), invoice.customerName || 'N/A')
                .replace(new RegExp('{{VENDOR_NAME}}', 'g'), invoice.vendorName || 'N/A')
                 .replace(new RegExp('{{LOGO_DATA_URI}}', 'g'), logoDataUri)
                .replace(new RegExp('{{INVOICE_DATE}}', 'g'), new Date(invoice.invoiceDate).toLocaleDateString())
                .replace(new RegExp('{{LINE_ITEMS_HTML}}', 'g'), lineItemsHtml)
                .replace(new RegExp('{{CATEGORY}}', 'g'), invoice.category || 'Uncategorized')
                .replace(new RegExp('{{CURRENCY}}', 'g'), invoice.currency || 'INR')
                .replace(new RegExp('{{SUBTOTAL}}', 'g'), formatCurrency(invoice.subTotal, invoice.currency))
                .replace(new RegExp('{{TOTAL_TAX}}', 'g'), formatCurrency(invoice.totalTax, invoice.currency))
                .replace(new RegExp('{{INVOICE_TOTAL}}', 'g'), formatCurrency(invoice.invoiceTotal, invoice.currency));
            
            const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
            const page = await browser.newPage();
            await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
            await browser.close();

            const disposition = action === 'download'
                ? `attachment; filename="Invoice-${invoice.vendorName}.pdf"`
                : `inline; filename="Invoice-${invoice.id}.pdf"`;
            
            return {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/pdf', 'Content-Disposition': disposition },
                body: pdfBuffer
            };

        } catch (error) {
            context.error("Error in generateInvoicePdf function:", error);
            return {
                status: 500,
                headers: corsHeaders,
                jsonBody: { error: "An unexpected error occurred while generating the PDF." }
            };
        }
    }
});