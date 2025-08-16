// src/components/AdminRoute.js
import React from 'react';
import { Route, Redirect } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Layout from './Layout/Layout';

const AdminRoute = ({ children, ...rest }) => {
    const { currentUser, isAdmin, loading } = useAuth();
    if (loading) return <div>Loading...</div>;
    return (
        <Route {...rest} render={({ location }) =>
            currentUser && isAdmin ? (
                <Layout>{children}</Layout>
            ) : (
                <Redirect to={{ pathname: "/", state: { from: location } }} />
            )
        } />
    );
};
export default AdminRoute;