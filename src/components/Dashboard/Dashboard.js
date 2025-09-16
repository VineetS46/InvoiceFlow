import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../helpers/api';
import { Link } from 'react-router-dom';
import { 
    Paper, Typography, Grid, CircularProgress, List, ListItem, 
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    IconButton, Menu, MenuItem, Divider, Chip
} from '@material-ui/core';
import { 
    Description as DescriptionIcon, 
    AttachMoney as AttachMoneyIcon, 
    Warning as WarningIcon,
    CloudUpload as CloudUploadIcon,
    MoreVert as MoreVertIcon,
    Payment as PaymentIcon
} from '@material-ui/icons';
import './Dashboard.css';

const StatCard = ({ title, value, icon, colorClass }) => (
    <div className={`stat-card ${colorClass || ''}`}>
        <div className={`stat-icon-wrapper ${colorClass}`}>{icon}</div>
        <div className="stat-info">
            <span className="stat-title">{title}</span>
            <span className="stat-value">{value}</span>
        </div>
    </div>
);

const Dashboard = () => {
    const auth = useAuth();
    const { currentUser, currentWorkspace, loading: authLoading } = auth;
    const fileInputRef = useRef(null);

    const [invoices, setInvoices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [uploadedFileCount, setUploadedFileCount] = useState(0);
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [duplicateMessage, setDuplicateMessage] = useState('');
    
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    const fetchInvoices = useCallback(async () => {
        if (authLoading || !currentUser || !currentWorkspace) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const data = await api.get('getInvoices', auth);
            setInvoices(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [authLoading, currentUser, currentWorkspace, auth]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    const processFiles = async (files) => {
        if (!files || files.length === 0 || !currentUser) return;
        setIsUploading(true);
        setUploadError('');
        try {
            let successfulUploads = 0;
            for (const file of files) {
                const formData = new FormData();
                formData.append('invoiceFile', file);
                await api.postForm('uploadAndProcessInvoice', formData, auth);
                successfulUploads++;
            }
            if (successfulUploads > 0) {
                setUploadedFileCount(successfulUploads);
                setShowSuccessDialog(true);
                fetchInvoices();
            }
        } catch (error) {
            if (error.message.includes('Duplicate')) {
                setDuplicateMessage(error.message);
                setShowDuplicateDialog(true);
            } else {
                setUploadError(error.message);
            }
        } finally {
            setIsUploading(false);
        }
    };

    const totalCount = invoices.length;
    const totalAmountPaid = invoices
        .filter(inv => inv.status && inv.status.toLowerCase() === 'paid')
        .reduce((sum, inv) => sum + (inv.invoiceTotal || 0), 0);
    
    const overdueInvoices = invoices.filter(inv => {
        const today = new Date();
        return inv.status && inv.status.toLowerCase() !== 'paid' && inv.dueDate && new Date(inv.dueDate) < today;
    });
    const overdueCount = overdueInvoices.length;
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.invoiceTotal || 0), 0);

    const recentInvoices = [...invoices]
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
        .slice(0, 5);

    const formatCurrency = (amount) => {
        if (typeof amount !== 'number') return '₹0.00';
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    };
    
    const handleMenuClick = (event, invoice) => {
        setAnchorEl(event.currentTarget);
        setSelectedInvoice(invoice);
    };
    
    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedInvoice(null);
    };
    
    const handleMarkAsPaid = async () => {
        if (!selectedInvoice) return;
        try {
            await api.post('markInvoiceAsPaid', { id: selectedInvoice.id }, auth);
            fetchInvoices();
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            handleMenuClose();
        }
    };

    const handleUploadAreaClick = () => { if (!isUploading) fileInputRef.current.click(); };
    const handleFileChange = (e) => processFiles(e.target.files);
    const handleDragEnter = (e) => { e.preventDefault(); if (!isUploading) setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDragOver = (e) => { e.preventDefault(); };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!isUploading) processFiles(e.dataTransfer.files);
    };

    if (authLoading || isLoading) {
        return <div className="loading-container"><CircularProgress /></div>;
    }
    if (error) {
        return <div className="error-container">{error}</div>;
    }

    return (
        <div className="dashboard-page">
            <div className="welcome-header">
                <h1>Welcome back, {currentUser?.displayName || currentUser?.email}!</h1>
                <p>Here's a summary of your workspace: <strong>{currentWorkspace?.name}</strong></p>
            </div>

            <div className="stats-grid">
                <StatCard 
                    title="TOTAL INVOICES" 
                    value={totalCount}  
                    icon={<DescriptionIcon />} 
                    colorClass="blue" 
                />
                <StatCard 
                    title="TOTAL AMOUNT (PAID)" 
                    value={formatCurrency(totalAmountPaid)} 
                    icon={<AttachMoneyIcon />} 
                    colorClass="green" 
                />
                <StatCard 
                    title="OVERDUE INVOICES" 
                    value={overdueCount} 
                    icon={<WarningIcon />} 
                    colorClass="red" 
                />
                <StatCard 
                    title="OVERDUE AMOUNT" 
                    value={formatCurrency(overdueAmount)} 
                    icon={<PaymentIcon />} 
                    colorClass="orange" 
                />
            </div>

            <div className="main-content-grid">
                <div className="content-card upload-section">
                    <h2>Upload New Invoice</h2>
                    <p>Select your invoice document(s) for automated processing.</p>
                    <div className={`upload-area ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`} onClick={handleUploadAreaClick} onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept="image/jpeg,image/png,application/pdf" multiple />
                        {isUploading ? (
                            <div className="upload-in-progress">
                                <CircularProgress size={40} />
                                <p>Processing, please wait...</p>
                            </div>
                        ) : (
                            <>
                                <CloudUploadIcon className="upload-icon-main" />
                                <p className="upload-text">Drop your invoice(s) here or click the button</p>
                                <Button variant="contained" color="primary" className="upload-button">Select File(s)</Button>
                                <p className="upload-support-text">Supports JPG, PNG, and PDF up to 10MB</p>
                            </>
                        )}
                    </div>
                    {uploadError && <p className="upload-error-message">{uploadError}</p>}
                </div>
                <div className="content-card recent-invoices-section">
                    <h2>Recent Invoices</h2>
                    <Divider className="section-divider" />
                    {recentInvoices.length > 0 ? (
                        <List className="invoice-list">
                            {recentInvoices.map((invoice) => (
                                <ListItem key={invoice.id} className="invoice-item">
                                    <div className="invoice-info-grid">
                                        <span className="invoice-vendor">{invoice.vendorName || 'N/A'}</span>
                                        <Chip 
                                            label={invoice.status?.toUpperCase() || 'N/A'} 
                                            className={`status-chip status-${invoice.status?.toLowerCase()}`}
                                            size="small"
                                        />
                                        <span className="invoice-description">
                                            {(invoice.lineItems && invoice.lineItems.length > 0) 
                                                ? invoice.lineItems[0].description.substring(0, 50) + (invoice.lineItems[0].description.length > 50 ? '...' : '')
                                                : 'No description available'}
                                        </span>
                                        <span className="invoice-amount">{formatCurrency(invoice.invoiceTotal)}</span>
                                    </div>
                                    <div className="invoice-actions">
                                        <IconButton size="small" onClick={(e) => handleMenuClick(e, invoice)}>
                                            <MoreVertIcon />
                                        </IconButton>
                                    </div>
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <p className="no-invoices-message">You haven't uploaded any invoices yet. Get started!</p>
                    )}
                </div>
            </div>
            
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
                <MenuItem component={Link} to="/invoice-history" onClick={handleMenuClose}>View Details</MenuItem>
                {selectedInvoice?.status !== 'paid' && (
                    <MenuItem onClick={handleMarkAsPaid}>Mark as Paid</MenuItem>
                )}
            </Menu>

            <Dialog open={showSuccessDialog} onClose={() => setShowSuccessDialog(false)}>
                <DialogTitle>Upload Successful</DialogTitle>
                <DialogContent><DialogContentText>{uploadedFileCount} invoice(s) processed successfully.</DialogContentText></DialogContent>
                <DialogActions><Button onClick={() => setShowSuccessDialog(false)} color="primary" autoFocus>OK</Button></DialogActions>
            </Dialog>
            <Dialog open={showDuplicateDialog} onClose={() => setShowDuplicateDialog(false)}>
                <DialogTitle>Duplicate Invoice</DialogTitle>
                <DialogContent><DialogContentText>{duplicateMessage}</DialogContentText></DialogContent>
                <DialogActions><Button onClick={() => setShowDuplicateDialog(false)} color="primary" autoFocus>OK</Button></DialogActions>
            </Dialog>
        </div>
    );
};

export default Dashboard;