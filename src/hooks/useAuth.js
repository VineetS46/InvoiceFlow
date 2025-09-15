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
import { doc, getDoc, setDoc, writeBatch, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from '../firebaseConfig';
import { v4 as uuidv4 } from 'uuid';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

const CATEGORY_TEMPLATES = {
    'GENERAL_BUSINESS': [
        { name: "Software & SaaS", tags: ["microsoft", "adobe", "zoom", "saas", "subscription", "office 365", "google workspace", "canva", "notion"] },
        { name: "Marketing & Advertising", tags: ["google ads", "facebook ads", "marketing", "seo", "brightedge", "mailchimp"] },
        { name: "Professional Services", tags: ["legal", "accounting", "consulting", "law firm", "website redesign"] },
        { name: "Office Supplies & Equipment", tags: ["staples", "office depot", "stationery", "supplies", "hardware", "equipment", "dell", "lenovo"] },
        { name: "Shipping & Postage", tags: ["fedex", "dhl", "ups", "shipping", "courier", "postage"] },
        { name: "Utilities", tags: ["electric", "water", "gas", "internet", "phone"] },
        { name: "Rent & Lease", tags: ["rent", "lease", "office space"] },
        { name: "Business Insurance", tags: ["insurance", "liability", "policy"] },
    ],
    'PERSONAL_FINANCE': [
        { name: "Housing", tags: ["rent", "mortgage", "property tax", "home maintenance"] },
        { name: "Utilities", tags: ["electricity", "water", "gas", "phone", "internet"] },
        { name: "Groceries", tags: ["grocery", "supermarket", "walmart", "big bazaar"] },
        { name: "Transportation", tags: ["fuel", "gasoline", "public transit", "vehicle maintenance", "ride sharing", "uber", "lyft", "ola"] },
        { name: "Health & Wellness", tags: ["insurance", "pharmacy", "gym", "medical", "doctor", "dentist", "mamaearth", "honasa"] },
        { name: "Shopping & Retail", tags: ["clothing", "electronics", "hobbies", "amazon", "flipkart"] },
        { name: "Meals & Entertainment", tags: ["restaurant", "cafe", "takeout", "zomato", "swiggy", "doordash", "starbucks", "events", "movies", "subscriptions"] },
        { name: "Education", tags: ["tuition", "books", "courses", "udemy"] },
        { name: "Travel & Accommodation", tags: ["flight", "hotel", "airbnb", "marriott", "hilton", "expedia"] },
    ],
    'IT_SERVICES': [
        { name: "Software Licensing", tags: ["microsoft", "oracle", "jet-brains", "license", "vmware"] },
        { name: "Cloud Services", tags: ["aws", "azure", "google cloud", "gcp", "hosting", "domain", "digitalocean"] },
        { name: "Hardware Procurement", tags: ["dell", "lenovo", "server", "laptop", "hardware", "networking"] },
        { name: "Employee Salaries", tags: ["salary", "payroll"] },
        { name: "Subcontractor Fees", tags: ["contractor", "freelaner", "consultant"] },
    ],
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingRequired, setOnboardingRequired] = useState(false); // The critical state flag

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const userDocRef = doc(db, 'users', user.uid);
        let userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          // This is a returning user who has completed onboarding.
          setOnboardingRequired(false);
          const profile = userDoc.data();
          setUserProfile(profile);
          if (profile.workspaces && Object.keys(profile.workspaces).length > 0) {
            const firstWorkspaceId = Object.keys(profile.workspaces)[0];
            const workspaceDoc = await getDoc(doc(db, 'workspaces', firstWorkspaceId));
            if (workspaceDoc.exists()) {
              setCurrentWorkspace({ id: workspaceDoc.id, ...workspaceDoc.data() });
            }
          }
        } else {
          // This is a brand new user (from email signup or first Google sign-in).
          // We set the flag to force them to the onboarding page.
          setOnboardingRequired(true);
        }
      } else {
        // User logged out, reset everything
        setCurrentUser(null);
        setUserProfile(null);
        setCurrentWorkspace(null);
        setOnboardingRequired(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Simplified signup: just creates the auth user.
  // The onAuthStateChanged hook will then trigger the onboarding flow.
  async function signup(email, password, username) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Set their display name so it can be used on the onboarding screen
    await updateProfile(userCredential.user, { displayName: username });
    return userCredential;
  }
  
  // NEW function called ONLY from the Onboarding screen
  async function completeOnboarding(workspaceName, workspaceType) {
    if (!currentUser) throw new Error("User not authenticated for onboarding.");
    
    // Check for an invitation FIRST.
    const invitesRef = collection(db, "invites");
    const q = query(invitesRef, where("email", "==", currentUser.email.toLowerCase()), where("status", "==", "pending"));
    const inviteSnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    const userDocRef = doc(db, 'users', currentUser.uid);
    let workspaceId;
    let userRole;
    
    if (!inviteSnapshot.empty) {
      // Employee workflow: Use the invited workspace
      const inviteDoc = inviteSnapshot.docs[0];
      const inviteData = inviteDoc.data();
      workspaceId = inviteData.workspaceId;
      userRole = inviteData.role;
      
      const inviteDocRef = doc(db, 'invites', inviteDoc.id);
      batch.update(inviteDocRef, { status: "accepted", acceptedAt: new Date(), acceptedBy: currentUser.uid });
      
    } else {
      // Owner workflow: Create a new workspace
      workspaceId = `ws_${uuidv4()}`;
      userRole = "owner";
      const categoryTemplate = CATEGORY_TEMPLATES[workspaceType] || CATEGORY_TEMPLATES['GENERAL_BUSINESS'];
      const workspaceDocRef = doc(db, "workspaces", workspaceId);
      batch.set(workspaceDocRef, {
        name: workspaceName,
        ownerId: currentUser.uid,
        plan: "free",
        categories: categoryTemplate,
        createdAt: new Date()
      });
    }

    // Create the user profile document
    const newUserProfile = {
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      email: currentUser.email,
      workspaces: { [workspaceId]: userRole }
    };
    batch.set(userDocRef, newUserProfile);
    await batch.commit();

    // Onboarding is now complete. Turn off the flag and load the data.
    const finalWorkspaceDoc = await getDoc(doc(db, 'workspaces', workspaceId));
    setUserProfile(newUserProfile);
    setCurrentWorkspace({ id: finalWorkspaceDoc.id, ...finalWorkspaceDoc.data() });
    setOnboardingRequired(false);
  }

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const loginWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  const value = {
    currentUser,
    userProfile,
    currentWorkspace,
    loading,
    onboardingRequired, // The flag our router will use
    signup,
    completeOnboarding, // The function for the onboarding screen
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