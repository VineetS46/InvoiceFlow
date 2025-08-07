// src/components/Auth/Login.js

import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button as MuiButton } from '@material-ui/core';

import './Login.css';

// --- CORRECTED PATHS (up two levels) ---
import { auth, db } from '../../firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile, setPersistence, browserSessionPersistence, browserLocalPersistence } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";

// --- CORRECTED PATHS and SVG IMPORT ---
import HeroLoginImg from '../../assets/img/hero-login.png';
import HeroRegisterImg from '../../assets/img/hero-register.png';
import GoogleLogo from '../../assets/icon/google-icon-logo-svgrepo-com.svg'; // Simple image import

const Login = () => {
  // --- USING useHistory for React Router v5 ---
  const history = useHistory();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSignIn = async () => {
    try {
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      let userEmail = loginInput;
      if (loginInput && !loginInput.includes('@')) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", loginInput.toLowerCase()));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          alert("Login failed: User with that username not found.");
          return;
        }
        userEmail = querySnapshot.docs[0].data().email;
      }
      await signInWithEmailAndPassword(auth, userEmail, password);
      history.push('/'); // Use history.push for v5
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    }
  };

  const handleRegister = async () => {
    if (!username || !email || !password || !confirmPassword) {
      alert("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username.toLowerCase()));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        alert("This username is already taken.");
        return;
      }
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: username });
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        username: username.toLowerCase(),
        email: email,
      });
      setShowSuccess(true);
    } catch (err) {
      alert(`Registration failed: ${err.message}`);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      history.push('/'); // Use history.push for v5
    } catch (err) {
      alert(`Google sign-in failed: ${err.message}`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isRegisterMode) {
      handleRegister();
    } else {
      handleSignIn();
    }
  };

  const handleCloseSuccessDialog = () => {
    setShowSuccess(false);
    setIsRegisterMode(false);
    setLoginInput(email);
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <>
      <div className="login-container-new">
        <div className="login-hero-new">
          <div className="hero-image-container">
            <img src={isRegisterMode ? HeroRegisterImg : HeroLoginImg} alt="Invoice Illustration" />
          </div>
        </div>
        <div className="login-form-wrapper">
          <div className="login-form-container">
            <h2>{isRegisterMode ? "Create an Account" : "Welcome Back"}</h2>
            <p className="caption">{isRegisterMode ? "Enter your details to get started." : "Sign in to your account"}</p>
            <button type="button" className="google-btn" onClick={handleGoogleSignIn}>
              {/* --- CORRECTED: Use standard <img> tag for SVG --- */}
              <img src={GoogleLogo} alt="Google Logo" className="google-icon" />
              Continue with Google
            </button>
            <div className="divider">OR CONTINUE WITH EMAIL</div>
            <form onSubmit={handleSubmit}>
              {isRegisterMode && (
                <div>
                  <label className="input-label" htmlFor="username">Username</label>
                  <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className="login-input" />
                </div>
              )}
              <div>
                <label className="input-label" htmlFor="email-username">{isRegisterMode ? "Email" : "Email or Username"}</label>
                <input id="email-username" type="text" value={isRegisterMode ? email : loginInput} onChange={isRegisterMode ? (e) => setEmail(e.target.value) : (e) => setLoginInput(e.target.value)} required className={`login-input ${loginInput ? 'login-input-filled' : ''}`} />
              </div>
              <div>
                <label className="input-label" htmlFor="password">Password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="login-input" />
              </div>
              {isRegisterMode && (
                 <div>
                  <label className="input-label" htmlFor="confirm-password">Confirm Password</label>
                  <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="login-input" />
                </div>
              )}
              {!isRegisterMode && <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><label><input type="checkbox" id="remember" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ marginRight: '8px' }}/>Remember me</label><a href="#">Forgot password?</a></div>}
              <button type="submit" className="login-btn">{isRegisterMode ? "Sign Up" : "Sign In"}</button>
            </form>
            <p className="signup-link">
              {isRegisterMode ? "Already have an account?" : "Don't have an account?"}
              <a href="#" onClick={(e) => { e.preventDefault(); setIsRegisterMode(!isRegisterMode); }}>
                {isRegisterMode ? " Sign In" : " Sign Up"}
              </a>
            </p>
          </div>
        </div>
      </div>
      <Dialog open={showSuccess} onClose={handleCloseSuccessDialog}>
        <DialogTitle>Registration Successful!</DialogTitle>
        <DialogContent><p>Your account has been created. Click OK to log in.</p></DialogContent>
        <DialogActions>
          <MuiButton onClick={handleCloseSuccessDialog} color="primary" variant="contained">OK</MuiButton>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Login;