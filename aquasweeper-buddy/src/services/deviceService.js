import { db } from '../firebase/config';
import { doc, updateDoc, arrayUnion, getDoc, serverTimestamp } from 'firebase/firestore';

const DEVICE_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  MAINTENANCE: 'maintenance'
};

export const addDevice = async (userEmail, deviceInfo) => {
  try {
    const userRef = doc(db, 'users', userEmail);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const newDevice = {
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName || `AquaSweeper ${deviceInfo.deviceId}`,
      addedAt: serverTimestamp(),
      status: DEVICE_STATUS.OFFLINE,
      lastSyncTime: serverTimestamp(),
      model: deviceInfo.model || 'AS-001',
      firmwareVersion: deviceInfo.firmwareVersion || '1.0.0'
    };

    const currentDevices = userDoc.data().connectedDevices || [];
    const deviceExists = currentDevices.some(device => device.deviceId === deviceInfo.deviceId);

    if (deviceExists) {
      throw new Error('Device already paired with this account');
    }

    await updateDoc(userRef, {
      connectedDevices: arrayUnion(newDevice)
    });

    return newDevice;
  } catch (error) {
    console.error('Error adding device:', error);
    throw error;
  }
};

export const updateDeviceStatus = async (userEmail, deviceId, status) => {
  try {
    if (!Object.values(DEVICE_STATUS).includes(status)) {
      throw new Error('Invalid device status');
    }

    const userRef = doc(db, 'users', userEmail);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const devices = userDoc.data().connectedDevices;
    const updatedDevices = devices.map(device => {
      if (device.deviceId === deviceId) {
        return {
          ...device,
          status,
          lastSyncTime: serverTimestamp()
        };
      }
      return device;
    });

    await updateDoc(userRef, {
      connectedDevices: updatedDevices
    });
  } catch (error) {
    console.error('Error updating device status:', error);
    throw error;
  }
};

export const removeDevice = async (userEmail, deviceId) => {
  try {
    const userRef = doc(db, 'users', userEmail);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const updatedDevices = userDoc.data().connectedDevices.filter(
      device => device.deviceId !== deviceId
    );

    await updateDoc(userRef, {
      connectedDevices: updatedDevices
    });
  } catch (error) {
    console.error('Error removing device:', error);
    throw error;
  }
};

export const getDeviceDetails = async (userEmail, deviceId) => {
  try {
    const userRef = doc(db, 'users', userEmail);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const device = userDoc.data().connectedDevices.find(
      device => device.deviceId === deviceId
    );

    if (!device) {
      throw new Error('Device not found');
    }

    return device;
  } catch (error) {
    console.error('Error getting device details:', error);
    throw error;
  }
};

export const syncDevice = async (userEmail, deviceId, syncData) => {
  try {
    const userRef = doc(db, 'users', userEmail);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const devices = userDoc.data().connectedDevices;
    const updatedDevices = devices.map(device => {
      if (device.deviceId === deviceId) {
        return {
          ...device,
          lastSyncTime: serverTimestamp(),
          status: DEVICE_STATUS.ONLINE,
          ...syncData // Additional data from device like current cleaning status, battery level, etc.
        };
      }
      return device;
    });

    await updateDoc(userRef, {
      connectedDevices: updatedDevices
    });
  } catch (error) {
    console.error('Error syncing device:', error);
    throw error;
  }
};
