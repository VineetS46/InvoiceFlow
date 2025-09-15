import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
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
  const { currentUser, currentWorkspace, userProfile } = useAuth();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });
  
  // State to hold the list of members (we'll fetch this in the future)
  const [members, setMembers] = useState([]);

  // This useEffect will populate the initial members list for the UI
  useEffect(() => {
    if (currentUser && userProfile) {
        // For now, we only show the current user (the owner)
        // A future version would fetch all users belonging to currentWorkspace.id
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
    
    if (!currentUser || !currentWorkspace) {
      setFeedback({ open: true, message: 'Authentication error. Please refresh and try again.', severity: 'error' });
      return;
    }

    setLoading(true);

    try {
      const token = await currentUser.getIdToken();
      
      const response = await fetch('http://localhost:7071/api/inviteUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-workspace-id': currentWorkspace.id
        },
        body: JSON.stringify({
          email: email,
          role: role,
          workspaceName: currentWorkspace.name
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation');
      }

      setFeedback({ open: true, message: `Invitation sent to ${email}!`, severity: 'success' });
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