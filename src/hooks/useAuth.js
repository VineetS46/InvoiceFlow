// src/hooks/useAuth.js (FINAL AND PERMANENT FIX)
import React, { useContext, useState, useEffect, createContext } from 'react';
import { 
    onAuthStateChanged, 
    signOut, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile 
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from '../firebaseConfig';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const firestoreData = userDoc.data();
          
          // --- THIS IS THE PERMANENT FIX ---
          // We are NOT creating a new object. We are modifying the original
          // Firebase 'user' object to include our custom properties.
          // This preserves all the original methods like getIdToken().
          user.username = firestoreData.username;
          user.displayName = firestoreData.username || user.displayName;
          
          setCurrentUser(user); // Set the modified, but still "real", user object

        } else {
          // If no custom doc, just use the original user object
          setCurrentUser(user);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signup(email, password, username) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateProfile(user, { displayName: username });
    await setDoc(doc(db, "users", user.uid), {
        username: username,
        email: email,
    });

    // Manually update state after signup to ensure immediate consistency
    user.username = username;
    setCurrentUser(user);
    
    return userCredential;
  }

  function login(email, password) { return signInWithEmailAndPassword(auth, email, password); }
  function loginWithGoogle() { const provider = new GoogleAuthProvider(); return signInWithPopup(auth, provider); }
  function logout() { return signOut(auth); }
  function resetPassword(email) { return sendPasswordResetEmail(auth, email); }

  const value = {
    currentUser,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}