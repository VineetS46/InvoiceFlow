import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  Avatar, 
  IconButton, 
  Tooltip,
  Typography,
  Divider
} from '@material-ui/core';
import {
  Dashboard as DashboardIcon,
  BarChart as AnalyticsIcon,
  Receipt as InvoiceIcon,
  Person as ProfileIcon,
  Group as TeamIcon, // For Team Management
  Security as AdminIcon, // For Admin Panel
  ExitToApp as LogoutIcon,
  Menu as MenuIcon
} from '@material-ui/icons'; // Corrected import path
import './Layout.css';
import Logo from '../../assets/icon/logo.svg';

const Layout = ({ children }) => {
  // Get all necessary context from the useAuth hook
  const { currentUser, logout, isAdmin, userProfile, currentWorkspace, loading } = useAuth();
  
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Use useMemo to create a stable navigation list that only recalculates when dependencies change.
  // This is the robust solution to prevent rendering issues.
  const navItems = useMemo(() => {
    // Start with the base navigation items that every user sees
    const baseItems = [
      { path: '/', label: 'Dashboard', icon: <DashboardIcon htmlColor="#5d46ff" /> },
      { path: '/analytics', label: 'Analytics', icon: <AnalyticsIcon htmlColor="#5d46ff" /> },
      { path: '/invoice-history', label: 'Invoice History', icon: <InvoiceIcon htmlColor="#5d46ff" /> },
      { path: '/profile', label: 'Profile', icon: <ProfileIcon htmlColor="#5d46ff" /> },
    ];

    // Determine the user's role in the currently active workspace
    const workspaceId = currentWorkspace?.id;
    const userRoleInWorkspace = userProfile?.workspaces?.[workspaceId];

    // Conditionally add the "Team Management" link only if the user is an owner
    if (userRoleInWorkspace === 'owner') {
      baseItems.push({
        path: '/team',
        label: 'Team Management',
        icon: <TeamIcon htmlColor="#5d46ff" />
      });
    }

    // Conditionally add the "Admin Panel" link if the user has the global admin role
    if (isAdmin) {
      baseItems.push({
        path: '/admin',
        label: 'Admin Panel',
        icon: <AdminIcon htmlColor="#5d46ff" />
      });
    }

    return baseItems;
  }, [isAdmin, userProfile, currentWorkspace]); // Dependencies that trigger recalculation

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = async () => {
    try {
      await logout();
      // Redirects are handled by the PrivateRoute component
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };
  
  // Prevent rendering the layout with incomplete data during the initial load
  if (loading || !currentUser) {
    return null; // Render nothing until authentication is confirmed
  }
  
  const userRoleInWorkspace = userProfile?.workspaces?.[currentWorkspace?.id];

  return (
    <div className="layout-root">
      <header className="mobile-header">
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={handleDrawerToggle}
          className="menu-button"
        >
          <MenuIcon htmlColor="#333" />
        </IconButton>
        <Typography variant="h6" className="mobile-title">
          InvoiceFlow
        </Typography>
      </header>

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-container">
          <div className="sidebar-top">
            <div className="logo-container">
              <img src={Logo} alt="InvoiceFlow" className="logo" />
              <Typography variant="h4" className="logo-text">
                InvoiceFlow
              </Typography>
            </div>
          </div>
          
          <Divider className="sidebar-divider" />

          <nav className="sidebar-nav">
            <ul className="nav-list">
              {navItems.map((item) => (
                <li 
                  key={item.path} 
                  className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                >
                  <Link to={item.path} className="nav-link">
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-text">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="sidebar-footer">
            <Divider className="sidebar-divider" />
            <div className="user-info">
              <Avatar 
                className="user-avatar"
                src={currentUser?.photoURL}
              >
                {currentUser?.displayName?.charAt(0) || currentUser?.email?.charAt(0).toUpperCase()}
              </Avatar>
              <div className="user-details">
                <Typography className="user-name">
                  {currentUser?.displayName || 'User'}
                  {/* Display the user's role in the current workspace */}
                  {userRoleInWorkspace && <span className={`role-badge ${userRoleInWorkspace}`}>{userRoleInWorkspace}</span>}
                </Typography>
                <Typography className="user-email">
                  {currentUser?.email}
                </Typography>
              </div>
              <Tooltip title="Logout">
                <IconButton 
                  onClick={handleLogout} 
                  className="logout-btn"
                >
                  <LogoutIcon fontSize="small" htmlColor="#5d46ff" />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>

      {mobileOpen && (
        <div className="sidebar-overlay" onClick={handleDrawerToggle} />
      )}
    </div>
  );
};

export default Layout;