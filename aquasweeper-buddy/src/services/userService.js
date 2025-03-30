import { auth, db } from '../firebase/config';
import { doc, setDoc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export const createUserInFirestore = async (user) => {
  try {
    const userRef = doc(db, 'users', user.email);
    
    // Default user data structure
    const userData = {
      userId: user.uid,
      email: user.email,
      name: user.displayName || '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      // Default settings
      appTheme: 'dark',
      alertsEnabled: true,
      // Empty/optional fields
      phoneNumber: '',
      profilePicture: '',
      notificationsToken: '',
      // Empty arrays and objects
      connectedDevices: [],
      cleaningPreference: {
        cleaningDuration: null,
        cleaningFrequency: null,
        startTime: null
      }
    };

    await setDoc(userRef, userData);
    return userData;
  } catch (error) {
    console.error('Error creating user in Firestore:', error);
    throw error;
  }
};

export const addDeviceToUser = async (userEmail, deviceData) => {
  try {
    const userRef = doc(db, 'users', userEmail);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const newDevice = {
      deviceId: deviceData.deviceId,
      deviceName: deviceData.deviceName,
      addedAt: serverTimestamp(),
      status: 'offline', // default status
      lastSyncTime: serverTimestamp(),
      model: deviceData.model || 'AS-001' // default model
    };

    await updateDoc(userRef, {
      connectedDevices: [...(userDoc.data().connectedDevices || []), newDevice]
    });

    return newDevice;
  } catch (error) {
    console.error('Error adding device to user:', error);
    throw error;
  }
};

export const updateUserLastLogin = async (userEmail) => {
  try {
    const userRef = doc(db, 'users', userEmail);
    await updateDoc(userRef, {
      lastLogin: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating last login:', error);
    throw error;
  }
};
