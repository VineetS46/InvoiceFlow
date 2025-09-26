// src/pages/Admin.js (UPDATED & SECURE)
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, Button, CircularProgress, Box, TextField, InputAdornment
} from "@material-ui/core";
import PeopleOutlineIcon from "@material-ui/icons/PeopleOutline";
import SecurityIcon from "@material-ui/icons/Security";
import SearchIcon from "@material-ui/icons/Search";
import { useAuth } from '../hooks/useAuth';
import api from "../helpers/api";// *** CHANGE 1: Import your secure API client ***
import "./Admin.css";

function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null); // <-- Add state for errors

   const { currentUser, currentWorkspace } = useAuth();

  // *** CHANGE 2: Fetch users from your secure backend API ***
    const authObject = useMemo(() => {
    if (currentUser && currentWorkspace) {
      return { currentUser, currentWorkspace };
    }
    return null;
  }, [currentUser, currentWorkspace]);


  const fetchUsers = useCallback(async () => {
    // Don't try to fetch if the user isn't fully loaded yet
    if (!authObject) {
      setLoading(false);
      setError("Initializing authentication...");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // *** 4. Pass the authObject to your API call ***
      const userList = await api.get('getUsers', authObject); 
      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users: ", error);
      setError(error.message || "Failed to load users. You may not have permission.");
    } finally {
      setLoading(false);
    }
  }, [authObject]); // fetchUsers will re-run if the authObject changes

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSetRole = async (uid, newRole) => {
    if (!authObject) {
        alert("Cannot update role: user is not authenticated.");
        return;
    }
    if (!window.confirm(`Are you sure you want to promote this user to an Admin?`)) return;
    
    try {
      // *** 5. Pass the authObject to your POST request as well ***
      await api.post('setRole', { userId: uid, role: newRole }, authObject);
      await fetchUsers();
      alert('User has been promoted to Admin successfully!');
    } catch (error) {
      console.error("Error updating role: ", error);
      alert(error.message || 'Failed to update role.');
    }
  };


  // Your filtering logic is perfect, no changes needed here.
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(user => {
      const name = user.displayName || "";
      const email = user.email || "";
      return name.toLowerCase().includes(term) || email.toLowerCase().includes(term);
    });
  }, [users, searchTerm]);


  const renderTableContent = () => {
    if (loading) return <Box className="status-container"><CircularProgress /></Box>;
    // Show the specific error if one occurred
    if (error) return <Box className="status-container"><Typography color="error">{error}</Typography></Box>;
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
                  <Typography className={`role-text role-text-${user.role || 'user'}`}>
                    {user.role?.toUpperCase() || 'USER'}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  {user.role !== "admin" && (
                    <Button
                      variant="outlined" size="small"
                      color="primary"
                      startIcon={<SecurityIcon />}
                      onClick={() => handleSetRole(user.id, "admin")}
                    >
                      Make Admin
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // No changes to your UI structure
  return (
    <div className="admin-container">
      <Box className="admin-header">
        <Typography variant="h4" component="h1" color="textPrimary" style={{ fontWeight: 500, marginBottom: '0.5rem' }}>
            Admin Control Panel
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
            Manage user roles, permissions, and access for the entire application.
        </Typography>
      </Box>

      <Paper elevation={2} style={{ padding: '24px', borderRadius: '16px' }}>
        <Box className="card-header">
          <Typography variant="h6" component="h2" className="card-title">
            <PeopleOutlineIcon />
            Manage Team Members
          </Typography>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search by name or email..."
            className="search-field"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        {renderTableContent()}
      </Paper>
    </div>
  );
}

export default Admin;