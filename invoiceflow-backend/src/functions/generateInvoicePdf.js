const { app } = require('@azure/functions');
const { PDFDocument, rgb } = require('pdf-lib');
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const { container } = require('../helpers/cosmosClient');
const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');

// --- HELPER FUNCTIONS ---
const brandColor = rgb(0.1, 0.45, 0.85);
const textColor = rgb(0.2, 0.2, 0.2);
const lightTextColor = rgb(0.5, 0.5, 0.5);
const currencySymbolMap = { 'INR': '₹', 'USD': '$', 'EUR': '€' };

/**
 * formatCurrency
 * - grouping (thousands separators)
 * - space between symbol and amount so they don't overlap
 * - returns formatted string (no '=' sign)
 */
function formatCurrency(amount, currencyCode) {
    if (typeof amount !== 'number' || Number.isNaN(amount)) return 'N/A';
    const symbol = currencySymbolMap[currencyCode] || currencyCode || '';
    const formattedNumber = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return symbol.length === 1 ? `${symbol} ${formattedNumber}` : `${formattedNumber} ${symbol}`;
}

function drawTableRow(page, y, columns, font, fontSize, color = textColor) {
    let x = 50;
    columns.forEach(col => {
        const text = col.text || '';
        const alignment = col.align || 'left';
        let textX = x + 5;
        if (alignment === 'right') {
            textX = x + col.width - font.widthOfTextAtSize(text, fontSize) - 5;
        }
        page.drawText(text, { x: textX, y, font, size: fontSize, color });
        x += col.width;
    });
}

