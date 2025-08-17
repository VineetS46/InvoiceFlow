// src/components/AdminRoute.js
import React from 'react';
import { Route, Redirect } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from './Layout/Layout';
import { CircularProgress } from '@material-ui/core';

const AdminRoute = ({ children, ...rest }) => {
    const { currentUser, isAdmin, loading } = useAuth();

    if (loading) {
        return <div className="loading-container"><CircularProgress size={50} /></div>;
    }

    return (
        <Route {...rest} render={({ location }) =>
            currentUser && isAdmin ? (
                <Layout>{children}</Layout>
            ) : (
                // If not an admin, redirect to the dashboard.
                <Redirect to={{ pathname: "/", state: { from: location } }} />
            )
        } />
    );
};
export default AdminRoute;