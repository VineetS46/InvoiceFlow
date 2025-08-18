// src/pages/InvoiceHistory.js (FINAL, WITH ROBUST DATA FETCHING & UI)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import './InvoiceHistory.css'; // We will create this CSS file next
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    CircularProgress, Typography
} from '@material-ui/core';

const InvoiceHistory = () => {
    // Get the user AND the loading state from our hook
    const { currentUser, loading: authLoading } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // This function will now only be called when we are sure we have a user
        const fetchInvoices = async () => {
            if (!currentUser) {
                setIsLoadingData(false);
                return;
            }
            
            setIsLoadingData(true);
            setError('');
            try {
                const token = await currentUser.getIdToken();
                const response = await fetch(`http://localhost:7071/api/getInvoices`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error('Failed to fetch invoice history.');
                }
                const data = await response.json();
                setInvoices(Array.isArray(data) ? data : []);
            } catch (err) {
                setError(err.message);
                setInvoices([]);
            } finally {
                setIsLoadingData(false);
            }
        };

        // --- THIS IS THE CRITICAL FIX ---
        // Only run the fetch logic AFTER the initial auth check is complete.
        if (!authLoading) {
            fetchInvoices();
        }
    }, [currentUser, authLoading]); // Re-run whenever the user or auth state changes.

    const formatCurrency = (amount, currencyCode) => {
        if (typeof amount !== 'number' || !currencyCode) return 'N/A';
        try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyCode }).format(amount); } 
        catch { return `₹${amount.toLocaleString()}`; }
    };

    if (authLoading || isLoadingData) {
        return <div className="loading-container"><CircularProgress size={50} /></div>;
    }

    if (error) {
        return <div className="error-container">{error}</div>;
    }

    return (
        <div className="invoice-history-page">
            <header className="invoice-history-header">
                <h1>Invoice History</h1>
            </header>

            <TableContainer component={Paper} className="invoice-table-container">
                <Table aria-label="invoice history table">
                    <TableHead>
                        <TableRow>
                            <TableCell>Vendor</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Invoice Date</TableCell>
                            <TableCell align="right">Total</TableCell>
                            <TableCell align="center">Status</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {invoices.length > 0 ? (
                            invoices.map((invoice) => (
                                <TableRow key={invoice.id}>
                                    <TableCell component="th" scope="row">{invoice.vendorName}</TableCell>
                                    <TableCell>{(invoice.lineItems?.[0]?.description || 'N/A').substring(0, 40)}...</TableCell>
                                    <TableCell>{new Date(invoice.invoiceDate).toLocaleDateString()}</TableCell>
                                    <TableCell align="right">{formatCurrency(invoice.invoiceTotal, invoice.currency)}</TableCell>
                                    <TableCell align="center">
                                        <span className={`status-badge ${invoice.status}`}>{invoice.status}</span>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    <Typography variant="subtitle1" style={{ padding: '20px' }}>
                                        No invoices found in your account.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
};

export default InvoiceHistory;