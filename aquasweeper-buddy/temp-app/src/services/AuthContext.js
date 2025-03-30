import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const navigation = useNavigation();

  const checkProfileCompletion = async (user) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const isProfileComplete = userDoc.exists() && userDoc.data().profileCompleted;
      setProfileCompleted(isProfileComplete);
      
      // Auto-navigate to home screen when profile is completed
      if (isProfileComplete && navigation) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      }
    } catch (error) {
      console.error('Error checking profile completion:', error);
      setProfileCompleted(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          
          if (!userDoc.exists()) {
            // Create initial user document
            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              createdAt: new Date(),
              lastLoginAt: new Date(),
              settings: {
                notifications: true,
                darkMode: false,
                cleaningSchedule: 'weekly',
              },
              skimmers: [],
              stats: {
                totalCleaningSessions: 0,
                totalDebrisCollected: 0,
                averageSessionDuration: 0,
              },
              profileCompleted: false,
            });
            setProfileCompleted(false);
          } else {
            // Update lastLoginAt and set profile status
            await updateDoc(userRef, { lastLoginAt: new Date() });
            setProfileCompleted(userDoc.data().profileCompleted || false);
          }
        } catch (error) {
          console.error('Error managing user document:', error);
          setProfileCompleted(false);
        }
        setUser(user);
      } else {
        setUser(null);
        setProfileCompleted(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setProfileCompleted(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    user,
    loading,
    profileCompleted,
    signOut,
    checkProfileCompletion,
  };

  if (loading) {
    return null;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
