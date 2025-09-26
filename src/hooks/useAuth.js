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
    { name: "Events & Sponsorships", tags: ["event", "conference", "booth", "sponsorship", "networking"] },
    { name: "Training & Development", tags: ["workshop", "training", "courses", "certification", "employee growth"] },
    { name: "Travel & Accommodation", tags: ["flight", "hotel", "airbnb", "uber", "taxi", "car rental"] },
    { name: "Maintenance & Repairs", tags: ["repairs", "maintenance", "equipment service", "facility upkeep"] },
    { name: "Taxes & Licenses", tags: ["tax", "license", "permit", "registration", "compliance"] },
  ],

  'PERSONAL_FINANCE': [
    { name: "Housing", tags: ["rent", "mortgage", "property tax", "home maintenance"] },
    { name: "Utilities", tags: ["electricity", "water", "gas", "phone", "internet"] },
    { name: "Groceries", tags: ["grocery", "supermarket", "walmart", "big bazaar"] },
    { name: "Transportation", tags: ["fuel", "gasoline", "public transit", "vehicle maintenance", "ride sharing", "uber", "lyft", "ola"] },
    { name: "Health & Wellness", tags: ["insurance", "pharmacy", "gym", "medical", "doctor", "dentist", "mamaearth", "honasa"] },
    { name: "Shopping & Retail", tags: ["clothing", "electronics", "hobbies", "amazon", "flipkart"] },
    { name: "Meals & Entertainment", tags: ["restaurant", "cafe", "takeout", "zomato", "swiggy", "movies", "subscriptions"] },
    { name: "Education", tags: ["tuition", "books", "courses", "udemy", "coaching"] },
    { name: "Travel & Vacation", tags: ["flight", "hotel", "airbnb", "holiday", "expedia"] },
    { name: "Investments & Savings", tags: ["mutual funds", "stocks", "fixed deposit", "savings", "crypto"] },
  ],

  'IT_SERVICES': [
    { name: "Software Licensing", tags: ["microsoft", "oracle", "jet-brains", "license", "vmware"] },
    { name: "Cloud Services", tags: ["aws", "azure", "google cloud", "gcp", "hosting", "domain", "digitalocean"] },
    { name: "Hardware Procurement", tags: ["dell", "lenovo", "server", "laptop", "hardware", "networking"] },
    { name: "Employee Salaries", tags: ["salary", "payroll", "compensation"] },
    { name: "Subcontractor Fees", tags: ["contractor", "freelancer", "consultant", "outsourcing"] },
    { name: "Security & Compliance", tags: ["firewall", "antivirus", "compliance", "penetration testing", "security audit"] },
    { name: "Research & Development", tags: ["r&d", "innovation", "prototype", "testing", "experimentation"] },
    { name: "Customer Support Tools", tags: ["zendesk", "freshdesk", "intercom", "support software"] },
    { name: "Networking & Infrastructure", tags: ["routers", "switches", "cabling", "infrastructure"] },
    { name: "Training & Certifications", tags: ["aws certification", "azure training", "upskilling", "online course"] },
  ],
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
   const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const userDocRef = doc(db, 'users', user.uid);
        let userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          setOnboardingRequired(false);
          const profile = userDoc.data();
          setUserProfile(profile);

          // *** NEW: Check for admin role from the Firestore document ***
          const userIsAdmin = profile.role === 'admin';
          setIsAdmin(userIsAdmin);

          if (profile.workspaces && Object.keys(profile.workspaces).length > 0) {
            const firstWorkspaceId = Object.keys(profile.workspaces)[0];
            const workspaceDoc = await getDoc(doc(db, 'workspaces', firstWorkspaceId));
            if (workspaceDoc.exists()) {
              setCurrentWorkspace({ id: workspaceDoc.id, ...workspaceDoc.data() });
            }
          }
        } else {
          setOnboardingRequired(true);
          setIsAdmin(false); // *** NEW: Ensure non-profile users are not admins ***
        }
      } else {
        // Clear all state on logout
        setCurrentUser(null);
        setUserProfile(null);
        setCurrentWorkspace(null);
        setOnboardingRequired(false);
        setIsAdmin(false); // *** NEW: Ensure logged-out users are not admins ***
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []); // Note: The dependency array is empty, this runs once on mount.

  async function signup(email, password, username) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: username });
    return userCredential;
  }
  
  async function completeOnboarding(workspaceName, workspaceType) {
    if (!currentUser) throw new Error("User not authenticated.");

    const invitesRef = collection(db, "invites");
    const q = query(invitesRef, where("email", "==", currentUser.email.toLowerCase()), where("status", "==", "pending"));
    const inviteSnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    const userDocRef = doc(db, 'users', currentUser.uid);
    let workspaceId;
    let userRole;
    
    if (!inviteSnapshot.empty) {
      const inviteDoc = inviteSnapshot.docs[0];
      const inviteData = inviteDoc.data();
      workspaceId = inviteData.workspaceId;
      userRole = inviteData.role;
      const inviteDocRef = doc(db, 'invites', inviteDoc.id);
      batch.update(inviteDocRef, { status: "accepted", acceptedAt: new Date(), acceptedBy: currentUser.uid });
    } else {
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

    const newUserProfile = {
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      email: currentUser.email,
      workspaces: { [workspaceId]: userRole }
    };
    batch.set(userDocRef, newUserProfile);
    await batch.commit();

    const finalWorkspaceDoc = await getDoc(doc(db, 'workspaces', workspaceId));
    setUserProfile(newUserProfile);
    setCurrentWorkspace({ id: finalWorkspaceDoc.id, ...finalWorkspaceDoc.data() });
    setOnboardingRequired(false);
  }

  const updateWorkspace = async (workspaceId, newData) => {
    if (!currentUser || !workspaceId) throw new Error("Authentication or workspace ID is missing.");
    const workspaceDocRef = doc(db, 'workspaces', workspaceId);
    
    const currentWsDoc = await getDoc(workspaceDocRef);
    if (currentWsDoc.exists() && currentWsDoc.data().ownerId !== currentUser.uid) {
        throw new Error("You do not have permission to edit this workspace.");
    }
    
    await updateDoc(workspaceDocRef, newData);
    
    const updatedDoc = await getDoc(workspaceDocRef);
    if (updatedDoc.exists()) {
      setCurrentWorkspace({ id: updatedDoc.id, ...updatedDoc.data() });
    }
  };

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const loginWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  const value = {
    currentUser,
    userProfile,
    currentWorkspace,
    loading,
    onboardingRequired,
    signup,
    completeOnboarding,
    updateWorkspace,
    login,
    loginWithGoogle,
    isAdmin,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}