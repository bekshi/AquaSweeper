import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  browserPopupRedirectResolver,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCUYwbheAI09BFgXoFiC3Q6HgCFo2P1X-M",
  authDomain: "aquasweeperbuddy.firebaseapp.com",
  projectId: "aquasweeperbuddy",
  storageBucket: "aquasweeperbuddy.firebasestorage.app",
  messagingSenderId: "825818631433",
  appId: "1:825818631433:web:67bd1ec7d04b09768857d8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Configure Google Auth Provider
const provider = new GoogleAuthProvider();
provider.addScope("profile");
provider.addScope("email");

const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(
      auth,
      provider,
      browserPopupRedirectResolver
    );
    return result.user;
  } catch (error) {
    console.error("Sign-in error:", error);
    throw error;
  }
};

export { auth, signInWithGoogle };
