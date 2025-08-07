// src/hooks/useAuth.js
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
import { auth, db } from '../firebaseConfig'; // Ensure db is exported from your firebaseConfig

// 1. Create the context
const AuthContext = createContext();

// 2. Create the custom hook that components will use
export function useAuth() {
  return useContext(AuthContext);
}

// 3. Create the Provider Component
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // This effect runs once on mount to set up an auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // If a user is logged in, fetch their custom data from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          // If a document exists in Firestore, merge the data
          const firestoreData = userDoc.data();
          setCurrentUser({
            ...user, // Original Firebase auth data (uid, email, etc.)
            ...firestoreData, // Your custom data (username)
            // CRITICAL FIX: Ensure displayName is set from your Firestore username
            displayName: firestoreData.username || user.displayName, 
          });
        } else {
          // For users who might not have a Firestore doc (e.g., initial Google sign-in)
          setCurrentUser(user);
        }
      } else {
        // No user is logged in
        setCurrentUser(null);
      }
      setLoading(false);
    });

    // Cleanup the listener when the component unmounts
    return unsubscribe;
  }, []);

  // --- Authentication Functions ---

  async function signup(email, password, username) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Set the display name in Firebase Authentication itself
    await updateProfile(user, { displayName: username });

    // Also create the user's profile document in Firestore
    await setDoc(doc(db, "users", user.uid), {
        username: username,
        email: email,
    });
    return userCredential;
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }
  
  function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    // This could be expanded to also check/create a Firestore doc on first login
    return signInWithPopup(auth, provider);
  }

  function logout() {
    return signOut(auth);
  }
  
  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  // The value provided to all children of this provider
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
      {/* Don't render the app until we know the user's auth status */}
      {!loading && children}
    </AuthContext.Provider>
  );
}