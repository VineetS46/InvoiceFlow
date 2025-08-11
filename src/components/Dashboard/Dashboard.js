// src/components/Dashboard/Dashboard.js (FINAL, PERMANENT FIX)
import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import './Dashboard.css';

// All necessary imports
import { Button, Menu, MenuItem, IconButton, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, CircularProgress } from '@material-ui/core';
import DescriptionIcon from '@material-ui/icons/Description';
import AttachMoneyIcon from '@material-ui/icons/AttachMoney';
import WarningIcon from '@material-ui/icons/Warning';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import MoreVertIcon from '@material-ui/icons/MoreVert';

const Dashboard = () => {
    const auth = useAuth(); // Get the entire auth context object
    const fileInputRef = useRef(null);

    // All state variables
    const [isDragging, setIsDragging] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [uploadedFileCount, setUploadedFileCount] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [showAuthErrorDialog, setShowAuthErrorDialog] = useState(false);
    
    const handleDialogClose = () => setShowSuccessDialog(false);
    const handleAuthErrorDialogClose = () => setShowAuthErrorDialog(false);

    const processFiles = useCallback(async (files) => {
        if (!files || files.length === 0) return;
        
        // --- THIS IS THE PERMANENT FIX ---
        // Get the most up-to-date user object directly from the auth context.
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
            setShowAuthErrorDialog(true);
            return;
        }

        setIsUploading(true);
        setUploadError('');

        try {
            const token = await currentUser.getIdToken();
            for (const file of files) {
                const getUrlResponse = await fetch(`http://localhost:7071/api/getUploadUrl?fileName=${encodeURIComponent(file.name)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (getUrlResponse.status === 401) throw new Error('Authentication failed. Please log in again.');
                if (!getUrlResponse.ok) throw new Error('Failed to get a secure upload URL.');
                
                const { uploadUrl } = await getUrlResponse.json();
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    body: file,
                    headers: { 'Content-Type': file.type, 'x-ms-blob-type': 'BlockBlob', 'x-ms-meta-userid': currentUser.uid }
                });
                if (!uploadResponse.ok) throw new Error(`Failed to upload ${file.name}.`);
            }
            
            setUploadedFileCount(files.length);
            setShowSuccessDialog(true);
        } catch (error) {
            console.error("Upload process failed:", error);
            setUploadError(error.message);
        } finally {
            setIsUploading(false);
        }
    }, [auth]); // Depend on the entire auth object to ensure updates.
    
    // Other handlers
    const handleMenuClick = (event, invoiceId) => { setAnchorEl(event.currentTarget); setSelectedInvoiceId(invoiceId); };
    const handleMenuClose = () => { setAnchorEl(null); setSelectedInvoiceId(null); };
    const handleMarkAsPaid = () => { console.log(`Marking invoice ${selectedInvoiceId} as paid.`); handleMenuClose(); };
    const handleUploadAreaClick = () => { if (!isUploading) fileInputRef.current.click(); };
    const handleFileChange = (e) => processFiles(e.target.files);
    const handleDragEnter = (e) => { if (!isUploading) { e.preventDefault(); e.stopPropagation(); setIsDragging(true); } };
    const handleDragLeave = (e) => { if (!isUploading) { e.preventDefault(); e.stopPropagation(); setIsDragging(false); } };
    const handleDragOver = (e) => { if (!isUploading) { e.preventDefault(); e.stopPropagation(); } };
    const handleDrop = (e) => { if (!isUploading) { e.preventDefault(); e.stopPropagation(); processFiles(e.dataTransfer.files); e.dataTransfer.clearData(); } };

    // --- ALL UI DATA IS RESTORED ---
    const statCardsData = [
        { icon: <DescriptionIcon style={{ color: "#5d46ff" }} />, title: "Total Invoices", value: "147", iconBg: "#eaf1ff" },
        { icon: <AttachMoneyIcon style={{ color: "#2ecc71" }} />, title: "Total Amount", value: "$52,840.50", iconBg: "#e4f8f0" },
        { icon: <WarningIcon style={{ color: "#e74c3c" }} />, title: "Overdue Invoices", value: "3", iconBg: "#fdeeee" }
    ];
    const recentInvoicesData = [
        { id: 'INV-2024-001', vendor: 'ABC Corporation', amount: '$2,500.00', status: 'paid' },
        { id: 'INV-2024-002', vendor: 'XYZ Ltd', amount: '$1,800.75', status: 'pending' },
        { id: 'INV-2024-003', vendor: 'Tech Solutions', amount: '$4,200.00', status: 'overdue' },
    ];
    
    // We use auth.currentUser here too, for consistency.
    const user = auth.currentUser;

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <h1>Welcome back{user?.displayName ? `, ${user.displayName}` : ''}!</h1>
                <p>Here’s what’s happening with your invoices today.</p>
            </header>

            <div className="stats-grid">
                {statCardsData.map((card, index) => (<div key={index} className="stat-card"><div className="stat-icon-wrapper" style={{ backgroundColor: card.iconBg }}>{card.icon}</div><div className="stat-info"><span className="stat-title">{card.title}</span><span className="stat-value" style={{ color: card.icon.props.style.color }}>{card.value}</span></div></div>))}
            </div>

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
                    <ul className="invoice-list">{recentInvoicesData.map((invoice) => (<li key={invoice.id} className="invoice-item"><div className="invoice-info-grid"><span className="invoice-id">{invoice.id}</span><span className="invoice-amount">{invoice.amount}</span><span className="invoice-vendor">{invoice.vendor}</span><span className={`invoice-status ${invoice.status}`}>{invoice.status.toUpperCase()}</span></div><div className="invoice-actions">{invoice.status !== 'paid' && (<IconButton aria-label="actions" className="invoice-action-btn" onClick={(e) => handleMenuClick(e, invoice.id)}><MoreVertIcon /></IconButton>)}</div></li>))}</ul>
                    <Menu id="invoice-action-menu" anchorEl={anchorEl} keepMounted open={Boolean(anchorEl)} onClose={handleMenuClose}><MenuItem onClick={handleMarkAsPaid}>Mark as Paid</MenuItem></Menu>
                </div>
            </div>

            <Dialog open={showSuccessDialog} onClose={handleDialogClose}><DialogTitle>Upload Successful</DialogTitle><DialogContent><DialogContentText>{uploadedFileCount} invoice(s) have been uploaded successfully. They will be processed and appear in your history shortly.</DialogContentText></DialogContent><DialogActions><Button onClick={handleDialogClose} className="dialog-ok-button" autoFocus>OK</Button></DialogActions></Dialog>
            <Dialog open={showAuthErrorDialog} onClose={handleAuthErrorDialogClose}><DialogTitle>Authentication Required</DialogTitle><DialogContent><DialogContentText>You must be logged in to upload files. Please log out and log in again if you believe this is an error.</DialogContentText></DialogContent><DialogActions><Button onClick={handleAuthErrorDialogClose} className="dialog-ok-button" autoFocus>OK</Button></DialogActions></Dialog>
        </div>
    );
};

export default Dashboard;