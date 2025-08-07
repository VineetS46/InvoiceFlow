// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDJgjkh41z7uVJLxxdDs2zB9Y4Cgbkc5TA",
  authDomain: "invoiceflow-f22ac.firebaseapp.com",
  projectId: "invoiceflow-f22ac",
  storageBucket: "invoiceflow-f22ac.appspot.com",
  messagingSenderId: "1553997206",
  appId: "1:1553997206:web:c5ab0e8ec936779e3b51b7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;