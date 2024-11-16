const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

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

async function createAdminUser() {
  try {
    // Admin credentials
    const username = "admin";
    const password = "admin123";
    const email = `${username}@admin.com`;

    // Create admin user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Add admin details to Firestore
    await addDoc(collection(db, 'admins'), {
      uid: userCredential.user.uid,
      username: username,
      role: 'admin',
      createdAt: new Date().toISOString()
    });

    console.log('Admin user created successfully!');
    console.log('Username:', username);
    console.log('Password:', password);
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
}

createAdminUser();
