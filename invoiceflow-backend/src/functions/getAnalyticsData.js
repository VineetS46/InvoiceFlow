const { app } = require('@azure/functions');
const { validateFirebaseToken } = require('../helpers/firebase-auth');
const { container } = require('../helpers/cosmosClient');

app.http('getAnalyticsData', {
    methods: ['GET', 'OPTIONS'], // Must handle both GET and OPTIONS
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // --- THIS IS THE FIX FOR THE CORS ERROR ---
        const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
        const corsHeaders = {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        };

        if (request.method === 'OPTIONS') {
            return { status: 200, headers: corsHeaders, body: '' };
        }
        // --- END OF CORS FIX ---

        try {
            const decodedToken = await validateFirebaseToken(request);
            if (!decodedToken) {
                return { status: 401, headers: corsHeaders, jsonBody: { error: "Unauthorized" } };
            }
            const userId = decodedToken.uid;

            // This query is robust and handles old/new data schemas
            const querySpec = {
                query: "SELECT * FROM c WHERE c.userId = @userId AND (c.docType = 'invoice' OR NOT IS_DEFINED(c.docType))",
                parameters: [{ name: "@userId", value: userId }]
            };
            const { resources: allInvoices } = await container.items.query(querySpec).fetchAll();

            const startDate = request.query.get('startDate') ? new Date(request.query.get('startDate')) : null;
            const endDate = request.query.get('endDate') ? new Date(new Date(request.query.get('endDate')).setHours(23, 59, 59, 999)) : null;
            const categoryFilter = request.query.get('category');

            const filteredInvoices = allInvoices.filter(invoice => {
                if (!invoice.invoiceDate) return false;
                const invoiceDate = new Date(invoice.invoiceDate);
                const dateMatch = (!startDate || invoiceDate >= startDate) && (!endDate || invoiceDate <= endDate);
                const categoryMatch = !categoryFilter || invoice.category === categoryFilter;
                return dateMatch && categoryMatch;
            });

            let totalSpent = 0;
            let overdueCount = 0;
            const today = new Date();
            const monthlyTotals = {};
            const categoryTotals = {};

            // --- THIS IS THE FIX FOR THE 500 ERROR ---
            // This loop is now robust against missing/malformed data.
            for (const invoice of filteredInvoices) {
                if (!invoice.invoiceDate || typeof invoice.invoiceTotal !== 'number') {
                    continue; // Skip this record to prevent a crash
                }

                if (invoice.status === 'paid') {
                    totalSpent += invoice.invoiceTotal;
                }
                
                if (invoice.status === 'pending' && invoice.dueDate && new Date(invoice.dueDate) < today) {
                    overdueCount++;
                }

                const monthKey = new Date(invoice.invoiceDate).toISOString().slice(0, 7);
                monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + invoice.invoiceTotal;

                const category = invoice.category || 'Uncategorized';
                categoryTotals[category] = (categoryTotals[category] || 0) + invoice.invoiceTotal;
            }
            // --- END OF 500 ERROR FIX ---
            
            const sortedMonths = Object.keys(monthlyTotals).sort();
            const spendingByMonth = sortedMonths.map(monthKey => {
                const [year, month] = monthKey.split('-');
                const date = new Date(year, month - 1);
                const monthName = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                return { month: monthName, total: monthlyTotals[monthKey] };
            });

            const spendingByCategory = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));
            const topCategory = spendingByCategory.length > 0
                ? spendingByCategory.reduce((a, b) => a.value > b.value ? a : b).name
                : 'N/A';
            
            const analyticsData = {
                kpis: { totalSpent, topCategory, overdueCount },
                spendingByCategory,
                spendingByMonth,
            };

            return { status: 200, headers: corsHeaders, jsonBody: analyticsData };

        } catch (error) {
            context.error("CRASH in getAnalyticsData:", error);
            return { status: 500, headers: corsHeaders, jsonBody: { error: "An error occurred while fetching analytics data." } };
        }
    }
});