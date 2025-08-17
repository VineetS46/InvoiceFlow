// src/pages/Admin.js (FINAL WITH SEARCH BAR)
import React, { useEffect, useState, useCallback } from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, Button, CircularProgress, Box, TextField, InputAdornment
} from "@material-ui/core";
import PeopleOutlineIcon from "@material-ui/icons/PeopleOutline";
import SecurityIcon from "@material-ui/icons/Security";
import SearchIcon from "@material-ui/icons/Search"; // <-- NEW: Import Search Icon
import { db } from "../firebaseConfig";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import "./Admin.css";

function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(""); // <-- NEW: State for the search bar

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const userList = querySnapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));
      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users: ", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSetRole = async (uid, newRole) => {
    if (!window.confirm(`Are you sure you want to promote this user to an Admin?`)) return;
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, { role: newRole });
      await fetchUsers();
      alert('User has been promoted to Admin successfully!');
    } catch (error) {
      console.error("Error updating role: ", error);
      alert('Failed to update role. You may not have permission.');
    }
  };

  // --- NEW: Filter users based on the search term ---
  const filteredUsers = users.filter(user => {
    const name = user.username || user.displayName || "";
    const email = user.email || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const renderTableContent = () => {
    if (loading) return <Box className="status-container"><CircularProgress /></Box>;
    if (filteredUsers.length === 0) return <Box className="status-container"><Typography color="textSecondary">No users found.</Typography></Box>;

    return (
      <TableContainer>
        <Table>
          <TableHead className="table-header">
            <TableRow>
              <TableCell><b>Username</b></TableCell>
              <TableCell><b>Email</b></TableCell>
              <TableCell><b>Role</b></TableCell>
              <TableCell align="center"><b>Actions</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.map((user) => ( // <-- Use filteredUsers here
              <TableRow key={user.uid} hover>
                <TableCell>{user.username || user.displayName || "N/A"}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Typography className={`role-text role-text-${user.role}`}>
                    {user.role?.toUpperCase()}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  {user.role !== "admin" && (
                    <Button
                      variant="outlined" size="small"
                      color="primary"
                      startIcon={<SecurityIcon />}
                      onClick={() => handleSetRole(user.uid, "admin")}
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
          {/* --- NEW: SEARCH BAR --- */}
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