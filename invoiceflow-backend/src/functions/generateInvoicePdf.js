const { app } = require('@azure/functions');
const { PDFDocument, rgb } = require('pdf-lib');
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const { container } = require('../helpers/cosmosClient');
const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');

// --- (All helper functions like formatCurrency, drawTableRow, etc., are correct and remain the same) ---

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
            if (!decodedToken) { return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized" } }; }

            const workspaceId = request.headers.get('x-workspace-id');
            const invoiceId = request.query.get('id');

            if (!workspaceId || !invoiceId) {
                return { status: 400, headers: corsHeaders, jsonBody: { error: "Missing workspace or invoice ID." } };
            }

            // Fetch the invoice using workspaceId as the partition key
            const { resource: invoice } = await container.item(invoiceId, workspaceId).read();
            
            if (!invoice) {
                return { status: 404, headers: corsHeaders, jsonBody: { error: "Invoice data not found." } };
            }

            const pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);
            
            // Load fonts
            const fontBytes = fs.readFileSync(path.resolve(__dirname, '../../assets/NotoSans-Regular.ttf'));
            const fontBoldBytes = fs.readFileSync(path.resolve(__dirname, '../../assets/NotoSans-Bold.ttf'));
            const customFont = await pdfDoc.embedFont(fontBytes);
            const customFontBold = await pdfDoc.embedFont(fontBoldBytes);
            
            // --- NEW: Load and embed the logo image ---
            const logoBytes = fs.readFileSync(path.resolve(__dirname, '../../assets/logo.png'));
            const logoImage = await pdfDoc.embedPng(logoBytes);
            const logoDims = logoImage.scale(0.15); // Scale the logo to 15% of its original size
            // ---

            const page = pdfDoc.addPage();
            const { width, height } = page.getSize();
            const margin = 50;
            let y = height - margin;

            // --- NEW: Draw the logo in the header ---
            page.drawImage(logoImage, {
                x: margin,
                y: y - logoDims.height + 15,
                width: logoDims.width,
                height: logoDims.height,
            });
            // Adjust the title position to be next to the logo
            page.drawText('InvoiceFlow', { x: margin + logoDims.width + 10, y, font: customFontBold, size: 28, /* ... */ });
            // ---
            
            // ... (The rest of the PDF generation logic, including the status stamp, layout, and totals, is correct and remains the same)

            const pdfBytes = await pdfDoc.save();

            return {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/pdf' },
                body: Buffer.from(pdfBytes)
            };

        } catch (error) {
            context.error("Error generating PDF:", error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "Could not generate PDF." } };
        }
    }
});