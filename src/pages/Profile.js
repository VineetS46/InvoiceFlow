import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateProfile } from "firebase/auth";
import {
    Paper, Typography, Button, Grid, Chip, IconButton,
    Dialog, DialogActions, DialogContent, DialogTitle, DialogContentText,
    TextField, Divider, Snackbar, CircularProgress, Tooltip
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, Search } from '@material-ui/icons';
import './Profile.css';

// A reusable Card component to apply consistent styling
const CategoryCard = ({ category, onEdit, onDelete, isSaving }) => (
    <Paper className="category-card">
        <div className="card-header">
            <Typography variant="h6" className="card-title">{category.name}</Typography>
            <div className="card-actions">
                <Tooltip title="Edit Category & Tags">
                    <IconButton size="small" onClick={onEdit} disabled={isSaving}>
                        <EditIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Delete Category">
                    <IconButton size="small" onClick={onDelete} disabled={isSaving}>
                        <DeleteIcon />
                    </IconButton>
                </Tooltip>
            </div>
        </div>
        <div className="tag-container">
            {category.tags.length > 0 ? (
                category.tags.map((tag, tIdx) => (
                    <Chip
                        key={tIdx}
                        label={tag}
                        className="category-chip" // All chips will use this class for consistent styling
                    />
                ))
            ) : (
                <Typography variant="body2" color="textSecondary" style={{ padding: '8px 0' }}>No tags. Click 'Edit' to add.</Typography>
            )}
        </div>
    </Paper>
);

