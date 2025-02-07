import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/services/AuthContext';
import { ThemeProvider } from './src/services/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

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
const auth = getAuth(app);

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthProvider>
          <ThemeProvider>
            <AppNavigator />
          </ThemeProvider>
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
