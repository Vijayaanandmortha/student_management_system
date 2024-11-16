import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCoOeIFbwBvTSHIQCPn96Wb8By4m0h5NB4",
  authDomain: "smsapp-8a0df.firebaseapp.com",
  projectId: "smsapp-8a0df",
  storageBucket: "smsapp-8a0df.firebasestorage.app",
  messagingSenderId: "1011013462170",
  appId: "1:1011013462170:web:9cf7235c8b25f7111f1723"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };