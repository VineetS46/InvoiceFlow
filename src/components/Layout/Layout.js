import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Security as AdminIcon } from '@material-ui/icons';
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
  Group as TeamIcon,
  ExitToApp as LogoutIcon,
  Menu as MenuIcon
} from '@material-ui/icons';
import './Layout.css';
import Logo from '../../assets/icon/logo.svg';

const Layout = ({ children }) => {
  
  // --- THIS IS THE FIX ---
  // We need to get currentWorkspace and userProfile from the useAuth hook
  const { currentUser, logout, isAdmin, userRole, currentWorkspace, userProfile } = useAuth();
  // --- END OF FIX ---

  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <DashboardIcon htmlColor="#5d46ff" /> },
    { path: '/analytics', label: 'Analytics', icon: <AnalyticsIcon htmlColor="#5d46ff" /> },
    { path: '/invoice-history', label: 'Invoice History', icon: <InvoiceIcon htmlColor="#5d46ff" /> },
    { path: '/profile', label: 'Profile', icon: <ProfileIcon htmlColor="#5d46ff" /> },
  ];

  // This logic is now correct because the variables are defined
  const workspaceId = currentWorkspace?.id;
  const userRoleInWorkspace = userProfile?.workspaces?.[workspaceId];

  if (userRoleInWorkspace === 'owner') {
    navItems.push({
      path: '/team',
      label: 'Team Management',
      icon: <TeamIcon htmlColor="#5d46ff" />
    });
  }

  if (isAdmin) {
    navItems.push({
      path: '/admin',
      label: 'Admin Panel',
      icon: <AdminIcon htmlColor="#5d46ff" />
    });
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      // history.push('/login') is handled by the PrivateRoute component now
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };
  
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
                  {userRole && <span className={`role-badge ${userRole}`}>{userRoleInWorkspace || userRole}</span>}
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