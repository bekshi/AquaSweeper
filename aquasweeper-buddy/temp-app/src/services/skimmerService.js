import { db } from './firebase';
import { doc, setDoc, updateDoc, arrayUnion, collection } from 'firebase/firestore';

export const addSkimmerToDatabase = async (deviceData, userEmail) => {
  try {
    // 1. Add device to skimmers collection
    const skimmerRef = doc(db, 'skimmers', deviceData.deviceId);
    await setDoc(skimmerRef, {
      deviceId: deviceData.deviceId,
      MacAddress: deviceData.macAddress,
      alerts: [],
    });

    // 2. Add device to user's connectedDevices array
    const userRef = doc(db, 'users', userEmail);
    const newDevice = {
      deviceId: deviceData.deviceId,
      deviceName: deviceData.deviceName || `AquaSweeper ${deviceData.deviceId}`,
      addedAt: new Date().toISOString(),
      status: 'online',
      lastSyncTime: new Date().toISOString(),
      model: 'AS-001'
    };

    await updateDoc(userRef, {
      connectedDevices: arrayUnion(newDevice)
    });

    return newDevice;
  } catch (error) {
    console.error('Error adding skimmer to database:', error);
    throw error;
  }
};
