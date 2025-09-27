// src/pages/Admin.js (FINAL V2 with Tabs - Full Code)

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, Button, CircularProgress, Box, TextField, InputAdornment,
  Tabs, Tab, Chip // Added Tabs and Chip
} from "@material-ui/core";
import PeopleOutlineIcon from "@material-ui/icons/PeopleOutline";
import DescriptionIcon from '@material-ui/icons/Description'; // For Invoices Icon
import SecurityIcon from "@material-ui/icons/Security";
import SearchIcon from "@material-ui/icons/Search";
import { useAuth } from '../hooks/useAuth';
import api from "../helpers/api";
import "./Admin.css";

function Admin() {
  // --- States for both tabs ---
  const [users, setUsers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState(0); // 0 for users, 1 for invoices

  const { currentUser, currentWorkspace } = useAuth();

  const authObject = useMemo(() => {
    if (currentUser && currentWorkspace) {
      return { currentUser, currentWorkspace };
    }
    return null;
  }, [currentUser, currentWorkspace]);

  // --- Unified data fetching logic ---
  useEffect(() => {
    const fetchData = async () => {
      if (!authObject) {
        setLoading(false);
        setError("Initializing authentication...");
        return;
      }
      setLoading(true);
      setError(null);
      setSearchTerm(""); // Clear search when switching tabs

      try {
        if (activeTab === 0) {
          const userList = await api.get('getUsers', authObject);
          setUsers(userList);
        } else {
          const invoiceList = await api.get('platform-data?queryType=allInvoices', authObject);
          setInvoices(invoiceList);
        }
      } catch (err) {
        console.error("Error fetching admin data:", err);
        setError(err.message || "Failed to load data. You may not have permission.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authObject, activeTab]); // Re-fetches when auth or tab changes

  const handleSetRole = async (uid, newRole) => {
    if (!authObject) return alert("Cannot update role: user is not authenticated.");
    if (!window.confirm(`Are you sure you want to promote this user to an Admin?`)) return;
    
    try {
      await api.post('setRole', { userId: uid, role: newRole }, authObject);
      const userList = await api.get('getUsers', authObject); // Re-fetch users
      setUsers(userList);
      alert('User has been promoted to Admin successfully!');
    } catch (error) {
      console.error("Error updating role: ", error);
      alert(error.message || 'Failed to update role.');
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // --- Filtering logic ---
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(user => (user.displayName || "").toLowerCase().includes(term) || (user.email || "").toLowerCase().includes(term));
  }, [users, searchTerm]);

  const filteredInvoices = useMemo(() => {
    if (!searchTerm) return invoices;
    const term = searchTerm.toLowerCase();
    return invoices.filter(inv => (inv.vendorName || "").toLowerCase().includes(term) || (inv.uploaderName || "").toLowerCase().includes(term));
  }, [invoices, searchTerm]);

  // --- Rendering Functions for each Tab ---

  const renderUsersTable = () => {
    if (filteredUsers.length === 0) return <Box className="status-container"><Typography color="textSecondary">No users found.</Typography></Box>;
    return (
      <TableContainer>
        <Table>
          <TableHead className="table-header">
            <TableRow>
              <TableCell><b>Display Name</b></TableCell>
              <TableCell><b>Email</b></TableCell>
              <TableCell><b>Role</b></TableCell>
              <TableCell align="center"><b>Actions</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>{user.displayName || "N/A"}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Typography className={`role-text role-text-${user.role || 'user'}`}>{user.role?.toUpperCase() || 'USER'}</Typography>
                </TableCell>
                <TableCell align="center">{user.role !== "admin" && (<Button variant="outlined" size="small" color="primary" startIcon={<SecurityIcon />} onClick={() => handleSetRole(user.id, "admin")}>Make Admin</Button>)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderInvoicesTable = () => {
    if (filteredInvoices.length === 0) return <Box className="status-container"><Typography color="textSecondary">No invoices found.</Typography></Box>;
    return (
      <TableContainer>
        <Table>
          <TableHead className="table-header">
            <TableRow>
              <TableCell><b>Vendor</b></TableCell>
              <TableCell><b>Total</b></TableCell>
              <TableCell><b>Status</b></TableCell>
              <TableCell><b>Uploaded By</b></TableCell>
              <TableCell><b>Date</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredInvoices.map((invoice) => (
              <TableRow key={invoice.id} hover>
                <TableCell>{invoice.vendorName}</TableCell>
                <TableCell>{invoice.currency} {invoice.invoiceTotal.toFixed(2)}</TableCell>
                <TableCell><Chip label={invoice.status} size="small" className={`status-chip status-${invoice.status?.toLowerCase()}`} /></TableCell>
                <TableCell>{invoice.uploaderName}</TableCell>
                <TableCell>{new Date(invoice.invoiceDate).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };
  
  const renderContent = () => {
    if (loading) return <Box className="status-container"><CircularProgress /></Box>;
    if (error) return <Box className="status-container"><Typography color="error">{error}</Typography></Box>;
    return activeTab === 0 ? renderUsersTable() : renderInvoicesTable();
  };

  return (
    <div className="admin-container">
      <Box className="admin-header">
        <Typography variant="h4" component="h1" color="textPrimary" style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Admin Control Panel</Typography>
        <Typography variant="subtitle1" color="textSecondary">Manage user roles, permissions, and access for the entire application.</Typography>
      </Box>

      <Paper elevation={2} style={{ padding: '24px', borderRadius: '16px' }}>
        <Tabs value={activeTab} onChange={handleTabChange} indicatorColor="primary" textColor="primary" variant="fullWidth">
          <Tab icon={<PeopleOutlineIcon />} label="User Management" />
          <Tab icon={<DescriptionIcon />} label="Invoice Oversight" />
        </Tabs>

        <Box className="card-header" style={{ marginTop: '16px' }}>
          <Typography variant="h6" component="h2" className="card-title">
            {activeTab === 0 ? "All Platform Users" : "All Platform Invoices"}
          </Typography>
          <TextField
            variant="outlined" size="small"
            placeholder={activeTab === 0 ? "Search by name or email..." : "Search by vendor or uploader..."}
            className="search-field" value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>)}}
          />
        </Box>
        {renderContent()}
      </Paper>
    </div>
  );
}

export default Admin;