// src/hooks/useAuth.js (FINAL, ROBUST VERSION)
import React, { useContext, useState, useEffect, createContext } from 'react';
import { 
    onAuthStateChanged, signOut, createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
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
          user.username = firestoreData.username;
          user.displayName = firestoreData.username || user.displayName;
          setCurrentUser(user);
        } else if (user.providerData.some(p => p.providerId === 'google.com')) {
            // This handles first-time Google Sign-In
            const username = user.displayName || user.email.split('@')[0];
            await setDoc(userDocRef, { username: username, email: user.email, uid: user.uid });
            user.username = username;
            setCurrentUser(user);
        } else {
            setCurrentUser(user);
        }
      } else {
        setCurrentUser(null);
      }
      // CRITICAL FIX: Only set loading to false AFTER all async work is done.
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
        uid: user.uid // Also store the uid here
    });

    user.username = username;
    setCurrentUser(user); // Manually update state for immediate feedback
    return userCredential;
  }

  const value = {
    currentUser,
    loading, // The dashboard will now wait for this to be false
    signup,
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    loginWithGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),
    logout: () => signOut(auth),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}