import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCUYwbheAI09BFgXoFiC3Q6HgCFo2P1X-M",
  authDomain: "aquasweeperbuddy.firebaseapp.com",
  projectId: "aquasweeperbuddy",
  storageBucket: "aquasweeperbuddy.firebasestorage.app",
  messagingSenderId: "825818631433",
  appId: "1:825818631433:web:67bd1ec7d04b09768857d8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Function to create a new user and save their details to Firestore
export const createUser = async (email, password, additionalData = {}) => {
  try {
    // Create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create a user document in Firestore
    const userData = {
      email: user.email,
      userId: user.uid,
      alertsEnabled: true,
      appTheme: 'dark',
      cleaningPreference: {
        cleaningDuration: 120,
        cleaningFrequency: 'daily',
        startTime: 8
      },
      connectedDevices: [],
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      notificationsToken: '',
      profilePicture: '',
      ...additionalData
    };

    await setDoc(doc(db, 'users', user.uid), userData);

    return user;
  } catch (error) {
    throw error;
  }
};

export default app;