const Profile = () => {
    const { currentUser, currentWorkspace, updateWorkspace, loading: authLoading } = useAuth();

    const [categories, setCategories] = useState([]);
    const [displayName, setDisplayName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const [editDialog, setEditDialog] = useState({ open: false, index: -1, data: { name: '', tags: [] } });
    const [addDialog, setAddDialog] = useState({ open: false, name: '', tags: '' });

    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (currentWorkspace?.categories) {
            setCategories(JSON.parse(JSON.stringify(currentWorkspace.categories)));
        }
        if (currentUser?.displayName) {
            setDisplayName(currentUser.displayName);
        }
    }, [currentWorkspace, currentUser]);

    const filteredCategories = useMemo(() => {
        if (!searchTerm.trim()) return categories;
        const lowerCaseSearch = searchTerm.toLowerCase();
        return categories.filter(cat =>
            cat.name.toLowerCase().includes(lowerCaseSearch) ||
            cat.tags.some(tag => tag.toLowerCase().includes(lowerCaseSearch))
        );
    }, [categories, searchTerm]);

    const saveChangesToFirestore = async (updatedCategories, successMessage) => {
        if (!currentWorkspace) return;
        setIsSaving(true);
        try {
            await updateWorkspace(currentWorkspace.id, { categories: updatedCategories });
            setFeedback({ open: true, message: successMessage, severity: "success" });
        } catch (err) {
            setFeedback({ open: true, message: err.message || 'Failed to save changes.', severity: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenEdit = (index) => setEditDialog({ open: true, index, data: { ...categories[index] } });
    const handleCloseEdit = () => setEditDialog({ open: false, index: -1, data: { name: '', tags: [] } });

    const handleTagDelete = (tagIndex) => {
        const updatedTags = [...editDialog.data.tags];
        updatedTags.splice(tagIndex, 1);
        setEditDialog(prev => ({ ...prev, data: { ...prev.data, tags: updatedTags } }));
    };

    const handleTagAdd = (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            e.preventDefault();
            const newTag = e.target.value.trim().toLowerCase();
            if (newTag && !editDialog.data.tags.includes(newTag)) {
                setEditDialog(prev => ({ ...prev, data: { ...prev.data, tags: [...prev.data.tags, newTag] } }));
            }
            e.target.value = '';
        }
    };

    const handleEditSave = () => {
        const updatedCategories = [...categories];
        updatedCategories[editDialog.index] = editDialog.data;
        setCategories(updatedCategories);
        saveChangesToFirestore(updatedCategories, `Category "${editDialog.data.name}" updated.`);
        handleCloseEdit();
    };

    const handleDeleteCategory = (indexToDelete) => {
        if (window.confirm('Are you sure? This will permanently delete this category.')) {
            const updatedCategories = categories.filter((_, index) => index !== indexToDelete);
            setCategories(updatedCategories);
            saveChangesToFirestore(updatedCategories, "Category deleted.");
        }
    };

    const handleOpenAdd = () => setAddDialog({ open: true, name: '', tags: '' });
    const handleCloseAdd = () => setAddDialog({ open: false, name: '', tags: '' });

    const handleAddNewCategory = () => {
        const name = addDialog.name.trim();
        if (!name) return;
        const tags = addDialog.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        const updatedCategories = [...categories, { name, tags }];
        setCategories(updatedCategories);
        saveChangesToFirestore(updatedCategories, `Category "${name}" created.`);
        handleCloseAdd();
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
                <div className="panel-content">
                    <div className="category-manager-header">
                        <div>
                            <Typography variant="h6" className="section-title">Manage Your Invoice Categories</Typography>
                            <Typography color="textSecondary" className="section-subtitle">
                                Customize categories and add tags to improve automation.
                            </Typography>
                        </div>
                        <div className="header-actions">
                            <TextField
                                variant="outlined"
                                size="small"
                                placeholder="Search categories..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                InputProps={{ startAdornment: <Search color="action" style={{ marginRight: 8 }} /> }}
                            />
                            <Button variant="outlined" color="primary" onClick={handleOpenAdd} startIcon={<AddIcon />}>Add Category</Button>
                        </div>
                    </div>

                    <Grid container spacing={4}>
                        {filteredCategories.map((cat, i) => (
                            <Grid item xs={12} md={6} key={i}>
                                <CategoryCard
                                    category={cat}
                                    onEdit={() => handleOpenEdit(i)}
                                    onDelete={() => handleDeleteCategory(i)}
                                    isSaving={isSaving}
                                />
                            </Grid>
                        ))}
                    </Grid>
                </div>
            </Paper>

            <Dialog open={editDialog.open} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
                <DialogTitle>Edit "{editDialog.data.name}"</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" label="Category Name" type="text" fullWidth value={editDialog.data.name} onChange={(e) => setEditDialog(prev => ({ ...prev, data: { ...prev.data, name: e.target.value } }))} />
                    <div className="tags-container edit-tags">
                        {editDialog.data.tags.map((tag, idx) => (
                            <Chip key={idx} label={tag} onDelete={() => handleTagDelete(idx)} className="category-chip" />
                        ))}
                    </div>
                    <TextField placeholder="Type a new tag and press Enter" fullWidth margin="dense" onKeyDown={handleTagAdd} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEdit}>Cancel</Button>
                    <Button onClick={handleEditSave} color="primary" variant="contained" disabled={isSaving}>
                        {isSaving ? <CircularProgress size={20} /> : 'Update Category'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={addDialog.open} onClose={handleCloseAdd} maxWidth="sm" fullWidth>
                <DialogTitle>Add New Category</DialogTitle>
                <DialogContent>
                    <DialogContentText>Create a new category and add tags (keywords), separated by commas, to help with automation.</DialogContentText>
                    <TextField autoFocus margin="dense" label="Category Name" type="text" fullWidth value={addDialog.name} onChange={(e) => setAddDialog(prev => ({ ...prev, name: e.target.value }))} />
                    <TextField margin="dense" label="Initial Tags (comma-separated)" type="text" fullWidth value={addDialog.tags} onChange={(e) => setAddDialog(prev => ({ ...prev, tags: e.target.value }))} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseAdd}>Cancel</Button>
                    <Button onClick={handleAddNewCategory} color="primary" variant="contained" disabled={isSaving}>
                        {isSaving ? <CircularProgress size={20} /> : 'Create Category'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={feedback.open} autoHideDuration={4000} onClose={handleCloseFeedback}>
                <Alert onClose={handleCloseFeedback} severity={feedback.severity} variant="filled">{feedback.message}</Alert>
            </Snackbar>
        </div>
    );
};

export default Profile;