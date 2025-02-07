import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';

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
const auth = getAuth(app);

// Configure Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Detect if we're running in a mobile browser
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator?.userAgent || '');

// Function to handle Google Sign In
const signInWithGoogle = async () => {
  try {
    if (isMobile) {
      // Use redirect method for mobile browsers
      await signInWithRedirect(auth, googleProvider);
      // The result will be handled by getRedirectResult
    } else {
      // Use popup for desktop browsers
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
  } catch (error) {
    console.error('Google Sign In Error:', error);
    throw error;
  }
};

// Function to get redirect result (for mobile flow)
const getGoogleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    return result?.user;
  } catch (error) {
    console.error('Redirect Result Error:', error);
    throw error;
  }
};

export { auth, signInWithGoogle, getGoogleRedirectResult };
