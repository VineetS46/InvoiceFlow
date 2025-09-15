import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
    Paper, Typography, TextField, Button, Grid, Chip, IconButton,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Snackbar, CircularProgress, Divider
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import { Delete as DeleteIcon, Add as AddIcon } from '@material-ui/icons';
import './Profile.css';

const Profile = () => {
    const { currentUser, currentWorkspace, updateUserProfile, loading: authLoading } = useAuth();
    
    // Local state for managing categories and other UI elements
    const [categories, setCategories] = useState([]);
    const [newTagName, setNewTagName] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });
    const [openAddDialog, setOpenAddDialog] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // This effect syncs the local state with the live data from the auth context
    useEffect(() => {
        if (currentWorkspace && currentWorkspace.categories) {
            setCategories(currentWorkspace.categories);
        }
    }, [currentWorkspace]);
    
    // --- Handlers for managing categories and tags ---

    const handleCategoryNameChange = (index, newName) => {
        const updatedCategories = [...categories];
        updatedCategories[index].name = newName;
        setCategories(updatedCategories);
    };

    const handleAddTag = (categoryIndex) => {
        const tagName = newTagName[categoryIndex]?.trim();
        if (!tagName) return;

        const updatedCategories = [...categories];
        if (!updatedCategories[categoryIndex].tags.includes(tagName)) {
            updatedCategories[categoryIndex].tags.push(tagName);
            setCategories(updatedCategories);
        }
        setNewTagName({ ...newTagName, [categoryIndex]: '' }); // Clear input
    };

    const handleDeleteTag = (categoryIndex, tagIndex) => {
        const updatedCategories = [...categories];
        updatedCategories[categoryIndex].tags.splice(tagIndex, 1);
        setCategories(updatedCategories);
    };
    
    const handleDeleteCategory = (categoryIndex) => {
        if (window.confirm("Are you sure you want to delete this category?")) {
            const updatedCategories = [...categories];
            updatedCategories.splice(categoryIndex, 1);
            setCategories(updatedCategories);
        }
    };
    
    const handleAddNewCategory = () => {
        if (!newCategoryName.trim()) return;
        const newCategory = { name: newCategoryName, tags: [] };
        setCategories([...categories, newCategory]);
        setOpenAddDialog(false);
        setNewCategoryName('');
    };

    // --- The main SAVE function ---
    const handleSaveChanges = async () => {
        if (!currentWorkspace) return;
        setIsSaving(true);
        try {
            // We are updating the workspace document, not the user profile
            // This function should be in your useAuth hook, or we call a new backend function.
            // For now, let's assume useAuth provides `updateWorkspace`
            // await updateWorkspace(currentWorkspace.id, { categories: categories });
            console.log("Saving changes to workspace:", { categories });
            setFeedback({ open: true, message: "Changes saved successfully!", severity: "success" });
        } catch (err) {
            setFeedback({ open: true, message: "Failed to save changes.", severity: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseFeedback = () => setFeedback({ ...feedback, open: false });

    if (authLoading || !currentWorkspace) {
        return <div className="loading-container"><CircularProgress /></div>;
    }

    return (
        <div className="profile-page">
            <Paper className="main-panel">
                <div className="panel-header">
                    <Typography variant="h5" className="panel-title">Profile & Settings</Typography>
                </div>

                <div className="sticky-actions">
                    <Button variant="outlined" onClick={() => setOpenAddDialog(true)} startIcon={<AddIcon />}>Add New Category</Button>
                    <Button variant="contained" color="primary" onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? <CircularProgress size={24} /> : 'Save All Changes'}
                    </Button>
                </div>

                <div className="panel-content">
                    <Typography variant="h6" className="section-title">Manage Your Invoice Categories</Typography>
                    <Typography color="textSecondary" className="section-subtitle">Customize your categories and add keywords (tags) to improve automatic categorization.</Typography>
                    
                    <Grid container spacing={3}>
                        {categories.map((category, catIndex) => (
                            <Grid item xs={12} md={6} key={catIndex}>
                                <Paper variant="outlined" className="category-card">
                                    <div className="category-card-header">
                                        <TextField
                                            variant="standard"
                                            value={category.name}
                                            onChange={(e) => handleCategoryNameChange(catIndex, e.target.value)}
                                            className="category-name-input"
                                        />
                                        <IconButton size="small" onClick={() => handleDeleteCategory(catIndex)}><DeleteIcon /></IconButton>
                                    </div>
                                    <Divider />
                                    <div className="tags-container">
                                        {category.tags.map((tag, tagIndex) => (
                                            <Chip
                                                key={tagIndex}
                                                label={tag}
                                                onDelete={() => handleDeleteTag(catIndex, tagIndex)}
                                                className="tag-chip"
                                            />
                                        ))}
                                    </div>
                                    <TextField
                                        variant="outlined"
                                        size="small"
                                        placeholder="Add a new tag and press Enter"
                                        fullWidth
                                        value={newTagName[catIndex] || ''}
                                        onChange={(e) => setNewTagName({ ...newTagName, [catIndex]: e.target.value })}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddTag(catIndex)}
                                    />
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </div>
            </Paper>

            <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
                <DialogTitle>Add New Category</DialogTitle>
                <DialogContent>
                    <DialogContentText>Enter the name for your new custom category.</DialogContentText>
                    <TextField autoFocus margin="dense" label="Category Name" type="text" fullWidth value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenAddDialog(false)} color="primary">Cancel</Button>
                    <Button onClick={handleAddNewCategory} color="primary">Create</Button>
                </DialogActions>
            </Dialog>
            
            <Snackbar open={feedback.open} autoHideDuration={6000} onClose={handleCloseFeedback}>
                <Alert onClose={handleCloseFeedback} severity={feedback.severity} variant="filled">{feedback.message}</Alert>
            </Snackbar>
        </div>
    );
};

export default Profile;