import React, { useState } from 'react';
import {
  Paper,
  Grid,
  Typography,
  Button,
  TextField,
  Chip,
  IconButton,
  Box
} from '@material-ui/core';
import { Delete as DeleteIcon, Add as AddIcon } from '@material-ui/icons';
import './Profile.css';

const DEFAULT_CATEGORIES = [
  // Business & Professional
  { name: "Software & SaaS", tags: ["microsoft", "adobe", "zoom", "saas", "subscription", "office 365", "google workspace", "canva", "notion"] },
  { name: "Marketing & Advertising", tags: ["google ads", "facebook ads", "marketing", "seo", "brightedge", "mailchimp"] },
  { name: "Professional Services", tags: ["legal", "accounting", "consulting", "law firm", "website redesign"] },
  { name: "Contractors & Freelancers", tags: ["contractor", "freelancer", "upwork", "fiverr"] },
  { name: "Office Supplies & Equipment", tags: ["staples", "office depot", "stationery", "supplies", "hardware", "equipment", "dell", "lenovo"] },
  { name: "Shipping & Postage", tags: ["fedex", "dhl", "ups", "shipping", "courier", "postage"] },
  { name: "Business Insurance", tags: ["insurance", "liability", "policy"] },
  { name: "Inventory / CoGS", tags: ["inventory", "cost of goods sold", "raw materials"] },
  
  // Personal & General
  { name: "Housing", tags: ["rent", "lease", "mortgage", "property tax", "home maintenance"] },
  { name: "Utilities", tags: ["electric", "coned", "gas", "water", "utility"] },
  { name: "Phone & Internet", tags: ["verizon", "at&t", "comcast", "internet", "mobile", "jiofi"] },
  { name: "Groceries", tags: ["grocery", "supermarket", "walmart", "big bazaar"] },
  { name: "Transportation", tags: ["fuel", "gasoline", "public transit", "vehicle maintenance", "ride sharing", "uber", "lyft", "ola"] },
  { name: "Health & Wellness", tags: ["pharmacy", "mamaearth", "honasa", "healthkart", "gym", "fitness", "medical", "doctor", "dentist"] },
  { name: "Shopping & Retail", tags: ["clothing", "electronics", "hobbies", "amazon", "flipkart"] },
  { name: "Meals & Entertainment", tags: ["restaurant", "cafe", "takeout", "zomato", "swiggy", "doordash", "starbucks", "events", "movies"] },
  { name: "Education", tags: ["tuition", "books", "courses", "udemy"] },
  { name: "Travel & Accommodation", tags: ["flight", "hotel", "airbnb", "marriott", "hilton", "expedia"] },
  { name: "Banking & Finance", tags: ["bank fees", "credit card", "loan", "investment", "paypal", "stripe"] },
  { name: "Cloud Services", tags: ["aws", "azure", "google cloud", "hosting", "domain", "godaddy"] },
  { name: "Communication", tags: ["slack", "teams", "discord", "whatsapp business", "telegram"] },
  { name: "Design & Creative", tags: ["figma", "sketch", "photoshop", "creative suite", "stock photos"] },
  { name: "Other", tags: [] }
];

const Profile = () => {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [newTagInputs, setNewTagInputs] = useState({});

  const handleAddCategory = () => {
    setCategories([...categories, { name: "New Category", tags: [] }]);
  };

  const handleDeleteCategory = (index) => {
    setCategories(categories.filter((_, i) => i !== index));
  };

  const handleCategoryNameChange = (index, newName) => {
    const updated = [...categories];
    updated[index].name = newName;
    setCategories(updated);
  };

  const handleAddTag = (categoryIndex, tag) => {
    if (!tag.trim()) return;
    const updated = [...categories];
    if (!updated[categoryIndex].tags.includes(tag.trim().toLowerCase())) {
      updated[categoryIndex].tags.push(tag.trim().toLowerCase());
      setCategories(updated);
    }
    setNewTagInputs({ ...newTagInputs, [categoryIndex]: '' });
  };

  const handleDeleteTag = (categoryIndex, tagIndex) => {
    const updated = [...categories];
    updated[categoryIndex].tags.splice(tagIndex, 1);
    setCategories(updated);
  };

  const handleTagInputChange = (categoryIndex, value) => {
    setNewTagInputs({ ...newTagInputs, [categoryIndex]: value });
  };

  const handleTagInputKeyPress = (e, categoryIndex) => {
    if (e.key === 'Enter') {
      handleAddTag(categoryIndex, newTagInputs[categoryIndex] || '');
    }
  };

  const handleSaveChanges = () => {
    console.log('Categories saved:', categories);
  };

  return (
    <div className="profile-page">
      <Typography variant="h4" className="page-header">
        Profile & Settings
      </Typography>
      
      <Paper className="main-panel">
        <Box className="panel-header">
          <Typography variant="h5" className="panel-title">
            Manage Your Invoice Categories
          </Typography>
          <Typography variant="body2" className="panel-subtitle">
            Customize your categories and add keywords (tags) to improve automatic categorization.
          </Typography>
        </Box>

        <Box className="action-buttons">
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveChanges}
            className="save-button"
          >
            Save Changes
          </Button>
          <Button
            variant="outlined"
            onClick={handleAddCategory}
            startIcon={<AddIcon />}
          >
            Add New Category
          </Button>
        </Box>

        <Grid container spacing={3} className="categories-grid">
          {categories.map((category, categoryIndex) => (
            <Grid item xs={12} md={6} key={categoryIndex}>
              <Paper variant="outlined" className="category-card">
                <Box className="category-header">
                  <TextField
                    value={category.name}
                    onChange={(e) => handleCategoryNameChange(categoryIndex, e.target.value)}
                    variant="outlined"
                    size="small"
                    className="category-name-input"
                  />
                  <IconButton
                    onClick={() => handleDeleteCategory(categoryIndex)}
                    size="small"
                    className="delete-button"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>

                <Box className="tags-container">
                  {category.tags.map((tag, tagIndex) => (
                    <Chip
                      key={tagIndex}
                      label={tag}
                      onDelete={() => handleDeleteTag(categoryIndex, tagIndex)}
                      size="small"
                      className="tag-chip"
                    />
                  ))}
                </Box>

                <TextField
                  placeholder="Add new tag..."
                  value={newTagInputs[categoryIndex] || ''}
                  onChange={(e) => handleTagInputChange(categoryIndex, e.target.value)}
                  onKeyPress={(e) => handleTagInputKeyPress(e, categoryIndex)}
                  variant="outlined"
                  size="small"
                  fullWidth
                  className="add-tag-input"
                />
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </div>
  );
};

export default Profile;