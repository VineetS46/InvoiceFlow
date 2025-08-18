// src/hooks/useAuth.js (FINAL, COMPLETE, AND CORRECTED)
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged is now correctly imported and will work.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const firestoreData = userDoc.data();
          user.username = firestoreData.username;
          user.displayName = firestoreData.username || user.displayName;
          setCurrentUser(user);
        } else {
          // This handles first-time sign-ins (e.g., with Google)
          console.log(`First-time sign-in for UID ${user.uid}. Creating Firestore profile.`);
          const username = user.displayName || user.email.split('@')[0];
          const newUserProfile = {
            username: username,
            email: user.email,
            uid: user.uid,
            role: 'user' // All new users default to the 'user' role
          };
          await setDoc(userDocRef, newUserProfile);
          
          user.username = username;
          user.displayName = username;
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
        uid: user.uid,
        role: 'user' 
    });
    
    user.username = username;
    setCurrentUser(user);
    return userCredential;
  }
  
  // --- ALL LOGIN FUNCTIONS ARE NOW RESTORED ---
  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const loginWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  const value = {
    currentUser,
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