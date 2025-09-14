import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  Paper, Grid, TextField, FormControl, InputLabel, Select,
  MenuItem, Button, Typography, IconButton, CircularProgress, Tooltip
} from '@material-ui/core';
import {
  MonetizationOn, Category, Warning, Clear
} from '@material-ui/icons';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import './Analytics.css';

// A reusable component for our KPI cards
const KpiCard = ({ title, value, icon, colorClass = '' }) => (
  <Paper className="kpi-card">
    <div className="kpi-icon">{icon}</div>
    <div className="kpi-text">
      <Typography variant="h6">{title}</Typography>
      <Typography variant="h4" className={`kpi-value ${colorClass}`}>{value}</Typography>
    </div>
  </Paper>
);

const Analytics = () => {
  const { currentUser } = useAuth();
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State for filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  const [activeIndex, setActiveIndex] = useState(null);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!currentUser) return;

      setIsLoading(true);
      setError('');

      try {
        const token = await currentUser.getIdToken();
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (selectedCategory) params.append('category', selectedCategory);

        const response = await fetch(`http://localhost:7071/api/getAnalyticsData?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to fetch analytics data.');
        }

        const data = await response.json();
        setAnalyticsData(data);
      } catch (err) {
        setError(err.message);
        setAnalyticsData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [currentUser, startDate, endDate, selectedCategory]);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedCategory('');
  };

  const formatCurrency = (amount, currencyCode = 'INR') => {
    if (typeof amount !== 'number') return amount; // Return non-numbers as is
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyCode }).format(amount);
  };

  const colors = ['#1976d2', '#42a5f5', '#00bcd4', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#673ab7'];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip" style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <p className="label">{`${payload[0].name} : ${formatCurrency(payload[0].value)}`}</p>
        </div>
      );
    }
    return null;
  };
  
  if (isLoading) {
    return <div className="loading-container"><CircularProgress /></div>;
  }
  
  if (error) {
    return <div className="error-container">{error}</div>;
  }
  
  const categories = [ 'Office Supplies', 'Software & Subscriptions', 'Utilities', 'Rent & Lease', 'Marketing & Advertising', 'Travel & Accommodation', 'Meals & Entertainment', 'Professional Services', 'Contractors & Freelancers', 'Hardware & Equipment', 'Shipping & Postage', 'Insurance', 'Phone & Internet', 'Employee Benefits', 'Other' ];

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <h1>Financial Analytics</h1>
      </header>
      
      {/* --- THIS IS THE CORRECTED FILTER BAR UI --- */}
      <Paper className="filters-paper">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth variant="outlined" size="small" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth variant="outlined" size="small" />
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel>Category</InputLabel>
              <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} label="Category">
                <MenuItem value=""><em>All Categories</em></MenuItem>
                {categories.map(cat => (<MenuItem key={cat} value={cat}>{cat}</MenuItem>))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={1} style={{ textAlign: 'center' }}>
            <Tooltip title="Clear Filters">
              <IconButton onClick={clearFilters}><Clear /></IconButton>
            </Tooltip>
          </Grid>
        </Grid>
      </Paper>
      {/* --- END OF FILTER BAR --- */}
      
      <Grid container spacing={3} className="kpi-container">
        <Grid item xs={12} md={4}>
          <KpiCard title="Total Spent" value={formatCurrency(analyticsData?.kpis?.totalSpent || 0)} icon={<MonetizationOn />} />
        </Grid>
        <Grid item xs={12} md={4}>
          <KpiCard title="Top Category" value={analyticsData?.kpis?.topCategory || 'N/A'} icon={<Category />} />
        </Grid>
        <Grid item xs={12} md={4}>
          <KpiCard title="Overdue Invoices" value={analyticsData?.kpis?.overdueCount || 0} icon={<Warning />} colorClass={(analyticsData?.kpis?.overdueCount || 0) > 0 ? 'overdue' : ''} />
        </Grid>
      </Grid>

      <Grid container spacing={3} className="charts-container">
        <Grid item xs={12} lg={6}>
          <Paper className="chart-paper">
            <Typography variant="h6" className="chart-title">Spending by Category</Typography>
            <Grid container alignItems="center">
              <Grid item xs={12} sm={6}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={analyticsData?.spendingByCategory || []} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5} onMouseEnter={(_, index) => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)}>
                      {(analyticsData?.spendingByCategory || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]}
                          transform={activeIndex === index ? 'scale(1.1)' : 'scale(1)'}
                          style={{ transition: 'transform 0.2s ease-in-out' }}/>
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </Grid>
              <Grid item xs={12} sm={6}>
                <ul className="custom-legend">
                  {(analyticsData?.spendingByCategory || []).length > 0 ? (
                    (analyticsData?.spendingByCategory || []).map((entry, index) => (
                      <li key={`item-${index}`} className="legend-item" onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)}>
                        <div className="legend-color-box" style={{ backgroundColor: colors[index % colors.length] }} />
                        <div className="legend-text">
                          <span className="legend-label">{entry.name}</span>
                          <span className="legend-value">{formatCurrency(entry.value)} ({ (analyticsData?.kpis?.totalSpent || 0) > 0 ? ((entry.value / analyticsData.kpis.totalSpent) * 100).toFixed(0) : 0}%)</span>
                        </div>
                      </li>
                    ))
                  ) : (
                    <Typography variant="body2" color="textSecondary" align="center">No category data to display for the selected period.</Typography>
                  )}
                </ul>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={6}>
          <Paper className="chart-paper">
            <Typography variant="h6" className="chart-title">Spending Over Time</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData?.spendingByMonth || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `₹${value / 1000}k`} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="total" name="Spend" fill="#1976d2" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
};

export default Analytics;