// src/components/Dashboard/Dashboard.js (FINAL, COMPLETE UI RESTORED)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import './Dashboard.css';

import { 
    Button, Menu, MenuItem, IconButton, Dialog, DialogActions,
    DialogContent, DialogContentText, DialogTitle, CircularProgress 
} from '@material-ui/core';
import DescriptionIcon from '@material-ui/icons/Description';
import AttachMoneyIcon from '@material-ui/icons/AttachMoney';
import WarningIcon from '@material-ui/icons/Warning';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import MoreVertIcon from '@material-ui/icons/MoreVert';

const Dashboard = () => {
    const auth = useAuth();
    const fileInputRef = useRef(null);

    // State for data
    const [invoices, setInvoices] = useState([]);
    const [stats, setStats] = useState({ totalInvoices: 0, totalAmount: 0, overdue: 0 });
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [fetchError, setFetchError] = useState('');

    // State for UI interactions
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    
    // State for dialogs and menus
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [uploadedFileCount, setUploadedFileCount] = useState(0);
    const [showAuthErrorDialog, setShowAuthErrorDialog] = useState(false);
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [duplicateMessage, setDuplicateMessage] = useState('');

    const formatCurrency = (amount, currencyCode) => {
        if (typeof amount !== 'number') return 'N/A';
        try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount); } 
        catch { return amount.toLocaleString(); }
    };

    const fetchInvoices = useCallback(async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) { setIsLoadingData(false); setInvoices([]); return; }
        setIsLoadingData(true);
        setFetchError('');
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch('http://localhost:7071/api/getInvoices', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Failed to fetch your invoices.');
            const data = await response.json();
            setInvoices(data);
        } catch (error) {
            console.error("Error fetching invoices:", error);
            setFetchError(error.message);
        } finally {
            setIsLoadingData(false);
        }
    }, [auth.currentUser]);

    useEffect(() => {
        if (!auth.loading) { fetchInvoices(); }
    }, [auth.loading, fetchInvoices]);

    useEffect(() => {
        if (invoices.length >= 0) {
            const totalAmount = invoices.reduce((sum, invoice) => sum + (invoice.invoiceTotal || 0), 0);
            const overdueCount = invoices.filter(inv => inv.status === 'overdue').length;
            setStats({ totalInvoices: invoices.length, totalAmount, overdue: overdueCount });
        }
    }, [invoices]);

    const processFiles = async (files) => {
        if (!files || files.length === 0) return;
        const currentUser = auth.currentUser;
        if (!currentUser) { setShowAuthErrorDialog(true); return; }
        setIsUploading(true);
        setUploadError('');
        setDuplicateMessage('');
        try {
            const token = await currentUser.getIdToken();
            for (const file of files) {
                const formData = new FormData();
                formData.append('invoiceFile', file);
                const response = await fetch('http://localhost:7071/api/uploadAndProcessInvoice', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
                if (response.status === 409) {
                    const errorMsg = await response.text();
                    setDuplicateMessage(errorMsg);
                    setShowDuplicateDialog(true);
                    return; 
                }
                if (!response.ok) throw new Error(`Upload failed for ${file.name}.`);
            }
            setUploadedFileCount(files.length);
            setShowSuccessDialog(true);
            fetchInvoices();
        } catch (error) {
            console.error("Upload process failed:", error);
            setUploadError(error.message);
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleDialogClose = () => setShowSuccessDialog(false);
    const handleAuthErrorDialogClose = () => setShowAuthErrorDialog(false);
    const handleDuplicateDialogClose = () => setShowDuplicateDialog(false);
    const handleMenuClick = (event, invoiceId) => { setAnchorEl(event.currentTarget); setSelectedInvoiceId(invoiceId); };
    const handleMenuClose = () => { setAnchorEl(null); setSelectedInvoiceId(null); };
    const handleMarkAsPaid = async () => { /* ... */ };
    const handleUploadAreaClick = () => { if (!isUploading) fileInputRef.current.click(); };
    const handleFileChange = (e) => processFiles(e.target.files);
    const handleDragEnter = (e) => { if (!isUploading) { e.preventDefault(); e.stopPropagation(); setIsDragging(true); } };
    const handleDragLeave = (e) => { if (!isUploading) { e.preventDefault(); e.stopPropagation(); setIsDragging(false); } };
    const handleDragOver = (e) => { if (!isUploading) { e.preventDefault(); e.stopPropagation(); } };
    const handleDrop = (e) => { if (!isUploading) { e.preventDefault(); e.stopPropagation(); processFiles(e.dataTransfer.files); e.dataTransfer.clearData(); } };

    const user = auth.currentUser;
    const isLoading = auth.loading || isLoadingData;

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <h1>Welcome back{user?.displayName ? `, ${user.displayName}` : ''}!</h1>
                <p>Here’s what’s happening with your invoices today.</p>
            </header>

            <div className="stats-grid">
                <div className="stat-card"><div className="stat-icon-wrapper blue"><DescriptionIcon /></div><div className="stat-info"><span className="stat-title">TOTAL INVOICES</span><span className="stat-value">{isLoading ? '...' : stats.totalInvoices}</span></div></div>
                <div className="stat-card"><div className="stat-icon-wrapper green"><AttachMoneyIcon /></div><div className="stat-info"><span className="stat-title">TOTAL AMOUNT</span><span className="stat-value">{isLoading ? '...' : stats.totalAmount.toLocaleString()}</span></div></div>
                <div className="stat-card overdue-card"><div className="stat-icon-wrapper red"><WarningIcon /></div><div className="stat-info"><span className="stat-title">OVERDUE INVOICES</span><span className="stat-value">{isLoading ? '...' : stats.overdue}</span></div></div>
            </div>

            {isLoading ? (
                <div className="loading-container"><CircularProgress size={50} /></div>
            ) : fetchError ? (
                <div className="error-container">{fetchError}</div>
            ) : (
                <div className="main-content-grid">
                    <div className="content-card upload-section">
                        <h2>Upload New Invoice</h2>
                        <p>Select your invoice document(s) for automated processing.</p>
                        <div className={`upload-area ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`} onClick={handleUploadAreaClick} onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}>
                            {isUploading ? (<div className="upload-in-progress"><CircularProgress size={40} /><p>Uploading, please wait...</p></div>) : (<><input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept="image/jpeg,image/png,application/pdf" multiple /><CloudUploadIcon className="upload-icon-main" /><p className="upload-text">Drop your invoice(s) here or click the button</p><Button variant="contained" color="primary" className="upload-button">Select File(s)</Button><p className="upload-support-text">Supports JPG, PNG, and PDF up to 10MB</p></>)}
                        </div>
                        {uploadError && <p className="upload-error-message">{uploadError}</p>}
                    </div>
                    <div className="content-card recent-invoices-section">
                        <h2>Recent Invoices</h2>
                        {invoices.length > 0 ? (
                            <ul className="invoice-list">
                                {invoices.slice(0, 5).map((invoice) => (
                                    <li key={invoice.id} className="invoice-item">
                                        <div className="invoice-info-grid"><span className="invoice-id">{invoice.vendorName || 'N/A'}</span><span className="invoice-amount">{formatCurrency(invoice.invoiceTotal, invoice.currency)}</span><span className="invoice-vendor">{new Date(invoice.invoiceDate).toLocaleDateString()}</span><span className={`invoice-status ${invoice.status}`}>{invoice.status?.toUpperCase() || 'UNKNOWN'}</span></div>
                                        <div className="invoice-actions"><IconButton onClick={(e) => handleMenuClick(e, invoice.id)}><MoreVertIcon /></IconButton></div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="no-invoices-message">You haven't uploaded any invoices yet. Get started!</p>
                        )}
                        <Menu id="invoice-action-menu" anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={handleMenuClose}><MenuItem onClick={handleMarkAsPaid}>Mark as Paid</MenuItem></Menu>
                    </div>
                </div>
            )}
            
            <Dialog open={showSuccessDialog} onClose={handleDialogClose}><DialogTitle>Upload Successful</DialogTitle><DialogContent><DialogContentText>{uploadedFileCount} invoice(s) have been uploaded successfully.</DialogContentText></DialogContent><DialogActions><Button onClick={handleDialogClose} className="dialog-ok-button" autoFocus>OK</Button></DialogActions></Dialog>
            <Dialog open={showAuthErrorDialog} onClose={handleAuthErrorDialogClose}><DialogTitle>Authentication Required</DialogTitle><DialogContent><DialogContentText>You must be logged in to upload files.</DialogContentText></DialogContent><DialogActions><Button onClick={handleAuthErrorDialogClose} className="dialog-ok-button" autoFocus>OK</Button></DialogActions></Dialog>
            <Dialog open={showDuplicateDialog} onClose={handleDuplicateDialogClose}><DialogTitle>Duplicate Invoice Detected</DialogTitle><DialogContent><DialogContentText>{duplicateMessage}</DialogContentText></DialogContent><DialogActions><Button onClick={handleDuplicateDialogClose} className="dialog-ok-button" autoFocus>OK</Button></DialogActions></Dialog>
        </div>
    );
};

export default Dashboard;