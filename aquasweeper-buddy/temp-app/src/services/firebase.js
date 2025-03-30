import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Initialize Auth with persistence
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

export { auth, db, storage, app };
