import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import './InvoiceHistory.css';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    CircularProgress, Typography, IconButton, Menu, MenuItem
} from '@material-ui/core';
import { MoreVert, Visibility, GetApp, Edit } from '@material-ui/icons';

const InvoiceHistory = () => {
    const { currentUser, loading: authLoading } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [error, setError] = useState('');

    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    useEffect(() => {
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
                if (!response.ok) throw new Error('Failed to fetch invoice history.');
                const data = await response.json();
                setInvoices(Array.isArray(data) ? data : []);
            } catch (err) {
                setError(err.message);
                setInvoices([]);
            } finally {
                setIsLoadingData(false);
            }
        };

        if (!authLoading) fetchInvoices();
    }, [currentUser, authLoading]);

    const formatCurrency = (amount, currencyCode) => {
        if (typeof amount !== 'number' || !currencyCode) return 'N/A';
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyCode }).format(amount);
    };

    const handleMenuOpen = (event, invoice) => {
        setAnchorEl(event.currentTarget);
        setSelectedInvoice(invoice);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedInvoice(null);
    };

    // --- THIS IS THE UPDATED FUNCTION ---
    const handleFileAction = async (action) => {
        if (!selectedInvoice) return;
        try {
            const token = await currentUser.getIdToken();
            let url;
            let response;

            if (action === 'view') {
                // 'VIEW' calls the new PDF generator function
                url = `http://localhost:7071/api/generateInvoicePdf?id=${selectedInvoice.id}`;
                response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Could not generate PDF.');
                }
                
                // Handle the PDF blob returned by the server
                const blob = await response.blob();
                const fileURL = URL.createObjectURL(blob);
                window.open(fileURL, '_blank');

            } else if (action === 'download') {
                // 'DOWNLOAD' gets the original file's secure URL
                url = `http://localhost:7071/api/getDownloadUrl?id=${selectedInvoice.id}`;
                response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Could not get file URL.');
                
                // Trigger the download using an anchor tag
                const link = document.createElement('a');
                link.href = data.downloadUrl;
                link.download = selectedInvoice.fileName || `invoice-${selectedInvoice.id}.pdf`; // Use fileName from data
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            handleMenuClose();
        }
    };

    const handleEdit = async () => {
        if (!selectedInvoice) return;
        
        const newVendorName = prompt("Enter the new vendor name:", selectedInvoice.vendorName);
        
        if (!newVendorName || newVendorName === selectedInvoice.vendorName) {
            handleMenuClose();
            return;
        }

        try {
            const token = await currentUser.getIdToken();
            const url = `http://localhost:7071/api/editInvoice?id=${selectedInvoice.id}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ vendorName: newVendorName })
            });

            const updatedInvoice = await response.json();
            if (!response.ok) throw new Error(updatedInvoice.error || 'Failed to update invoice.');

            setInvoices(prevInvoices => 
                prevInvoices.map(inv => (inv.id === updatedInvoice.id ? updatedInvoice : inv))
            );

        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            handleMenuClose();
        }
    };

    if (authLoading || isLoadingData) return <div className="loading-container"><CircularProgress size={50} /></div>;
    if (error) return <div className="error-container">{error}</div>;

    return (
        <div className="invoice-history-page">
            <header className="invoice-history-header"><h1>Invoice History</h1></header>
            <TableContainer component={Paper} className="invoice-table-container">
                <Table aria-label="invoice history table">
                    <TableHead>
                        <TableRow>
                            <TableCell>Vendor</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Invoice Date</TableCell>
                            <TableCell align="right">Total</TableCell>
                            <TableCell align="center">Status</TableCell>
                            <TableCell align="center">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {invoices.length > 0 ? (
                            invoices.map((invoice) => (
                                <TableRow key={invoice.id}>
                                    <TableCell>{invoice.vendorName}</TableCell>
                                    <TableCell>{(invoice.lineItems?.[0]?.description || 'N/A').substring(0, 40)}...</TableCell>
                                    <TableCell>{new Date(invoice.invoiceDate).toLocaleDateString()}</TableCell>
                                    <TableCell align="right">{formatCurrency(invoice.invoiceTotal, invoice.currency)}</TableCell>
                                    <TableCell align="center"><span className={`status-badge ${invoice.status}`}>{invoice.status}</span></TableCell>
                                    <TableCell align="center">
                                        <IconButton size="small" onClick={(e) => handleMenuOpen(e, invoice)}><MoreVert /></IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={6} align="center"><Typography>No invoices found.</Typography></TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* --- MENU HAS BEEN UPDATED WITH NEW LABELS --- */}
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
                <MenuItem onClick={() => handleFileAction('view')}>
                    <Visibility fontSize="small" style={{ marginRight: 8 }} /> View Processed Invoice
                </MenuItem>
                <MenuItem onClick={() => handleFileAction('download')}>
                    <GetApp fontSize="small" style={{ marginRight: 8 }} /> Download Original
                </MenuItem>
                <MenuItem onClick={handleEdit}>
                    <Edit fontSize="small" style={{ marginRight: 8 }} /> Edit
                </MenuItem>
            </Menu>
        </div>
    );
};

export default InvoiceHistory;