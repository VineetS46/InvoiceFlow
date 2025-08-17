// src/hooks/useAuth.js (FINAL, WITH GOOGLE SIGN-IN PROFILE CREATION)
import React, { useContext, useState, useEffect, createContext } from 'react';
import { 
    onAuthStateChanged, 
    signOut, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup,
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const idTokenResult = await user.getIdTokenResult(true);
        setIsAdmin(idTokenResult.claims.role === 'admin');

        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        // --- THIS IS THE CRITICAL FIX ---
        if (userDoc.exists()) {
          // If the user's profile already exists in Firestore, load it.
          const firestoreData = userDoc.data();
          user.username = firestoreData.username;
          user.displayName = firestoreData.username || user.displayName;
          setCurrentUser(user);
        } else {
          // If the profile does NOT exist, it's a first-time sign-in (likely with Google).
          // We must create their profile document now.
          console.log(`First-time sign-in for UID ${user.uid}. Creating Firestore profile.`);
          const username = user.displayName || user.email.split('@')[0];
          const newUserProfile = {
            username: username,
            email: user.email,
            uid: user.uid,
            role: 'user' // All new users default to the 'user' role
          };
          await setDoc(userDocRef, newUserProfile);
          
          // Now that the profile is created, add the data to the current user object.
          user.username = username;
          user.displayName = username;
          setCurrentUser(user);
        }
        // --- END OF FIX ---
      } else {
        setCurrentUser(null);
        setIsAdmin(false);
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
        uid: user.uid,
        role: 'user' 
    });
    
    user.username = username;
    setCurrentUser(user);
    setIsAdmin(false); // New signups are never admins
    return userCredential;
  }
  
  // No changes needed to login, logout, etc.
  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const loginWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  const value = {
    currentUser,
    isAdmin,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}