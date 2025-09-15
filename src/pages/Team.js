import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../helpers/api';
import {
  Paper, Typography, TextField, Button, Grid, FormControl,
  InputLabel, Select, MenuItem, Divider, List, ListItem,
  ListItemAvatar, ListItemText, Avatar, Chip, CircularProgress,
  Snackbar
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import { Person as PersonIcon, People as PeopleIcon } from '@material-ui/icons';
import './Team.css'; // We will create this CSS file next

const Team = () => {
   const auth = useAuth();
  const { currentUser, currentWorkspace, userProfile } = useAuth();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });
  
  // State to hold the list of members (we'll fetch this in the future)
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (currentUser && userProfile && currentWorkspace) {
      setMembers([{
          displayName: currentUser.displayName,
          email: currentUser.email,
          photoURL: currentUser.photoURL,
          role: userProfile.workspaces[currentWorkspace.id]
      }]);
    }
  }, [currentUser, userProfile, currentWorkspace]);

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setFeedback({ open: true, message: 'Please enter a valid email address.', severity: 'error' });
      return;
    }
    setLoading(true);
    try {
      // --- UPDATED: Use the clean api.post method ---
      const body = {
        email: email,
        role: role,
        workspaceName: currentWorkspace.name
      };
      // The helper automatically adds the token and workspaceId from the headers
      const result = await api.post('inviteUser', body, auth);

      setFeedback({ open: true, message: result.message || 'Invitation sent!', severity: 'success' });
      setEmail('');
      setRole('member');
    } catch (err) {
      setFeedback({ open: true, message: err.message || 'An unknown error occurred.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseFeedback = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setFeedback({ ...feedback, open: false });
  };
  
  // A simple guard to prevent rendering before workspace data is loaded
  if (!currentWorkspace) {
      return (
          <div className="team-page">
              <Paper className="main-panel" style={{textAlign: 'center', padding: '40px'}}>
                  <CircularProgress />
              </Paper>
          </div>
      );
  }

  return (
    <div className="team-page">
      <Paper className="main-panel">
        <div className="panel-header">
          <Typography variant="h5" className="panel-title">Team Management</Typography>
          <Typography color="textSecondary">Manage your workspace: <strong>{currentWorkspace.name}</strong></Typography>
        </div>

        {/* --- Invite Members Section --- */}
        <div className="invite-section">
          <Typography variant="h6" className="section-title">
            Invite New Member
          </Typography>
          
          <form onSubmit={handleInviteSubmit}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={5}>
                <TextField label="Email Address" variant="outlined" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} type="email" size="small" />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl variant="outlined" fullWidth size="small">
                  <InputLabel>Role</InputLabel>
                  <Select value={role} onChange={(e) => setRole(e.target.value)} label="Role">
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="member">Member</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button type="submit" variant="contained" color="primary" fullWidth disabled={loading} className="invite-button">
                  {loading ? <CircularProgress size={24} /> : 'Send Invitation'}
                </Button>
              </Grid>
            </Grid>
          </form>
        </div>

        <Divider className="section-divider" />

        {/* --- Current Members Section --- */}
        <div className="members-section">
          <Typography variant="h6" className="section-title">
            Current Workspace Members
          </Typography>
          
          <List className="members-list">
            {members.map((member, index) => (
                 <ListItem key={index}>
                    <ListItemAvatar><Avatar src={member.photoURL}><PersonIcon /></Avatar></ListItemAvatar>
                    <ListItemText primary={member.displayName} secondary={member.email} />
                    <Chip label={member.role} color={member.role === 'owner' ? 'primary' : 'default'} size="small" />
                 </ListItem>
            ))}
          </List>
        </div>
      </Paper>

      <Snackbar open={feedback.open} autoHideDuration={6000} onClose={handleCloseFeedback}>
        <Alert onClose={handleCloseFeedback} severity={feedback.severity} variant="filled">
          {feedback.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default Team;