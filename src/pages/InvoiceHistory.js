import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../helpers/api';
import './InvoiceHistory.css';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    Typography,
    IconButton,
    Menu,
    MenuItem,
    Grid,
    TextField,
    FormControl,
    InputLabel,
    Select,
    Tooltip,
    Button
} from '@material-ui/core';
import {
    MoreVert,
    Visibility,
    GetApp,
    Edit,
    Search,
    Clear
} from '@material-ui/icons';

const InvoiceHistory = () => {
    const auth = useAuth();
    const { currentUser, currentWorkspace, loading: authLoading } = auth;

    const [invoices, setInvoices] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [error, setError] = useState('');

    const [actionsMenuAnchor, setActionsMenuAnchor] = useState(null);
    const [categoryMenuAnchor, setCategoryMenuAnchor] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [loadingAction, setLoadingAction] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    useEffect(() => {
        const fetchInvoices = async () => {
            if (!currentUser || !currentWorkspace) {
                setIsLoadingData(false);
                return;
            }
            setIsLoadingData(true);
            setError('');
            try {
                const data = await api.get('getInvoices', auth);
                if (data.error) throw new Error(data.error);
                setInvoices(Array.isArray(data) ? data : []);
            } catch (err) {
                setError(err.message);
                setInvoices([]);
            } finally {
                setIsLoadingData(false);
            }
        };

        if (!authLoading) {
            fetchInvoices();
        }
    }, [auth, authLoading, currentUser, currentWorkspace]);

    const userCategories = useMemo(() => {
        return currentWorkspace?.categories?.map(cat => cat.name) || [];
    }, [currentWorkspace]);

    const filteredInvoices = useMemo(() => {
        return invoices.filter(invoice => {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            const matchesSearchTerm = lowerCaseSearchTerm === '' ||
                (invoice.vendorName || '').toLowerCase().includes(lowerCaseSearchTerm) ||
                (invoice.lineItems || []).some(item =>
                    item.description?.toLowerCase().includes(lowerCaseSearchTerm)
                );
            const invoiceDate = new Date(invoice.invoiceDate);
            const matchesStartDate = !startDate || invoiceDate >= new Date(startDate);
            const matchesEndDate = !endDate || invoiceDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999));
            const matchesCategory = !categoryFilter || invoice.category === categoryFilter;
            return matchesSearchTerm && matchesStartDate && matchesEndDate && matchesCategory;
        });
    }, [invoices, searchTerm, startDate, endDate, categoryFilter]);

    const handleClearFilters = () => {
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
        setCategoryFilter('');
    };

    const handleUpdateInvoice = async (invoiceToUpdate, dataToUpdate) => {
        try {
            const endpoint = `editinvoice?id=${invoiceToUpdate.id}`;
            const updatedInvoice = await api.post(endpoint, dataToUpdate, auth);
            if (updatedInvoice.error) throw new Error(updatedInvoice.error);

            setInvoices(prevInvoices =>
                prevInvoices.map(inv => (inv.id === updatedInvoice.id ? updatedInvoice : inv))
            );
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleMenuOpen = (event, invoice, menuType) => {
        setSelectedInvoice(invoice);
        if (menuType === 'actions') {
            setActionsMenuAnchor(event.currentTarget);
        } else if (menuType === 'category') {
            setCategoryMenuAnchor(event.currentTarget);
        }
    };

    const handleMenuClose = () => {
        setActionsMenuAnchor(null);
        setCategoryMenuAnchor(null);
        setSelectedInvoice(null);
    };

    const handleCategorySelect = (newCategory) => {
        if (selectedInvoice) {
            handleUpdateInvoice(selectedInvoice, { category: newCategory });
        }
        handleMenuClose();
    };

    const handleEditVendor = () => {
        if (!selectedInvoice) return;
        const newVendorName = prompt("Enter the new vendor name:", selectedInvoice.vendorName);
        if (newVendorName && newVendorName !== selectedInvoice.vendorName) {
            handleUpdateInvoice(selectedInvoice, { vendorName: newVendorName });
        }
        handleMenuClose();
    };

    const formatCurrency = (amount, currencyCode) => {
        if (typeof amount !== 'number') return 'N/A';
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyCode || 'INR' }).format(amount);
    };

    const handleFileAction = async (action) => {
        const invoiceToAction = selectedInvoice;
        handleMenuClose();
        if (!invoiceToAction) return;

        setLoadingAction(invoiceToAction.id);
        try {
            const token = await currentUser.getIdToken();
            const url = `http://localhost:7071/api/generateInvoicePdf?id=${invoiceToAction.id}&action=${action}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-workspace-id': currentWorkspace.id
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Could not ${action} PDF.`);
            }

            const blob = await response.blob();
            const fileURL = URL.createObjectURL(blob);

            if (action === 'view') {
                window.open(fileURL, '_blank');
            } else if (action === 'download') {
                const link = document.createElement('a');
                link.href = fileURL;
                link.download = `InvoiceFlow-${invoiceToAction.vendorName}-${invoiceToAction.id.substring(0, 8)}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(fileURL);
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            setLoadingAction(null);
        }
    };

    if (authLoading || isLoadingData) return <div className="loading-container"><CircularProgress size={50} /></div>;
    if (error) return <div className="error-container">{error}</div>;

    return (
        <div className="invoice-history-page">
            <Paper className="main-panel">
                <div className="panel-header">
                    <Typography variant="h5" className="panel-title">Invoice History</Typography>
                </div>
                <div className="panel-filters">
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4}><TextField fullWidth label="Search by Vendor/Description" variant="outlined" size="small" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} InputProps={{ endAdornment: <Search color="action" /> }} /></Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth variant="outlined" size="small">
                                <InputLabel>Category</InputLabel>
                                <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} label="Category">
                                    <MenuItem value=""><em>All Categories</em></MenuItem>
                                    <MenuItem value="Uncategorized"><em>Uncategorized</em></MenuItem>
                                    {userCategories.map(cat => (<MenuItem key={cat} value={cat}>{cat}</MenuItem>))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6} md={2}><TextField fullWidth label="Start Date" type="date" variant="outlined" size="small" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                        <Grid item xs={6} md={2}><TextField fullWidth label="End Date" type="date" variant="outlined" size="small" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
                        <Grid item xs={12} md={1} style={{ textAlign: 'center' }}><Tooltip title="Clear Filters"><IconButton onClick={handleClearFilters}><Clear /></IconButton></Tooltip></Grid>
                    </Grid>
                </div>
                <TableContainer>
                    <Table aria-label="invoice history table">
                        <TableHead>
                            <TableRow>
                                <TableCell>Vendor</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Invoice Date</TableCell>
                                <TableCell>Category</TableCell>
                                <TableCell align="right">Total</TableCell>
                                <TableCell align="center">Status</TableCell>
                                <TableCell align="center">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredInvoices.length > 0 ? (
                                filteredInvoices.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell>{invoice.vendorName}</TableCell>
                                        <TableCell>{(invoice.lineItems?.[0]?.description || 'N/A').substring(0, 30)}...</TableCell>
                                        <TableCell>{new Date(invoice.invoiceDate).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <Button
                                                onClick={(e) => handleMenuOpen(e, invoice, 'category')}
                                                className={invoice.category === 'Uncategorized' ? 'category-button-uncategorized' : 'category-button'}
                                            >
                                                {invoice.category || 'Uncategorized'}
                                            </Button>
                                        </TableCell>
                                        <TableCell align="right">{formatCurrency(invoice.invoiceTotal, invoice.currency)}</TableCell>
                                        <TableCell align="center"><span className={`status-badge ${invoice.status}`}>{invoice.status}</span></TableCell>
                                        <TableCell align="center">
                                            {loadingAction === invoice.id ? (
                                                <CircularProgress size={24} />
                                            ) : (
                                                <IconButton size="small" onClick={(e) => handleMenuOpen(e, invoice, 'actions')}><MoreVert /></IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={7} align="center"><Typography style={{ padding: '20px' }}>
                                    {invoices.length === 0 ? "No invoices found. Use the Dashboard to upload one." : "No invoices match your filters."}
                                </Typography></TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <Menu anchorEl={actionsMenuAnchor} open={Boolean(actionsMenuAnchor)} onClose={handleMenuClose}>
                <MenuItem onClick={() => handleFileAction('view')}>
                    <Visibility fontSize="small" style={{ marginRight: 8 }} /> View Summary
                </MenuItem>
                <MenuItem onClick={() => handleFileAction('download')}>
                    <GetApp fontSize="small" style={{ marginRight: 8 }} /> Download Summary
                </MenuItem>
                <MenuItem onClick={handleEditVendor}>
                    <Edit fontSize="small" style={{ marginRight: 8 }} /> Edit
                </MenuItem>
            </Menu>

            <Menu anchorEl={categoryMenuAnchor} open={Boolean(categoryMenuAnchor)} onClose={handleMenuClose}>
                {userCategories.map(cat => (
                    <MenuItem key={cat} onClick={() => handleCategorySelect(cat)}>
                        {cat}
                    </MenuItem>
                ))}
            </Menu>
        </div>
    );
};

export default InvoiceHistory;