app.http('generateInvoicePdf', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
        const corsHeaders = {  
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        };

        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }

        try {
            const decodedToken = await validateFirebaseToken(request);
            if (!decodedToken) { return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized" } }; }
            
            const { resource: invoice } = await container.item(request.query.get('id'), decodedToken.uid).read();
            if (!invoice) { return { status: 404, headers: corsHeaders, jsonBody: { error: "Invoice data not found." } }; }

            const pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);
            
            const fontBytes = fs.readFileSync(path.resolve(__dirname, '../../assets/Noto Sans Regular.ttf'));
            const fontBoldBytes = fs.readFileSync(path.resolve(__dirname, '../../assets/Noto Sans UI Bold.ttf'));
            const customFont = await pdfDoc.embedFont(fontBytes);
            const customFontBold = await pdfDoc.embedFont(fontBoldBytes);
            
            const page = pdfDoc.addPage();
            const { width, height } = page.getSize();
            const margin = 50;
            let y = height - margin;

            // --- STATUS (unchanged) ---
            let currentStatus = invoice.status || 'pending';
            if (currentStatus === 'pending' && invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
                currentStatus = 'overdue';
            }
            
            page.drawText('InvoiceFlow', { x: margin, y, font: customFontBold, size: 28, color: brandColor });
            const statusText = currentStatus.toUpperCase();
            let statusColor = rgb(0.9, 0.6, 0.0);
            if (statusText === 'PAID') statusColor = rgb(0.2, 0.7, 0.2);
            if (statusText === 'OVERDUE') statusColor = rgb(0.8, 0.1, 0.1);
            page.drawText(statusText, { x: width - margin - 100, y: height - margin - 10, font: customFontBold, size: 20, color: statusColor, opacity: 0.5, rotate: { type: 'degrees', angle: -15 } });
            y -= 50;

            // Vendor & Bill To
            page.drawText('VENDOR', { x: margin, y, font: customFontBold, size: 10, color: lightTextColor });
            page.drawText('BILL TO', { x: width / 2, y, font: customFontBold, size: 10, color: lightTextColor });
            y -= 15;
            page.drawText(invoice.vendorName || '', { x: margin, y, font: customFontBold, size: 12 });
            page.drawText(invoice.customerName || '', { x: width / 2, y, font: customFontBold, size: 12 });
            y -= 40;

            // TABLE - adjusted widths so Qty/Discount/Total shift left (inside blue line)
            const tableColumns = [
                { header: 'Description', width: 200, align: 'left' }, // shrink description
                { header: 'Qty', width: 60, align: 'right' },
                { header: 'Discount', width: 90, align: 'right' },
                { header: 'Total', width: 150, align: 'right' },     // wider so amounts don't wrap
            ];
            drawTableRow(page, y, tableColumns.map(c => ({ text: c.header, ...c })), customFontBold, 10, brandColor);
            y -= 8;
            page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1.5, color: brandColor });
            y -= 20;

            // Items
            if (invoice.lineItems && invoice.lineItems.length > 0) {
                invoice.lineItems.forEach(item => {
                    const descLines = (item.description || '').split('\n');
                    drawTableRow(page, y, [
                        { text: descLines[0], width: tableColumns[0].width },
                        { text: String(item.quantity), width: tableColumns[1].width, align: 'right' },
                        { text: formatCurrency(Number(item.discount || 0), invoice.currency), width: tableColumns[2].width, align: 'right' },
                        { text: formatCurrency(Number(item.amount || 0), invoice.currency), width: tableColumns[3].width, align: 'right' },
                    ], customFontBold, 10);
                    y -= 15;
                    if (descLines[1]) {
                        drawTableRow(page, y, [{ text: descLines[1], width: tableColumns[0].width }], customFont, 9, lightTextColor);
                        y -= 15;
                    }
                });
            } else {
                drawTableRow(page, y, [{ text: 'Line item details could not be automatically extracted.', width: 520 }], customFont, 10, lightTextColor);
                y -= 20;
            }
            y -= 10;

            // --- TOTALS: anchor totals block to the right end (inside blue line) ---
            // We anchor the totals area to the right edge: areaRightEnd = width - margin - 10
            // and let totalsWidth determine how far left the label may begin.
            const areaRightEnd = width - margin - 10;
            const totalsWidth = 260;          // total horizontal space reserved for label+value
            let areaStart = areaRightEnd - totalsWidth; // start of totals block (on the right)
            if (areaStart < margin + 50) areaStart = margin + 50; // safety clamp

            const labelFontSize = 11;
            const valueFontSize = 11;
            const grandFontSize = 14;
            const minGap = 8; // minimum horizontal gap between label and value

            // separator line above totals - restricted to areaStart..areaRightEnd to keep inside blue region
            page.drawLine({ start: { x: areaStart - 20, y }, end: { x: areaRightEnd, y }, thickness: 0.5, color: lightTextColor });
            y -= 16; // compact vertical spacing

            // compact draw helper aligned to the right-block
            function drawRightAnchoredLabelValue(label, value, yPos, labelFont, valueFont, labelSize, valueSize, labelColor = lightTextColor, valueColor = textColor) {
                const labelW = labelFont.widthOfTextAtSize(label, labelSize);
                const valueW = valueFont.widthOfTextAtSize(value, valueSize);

                // Start label at areaStart, value right-aligned at areaRightEnd - small padding
                let labelX = areaStart;
                const valueRightX = areaRightEnd - 5;
                // If label + gap + value would overflow areaRightEnd, shift label left
                if (labelX + labelW + minGap + valueW > areaRightEnd) {
                    const overflow = (labelX + labelW + minGap + valueW) - areaRightEnd;
                    labelX = Math.max(margin + 10, labelX - overflow - 4);
                }

                const valueX = valueRightX - valueW;
                page.drawText(label, { x: labelX, y: yPos, font: labelFont, size: labelSize, color: labelColor });
                page.drawText(value, { x: valueX, y: yPos, font: valueFont, size: valueSize, color: valueColor });
            }

            // Subtotal (tighter vertical spacing)
            let valueText = formatCurrency(Number(invoice.subTotal || 0), invoice.currency);
            drawRightAnchoredLabelValue('Subtotal:', valueText, y, customFont, customFontBold, labelFontSize, valueFontSize);
            y -= 14;

            // Tax
            valueText = formatCurrency(Number(invoice.totalTax || 0), invoice.currency);
            drawRightAnchoredLabelValue('Tax:', valueText, y, customFont, customFontBold, labelFontSize, valueFontSize);
            y -= 12;

            // divider line (heavier)
            page.drawLine({ start: { x: areaStart - 20, y }, end: { x: areaRightEnd, y }, thickness: 1, color: textColor });
            y -= 18;

            // Grand Total (no '=' sign)
            const grandText = formatCurrency(Number(invoice.invoiceTotal || 0), invoice.currency);
            // ensure grand label + value fit in totalsWidth, otherwise shift label left slightly
            const grandLabel = 'Grand Total:';
            const glW = customFontBold.widthOfTextAtSize(grandLabel, grandFontSize);
            const gvW = customFontBold.widthOfTextAtSize(grandText, grandFontSize);
            let glX = areaStart;
            if (glX + glW + minGap + gvW > areaRightEnd) {
                const overflow = (glX + glW + minGap + gvW) - areaRightEnd;
                glX = Math.max(margin + 10, glX - overflow - 4);
            }
            const gvX = areaRightEnd - 5 - gvW;
            page.drawText(grandLabel, { x: glX, y, font: customFontBold, size: grandFontSize, color: brandColor });
            page.drawText(grandText, { x: gvX, y, font: customFontBold, size: grandFontSize, color: brandColor });

            // Footer (unchanged)
            y -= 80;
            page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 0.5, color: lightTextColor });
            page.drawText(`Generated by InvoiceFlow on ${new Date().toLocaleDateString()}`, { x: margin, y: y - 5, font: customFont, size: 9, color: lightTextColor });
            
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
