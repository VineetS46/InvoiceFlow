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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        let userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          // --- THIS IS THE NEW, CRITICAL INVITATION-HANDLING LOGIC ---
          // This user is authenticated but has no profile. Check for an invite.
          console.log(`New user detected: ${user.email}. Checking for pending invitations...`);
          
          const invitesRef = collection(db, "invites");
          const q = query(invitesRef, where("email", "==", user.email.toLowerCase()), where("status", "==", "pending"));
          const inviteSnapshot = await getDocs(q);

          if (!inviteSnapshot.empty) {
            // INVITATION FOUND! This is an employee joining a team.
            const inviteDoc = inviteSnapshot.docs[0];
            const inviteData = inviteDoc.data();
            console.log(`Invitation found for workspace: ${inviteData.workspaceName}`);
            
            const batch = writeBatch(db);
            
            // 1. Create the new user's profile document
            const newUserProfile = {
              uid: user.uid,
              displayName: user.displayName || user.email.split('@')[0],
              email: user.email,
              workspaces: {
                [inviteData.workspaceId]: inviteData.role // Assign workspace and role from invite
              }
            };
            batch.set(userDocRef, newUserProfile);
            
            // 2. Update the invitation to mark it as "accepted"
            const inviteDocRef = doc(db, 'invites', inviteDoc.id);
            batch.update(inviteDocRef, { status: "accepted", acceptedAt: new Date().toISOString(), acceptedBy: user.uid });
            
            await batch.commit();
            userDoc = await getDoc(userDocRef); // Re-fetch the user doc we just created
          } else {
            // NO INVITATION FOUND. This is a new owner creating their own workspace.
            console.log(`No invitation found. Creating a new default workspace for ${user.email}.`);
            const newWorkspaceId = `ws_${uuidv4()}`;
            const batch = writeBatch(db);

            const workspaceDocRef = doc(db, "workspaces", newWorkspaceId);
            batch.set(workspaceDocRef, {
              name: `${user.displayName || 'My'}'s Workspace`,
              ownerId: user.uid,
              plan: "free",
              categories: CATEGORY_TEMPLATES['GENERAL_BUSINESS'],
              createdAt: new Date()
            });

            const newUserProfile = {
              uid: user.uid,
              displayName: user.displayName || user.email.split('@')[0],
              email: user.email,
              workspaces: { [newWorkspaceId]: "owner" }
            };
            batch.set(userDocRef, newUserProfile);
            await batch.commit();
            userDoc = await getDoc(userDocRef); // Re-fetch the user doc
          }
        }
        
        // This part now runs for ALL users after their profile is guaranteed to exist
        const profile = userDoc.data();
        setUserProfile(profile);
        if (profile.workspaces && Object.keys(profile.workspaces).length > 0) {
          const firstWorkspaceId = Object.keys(profile.workspaces)[0];
          const workspaceDoc = await getDoc(doc(db, 'workspaces', firstWorkspaceId));
          if (workspaceDoc.exists()) {
            setCurrentWorkspace({ id: workspaceDoc.id, ...workspaceDoc.data() });
          }
        }
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setCurrentWorkspace(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Signup via Email/Password (still triggers the onboarding flow, which is correct)
  async function signup(email, password, username, workspaceName, workspaceType) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await updateProfile(user, { displayName: username });

    const newWorkspaceId = `ws_${uuidv4()}`;
    const categoryTemplate = CATEGORY_TEMPLATES[workspaceType] || CATEGORY_TEMPLATES['GENERAL_BUSINESS'];

    const batch = writeBatch(db);
    const workspaceDocRef = doc(db, "workspaces", newWorkspaceId);
    batch.set(workspaceDocRef, {
      name: workspaceName,
      ownerId: user.uid,
      plan: "free",
      categories: categoryTemplate,
      createdAt: new Date()
    });

    const userDocRef = doc(db, "users", user.uid);
    const newUserProfile = {
      uid: user.uid,
      displayName: username,
      email: user.email,
      workspaces: { [newWorkspaceId]: "owner" }
    };
    batch.set(userDocRef, newUserProfile);
    await batch.commit();

    // The onAuthStateChanged listener will automatically pick up these new documents,
    // so we don't need to set state manually here.
    
    return userCredential;
  }
  
  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const loginWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  const value = {
    currentUser,
    userProfile,
    currentWorkspace,
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