import React from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout/Layout';
import Login from './components/Auth/Login';
import Dashboard from './components/Dashboard/Dashboard';
import Analytics from './pages/Analytics';
import InvoiceHistory from './pages/InvoiceHistory';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import AdminRoute from './components/AdminRoute';
import Onboarding from './pages/Onboarding';
import Team from './pages/Team';

// --- THIS IS THE FINAL, ROBUST PrivateRoute using the 'onboardingRequired' flag ---
const PrivateRoute = ({ children, ...rest }) => {
  // Get the new 'onboardingRequired' flag from our auth context
  const { currentUser, loading, onboardingRequired } = useAuth();

  if (loading) {
    // Show a global loading indicator while the initial auth check is running.
    return <div>Loading...</div>;
  }

  return (
    <Route
      {...rest}
      render={({ location }) => {
        if (currentUser) {
          // User is logged in. Now, check the onboarding flag.
          if (onboardingRequired) {
            // If onboarding is required, the ONLY page they can see is /onboarding.
            // If they are already on that page, we render it.
            // If they try to go anywhere else, we force them back.
            return location.pathname === '/onboarding' 
              ? children 
              : <Redirect to="/onboarding" />;
          }
          // If onboarding is NOT required, they are a normal user. Show the app inside the Layout.
          return <Layout>{children}</Layout>;
        }
        
        // If there is no user, redirect to the login page.
        return <Redirect to={{ pathname: "/login", state: { from: location } }} />;
      }}
    />
  );
};
// ---

const PublicRoute = ({ component: Component, ...rest }) => {
    const { currentUser, loading } = useAuth();
    if (loading) {
        return <div>Loading...</div>; // Good practice to prevent content flashing
    }
    return <Route {...rest} render={props => currentUser ? <Redirect to="/" /> : <Component {...props} />} />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Switch>
          <PublicRoute path="/login" component={Login} />
          
          {/* The Onboarding route now uses PrivateRoute. */}
          {/* This is secure because the logic inside PrivateRoute will correctly */}
          {/* render it without the Layout for users who need it. */}
          <PrivateRoute path="/onboarding">
            <Onboarding />
          </PrivateRoute>

          {/* All other routes are now correctly protected */}
          <PrivateRoute exact path="/">
            <Dashboard />
          </PrivateRoute>
          <PrivateRoute path="/team">
            <Team />
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
          <AdminRoute path="/admin">
            <Admin />
          </AdminRoute>
          
          <Redirect from="*" to="/" />
        </Switch>
      </Router>
    </AuthProvider>
  );
}

export default App;