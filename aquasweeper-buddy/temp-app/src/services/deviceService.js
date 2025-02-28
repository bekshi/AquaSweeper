import { db } from './firebase';
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

/**
 * Update device status in Firestore
 * @param {string} userEmail - User email
 * @param {string} deviceId - Device ID
 * @param {string} status - Device status (online/offline)
 * @returns {Promise<boolean>} - Success status
 */
export const updateDeviceStatus = async (userEmail, deviceId, status) => {
  try {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.error('No authenticated user');
      return false;
    }
    
    const userId = auth.currentUser.uid;
    
    // Get user document by UID
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('User document not found');
      return false;
    }
    
    const userData = userDoc.data();
    const devices = userData.connectedDevices || [];
    
    // Find the device in the user's devices array
    const deviceIndex = devices.findIndex(device => device.id === deviceId || device.deviceId === deviceId);
    
    if (deviceIndex === -1) {
      console.error('Device not found in user devices');
      return false;
    }
    
    // Update the device status
    const updatedDevices = [...devices];
    updatedDevices[deviceIndex] = {
      ...updatedDevices[deviceIndex],
      status: status
    };
    
    // Update the user document
    await updateDoc(userRef, {
      connectedDevices: updatedDevices
    });
    
    return true;
  } catch (error) {
    console.error('Error updating device status:', error);
    return false;
  }
};

/**
 * Sync device state with Firestore
 * @param {string} userEmail - User email
 * @param {string} deviceId - Device ID
 * @param {object} state - Device state object
 * @returns {Promise<boolean>} - Success status
 */
export const syncDevice = async (userEmail, deviceId, state) => {
  try {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.error('No authenticated user');
      return false;
    }
    
    const userId = auth.currentUser.uid;
    
    // Get user document by UID
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('User document not found');
      return false;
    }
    
    const userData = userDoc.data();
    const devices = userData.connectedDevices || [];
    
    // Find the device in the user's devices array
    const deviceIndex = devices.findIndex(device => device.id === deviceId || device.deviceId === deviceId);
    
    if (deviceIndex === -1) {
      console.error('Device not found in user devices');
      return false;
    }
    
    // Update the device state
    const updatedDevices = [...devices];
    updatedDevices[deviceIndex] = {
      ...updatedDevices[deviceIndex],
      ...state
    };
    
    // Update the user document
    await updateDoc(userRef, {
      connectedDevices: updatedDevices
    });
    
    return true;
  } catch (error) {
    console.error('Error syncing device state:', error);
    return false;
  }
};

/**
 * Remove device from user's devices
 * @param {string} userEmail - User email
 * @param {string} deviceId - Device ID
 * @returns {Promise<boolean>} - Success status
 */
export const removeDevice = async (userEmail, deviceId) => {
  try {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.error('No authenticated user');
      return false;
    }
    
    const userId = auth.currentUser.uid;
    
    // Get user document by UID
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('User document not found');
      return false;
    }
    
    const userData = userDoc.data();
    const devices = userData.connectedDevices || [];
    
    // Find the device in the user's devices array
    const device = devices.find(device => device.id === deviceId || device.deviceId === deviceId);
    
    if (!device) {
      console.error('Device not found in user devices');
      return false;
    }
    
    // Remove the device from the user's devices array
    await updateDoc(userRef, {
      connectedDevices: arrayRemove(device)
    });
    
    return true;
  } catch (error) {
    console.error('Error removing device:', error);
    return false;
  }
};

export default {
  updateDeviceStatus,
  syncDevice,
  removeDevice
};
