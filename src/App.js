// src/App.js
import React from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import Dashboard from './components/Dashboard/Dashboard';
import Analytics from './pages/Analytics';
// Import other pages as needed
import InvoiceHistory from './pages/InvoiceHistory';
import Profile from './pages/Profile';

// Custom component to protect routes for logged-in users
const PrivateRoute = ({ children, ...rest }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a spinner
  }

  return (
    <Route
      {...rest}
      render={({ location }) =>
        currentUser ? (
          <Layout>{children}</Layout>
        ) : (
          <Redirect to={{ pathname: "/login", state: { from: location } }} />
        )
      }
    />
  );
};

// Custom component for routes that should only be seen by logged-out users
const PublicRoute = ({ component: Component, ...rest }) => {
    const { currentUser } = useAuth();
    return <Route {...rest} render={props => currentUser ? <Redirect to="/" /> : <Component {...props} />} />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Switch>
          <PublicRoute path="/login" component={Login} />
          
          <PrivateRoute exact path="/">
            <Dashboard />
          </PrivateRoute>
          <PrivateRoute path="/analytics">
            <Analytics />
          </PrivateRoute>
          <PrivateRoute path="/invoice-history">
            <InvoiceHistory />
          </PrivateRoute>
          <PrivateRoute path="/profile">
            <Profile />
          </PrivateRoute>
          
          {/* If no other route matches, this will catch it */}
          <Redirect to="/" />
        </Switch>
      </Router>
    </AuthProvider>
  );
}

export default App;