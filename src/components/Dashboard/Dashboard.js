import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../helpers/api';
import { Link } from 'react-router-dom';
import { 
    Paper, Typography, Grid, CircularProgress, List, ListItem,
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle 
} from '@material-ui/core';
import { 
    Description as DescriptionIcon, 
    AttachMoney as AttachMoneyIcon, 
    Warning as WarningIcon,
    CloudUpload as CloudUploadIcon
} from '@material-ui/icons';
import './Dashboard.css';

const Dashboard = () => {
    const auth = useAuth();
    const { currentUser, currentWorkspace, loading: authLoading } = auth;
    const fileInputRef = useRef(null);

    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [uploadedFileCount, setUploadedFileCount] = useState(0);
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [duplicateMessage, setDuplicateMessage] = useState('');
     const [isDragging, setIsDragging] = useState(false);
     
    const fetchDashboardData = useCallback(async () => {
        if (authLoading || !currentUser || !currentWorkspace) {
            // If we are not ready to fetch, ensure loading is turned off.
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            // UPDATED: Use the clean api.get method
            const data = await api.get('getDashboardStats', auth);
            setDashboardData(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    },  [authLoading, currentUser, currentWorkspace]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const processFiles = async (files) => {
        if (!files || files.length === 0 || !currentUser) return;
        setIsUploading(true);
        setUploadError('');
        try {
            let successfulUploads = 0;
            for (const file of files) {
                const formData = new FormData();
                formData.append('invoiceFile', file);
                
                // UPDATED: Use the new api.postForm method for uploads
                await api.postForm('uploadAndProcessInvoice', formData, auth);
                successfulUploads++;
            }
            if (successfulUploads > 0) {
                setUploadedFileCount(successfulUploads);
                setShowSuccessDialog(true);
                fetchDashboardData(); // Refresh stats after upload
            }
        } catch (error) {
            // Handle duplicate errors specifically
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

    const formatCurrency = (amount) => {
        if (typeof amount !== 'number') return '₹0.00';
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
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

            {/* RESTORED: Professional Stat Card Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon-wrapper blue"><DescriptionIcon /></div>
                    <div className="stat-info">
                        <span className="stat-title">TOTAL INVOICES</span>
                        <span className="stat-value">{dashboardData?.totalCount ?? 0}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon-wrapper green"><AttachMoneyIcon /></div>
                    <div className="stat-info">
                        <span className="stat-title">TOTAL AMOUNT (PAID)</span>
                        <span className="stat-value">{formatCurrency(dashboardData?.totalAmountPaid ?? 0)}</span>
                    </div>
                </div>
                <div className="stat-card overdue-card">
                    <div className="stat-icon-wrapper red"><WarningIcon /></div>
                    <div className="stat-info">
                        <span className="stat-title">OVERDUE INVOICES</span>
                        <span className="stat-value">{dashboardData?.overdueCount ?? 0}</span>
                    </div>
                </div>
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
                    {dashboardData?.recentInvoices && dashboardData.recentInvoices.length > 0 ? (
                        <ul className="invoice-list">
                            {dashboardData.recentInvoices.map((invoice) => (
                                <li key={invoice.id} className="invoice-item">
                                    <div className="invoice-info-grid">
                                        <span className="invoice-vendor">{invoice.vendorName || 'N/A'}</span>
                                        <span className={`invoice-status ${invoice.status}`}>{invoice.status?.toUpperCase() || 'N/A'}</span>
                                        <span className="invoice-description">ID: {invoice.id.substring(0, 8)}...</span>
                                        <span className="invoice-amount">{formatCurrency(invoice.invoiceTotal)}</span>
                                    </div>
                                    <div className="invoice-actions">
                                        <Button component={Link} to="/invoice-history" size="small">View</Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="no-invoices-message">You haven't uploaded any invoices yet. Get started!</p>
                    )}
                </div>
            </div>
            
            {/* Dialogs for upload feedback */}
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