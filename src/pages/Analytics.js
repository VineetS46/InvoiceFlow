import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../helpers/api';
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
  const auth = useAuth();
  const { currentUser, currentWorkspace } = auth;
  
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  const [activeIndex, setActiveIndex] = useState(null);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!currentUser || !currentWorkspace) {
          setIsLoading(false);
          return;
      }

      setIsLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (selectedCategory) params.append('category', selectedCategory);

        const data = await api.get(`getAnalyticsData?${params.toString()}`, auth);
        setAnalyticsData(data);
      } catch (err) {
        setError(err.message);
        setAnalyticsData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [auth, currentUser, currentWorkspace, startDate, endDate, selectedCategory]);

  const userCategories = useMemo(() => {
    return currentWorkspace?.categories?.map(cat => cat.name) || [];
  }, [currentWorkspace]);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedCategory('');
  };

  const formatCurrency = (amount, currencyCode = 'INR') => {
    if (typeof amount !== 'number') return 'N/A';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyCode }).format(amount);
  };

  const colors = ['#1976d2', '#42a5f5', '#00bcd4', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#673ab7'];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const name = payload[0].payload.name || payload[0].payload.month;
      return (
        <div className="custom-tooltip" style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <p className="label">{`${name} : ${formatCurrency(payload[0].value)}`}</p>
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

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <h1>Financial Analytics</h1>
      </header>
      
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
                {userCategories.map(cat => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
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
      
      <Grid container spacing={3} className="kpi-container">
        <Grid item xs={12} md={4}>
            <KpiCard title="Total Spent" value={formatCurrency(analyticsData?.kpis?.totalSpent || 0)} icon={<MonetizationOn />} />
        </Grid>
        <Grid item xs={12} md={4}>
            <KpiCard title="Top Category" value={analyticsData?.kpis?.topCategory || 'N/A'} icon={<Category />} />
        </Grid>
        <Grid item xs={12} md={4}>
            <KpiCard title="Overdue Amount" value={formatCurrency(analyticsData?.kpis?.overdueTotal || 0)} icon={<Warning />} colorClass={(analyticsData?.kpis?.overdueTotal || 0) > 0 ? 'overdue' : ''} />
        </Grid>
      </Grid>

      <Grid container spacing={3} className="charts-container">
        <Grid item xs={12} lg={6}>
          <Paper className="chart-paper">
            <Typography variant="h6" className="chart-title">Spending by Category</Typography>
            <Grid container alignItems="center" style={{ minHeight: '300px' }}>
              {(analyticsData?.spendingByCategory || []).length > 0 ? (
                <>
                  <Grid item xs={12} sm={6}>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={analyticsData.spendingByCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5} onMouseEnter={(_, index) => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)}>
                          {analyticsData.spendingByCategory.map((entry, index) => (
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
                      {analyticsData.spendingByCategory.map((entry, index) => (
                        <li key={`item-${index}`} className="legend-item" onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)}>
                          <div className="legend-color-box" style={{ backgroundColor: colors[index % colors.length] }} />
                          <div className="legend-text">
                            <span className="legend-label">{entry.name}</span>
                            <span className="legend-value">{formatCurrency(entry.value)} ({ (analyticsData.kpis?.totalSpent || 0) > 0 ? ((entry.value / analyticsData.kpis.totalSpent) * 100).toFixed(0) : 0}%)</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Grid>
                </>
              ) : (
                <Grid item xs={12} style={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="textSecondary">No category data to display for the selected period.</Typography>
                </Grid>
              )}
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