// src/pages/Onboarding.js
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Paper, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel, CircularProgress } from '@material-ui/core';
import './Onboarding.css'; // We will create this file next

const Onboarding = () => {
    const { signup } = useAuth();
    const history = useHistory();

    // Get the user's details passed from the signup page
    const { email, password, username } = history.location.state || {};
    
    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceType, setWorkspaceType] = useState('GENERAL_BUSINESS'); // Default selection
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Redirect if user lands here without signup info
    if (!email || !password || !username) {
        history.replace('/login');
        return null;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!workspaceName.trim()) {
            setError("Workspace name is required.");
            return;
        }

        try {
            setError('');
            setLoading(true);
            await signup(email, password, username, workspaceName, workspaceType);
            history.push('/'); // Redirect to dashboard on successful signup and workspace creation
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="onboarding-container">
            <Paper className="onboarding-card">
                <Typography variant="h4" component="h1" className="onboarding-title">
                    Welcome, {username}!
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
                            <MenuItem value="RETAIL_ECOMMERCE">Retail / E-commerce</MenuItem>
                            <MenuItem value="MANUFACTURING_CONSTRUCTION">Manufacturing / Construction</MenuItem>
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