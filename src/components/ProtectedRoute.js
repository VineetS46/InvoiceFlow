// src/components/ProtectedRoute.js
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth'; // Import our custom hook

const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // While Firebase is checking for a user, show a loading message
    return <div>Loading Application...</div>;
  }

  if (!currentUser) {
    // If there's no user, redirect to the login page
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If a user is logged in, render the protected content (e.g., the Layout)
  return children;
};

export default ProtectedRoute;