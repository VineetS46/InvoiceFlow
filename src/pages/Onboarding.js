import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Paper, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel, CircularProgress } from '@material-ui/core';
import './Onboarding.css';

const Onboarding = () => {
  // Get the new completeOnboarding function and the currentUser
  const { completeOnboarding, currentUser } = useAuth();
  const history = useHistory();
  
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceType, setWorkspaceType] = useState('GENERAL_BUSINESS');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!workspaceName.trim()) {
      setError("Workspace name is required.");
      return;
    }

    try {
      setError('');
      setLoading(true);
      // Call the new function to finalize the user's profile and workspace
      await completeOnboarding(workspaceName, workspaceType);
      // The onAuthStateChanged listener will now see that onboarding is complete
      // and the PrivateRoute will automatically redirect to the dashboard.
      history.push('/');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-container">
      <Paper className="onboarding-card">
        <Typography variant="h4" component="h1" className="onboarding-title">
          {/* Use the displayName from the currentUser object */}
          Welcome, {currentUser?.displayName || 'there'}!
        </Typography>
        <Typography color="textSecondary" className="onboarding-subtitle">
          Let's set up your workspace to get started.
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Workspace Name"
            variant="outlined"
            fullWidth
            required
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="e.g., My Company or Personal Finance"
            className="onboarding-field"
          />
          <FormControl variant="outlined" fullWidth className="onboarding-field">
            <InputLabel>What will you be using InvoiceFlow for?</InputLabel>
            <Select
              value={workspaceType}
              onChange={(e) => setWorkspaceType(e.target.value)}
              label="What will you be using InvoiceFlow for?"
            >
              <MenuItem value="GENERAL_BUSINESS">General Business</MenuItem>
              <MenuItem value="PERSONAL_FINANCE">Personal Finance</MenuItem>
              <MenuItem value="IT_SERVICES">IT Services / Tech</MenuItem>
              {/* Add other template options here if you created them */}
            </Select>
          </FormControl>

          {error && <Typography color="error" className="onboarding-error">{error}</Typography>}

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
            className="onboarding-button"
          >
            {loading ? <CircularProgress size={24} /> : 'Create Workspace & Continue'}
          </Button>
        </form>
      </Paper>
    </div>
  );
};

export default Onboarding;