import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

class DeviceConnectionService {
  constructor() {
    this.devices = new Map(); // Store device status check intervals
    this.healthCheckInterval = 5000; // Check every 5 seconds
    this.maxRetries = 3;
  }

  async checkDeviceHealth(device, userId) {
    try {
      console.log(`Checking device health for ${device.name || device.macAddress}`);
      
      // Get device suffix from MAC address
      const deviceSuffix = device.macAddress.slice(-5).replace(/:/g, '');
      console.log(`Device suffix: ${deviceSuffix}`);
      
      // Try both mDNS and direct IP with multiple retries
      const endpoints = [
        `http://aquasweeper-${deviceSuffix}.local/getDeviceInfo`,
        `http://${device.ipAddress}/getDeviceInfo`
      ];

      let isConnected = false;
      let deviceInfo = null;
      let lastError = null;

      // Try each endpoint with retries
      for (const endpoint of endpoints) {
        console.log(`Trying endpoint: ${endpoint}`);
        
        for (let retry = 0; retry < this.maxRetries; retry++) {
          try {
            console.log(`Attempt ${retry + 1} for ${endpoint}`);
            
            const response = await fetch(endpoint, {
              timeout: 3000,
              headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log(`Successful response from ${endpoint}:`, data);
              deviceInfo = data;
              isConnected = true;
              break;
            } else {
              console.log(`Response not OK: ${response.status} ${response.statusText}`);
            }
          } catch (error) {
            console.log(`Error connecting to ${endpoint} (attempt ${retry + 1}):`, error.message);
            lastError = error;
            // Wait briefly before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (isConnected) break;
      }
      
      // Update device status in Firestore
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const devices = userData.settings?.devices || [];
        
        const updatedDevices = devices.map(d => {
          if (d.macAddress === device.macAddress) {
            const updatedDevice = {
              ...d,
              isConnected,
              lastSeen: isConnected ? new Date().toISOString() : d.lastSeen,
              lastError: isConnected ? null : lastError?.message
            };
            
            if (deviceInfo) {
              // Only update these fields if we got a successful response
              updatedDevice.name = deviceInfo.name;
              updatedDevice.firmwareVersion = deviceInfo.firmwareVersion;
              updatedDevice.wifiSSID = deviceInfo.wifiSSID;
              updatedDevice.wifiStrength = deviceInfo.wifiStrength;
              updatedDevice.uptime = deviceInfo.uptime;
            }
            
            return updatedDevice;
          }
          return d;
        });

        await updateDoc(userRef, {
          'settings.devices': updatedDevices
        });
        
        console.log(`Updated device status in Firestore: ${isConnected ? 'connected' : 'disconnected'}`);
      }

      return isConnected;
    } catch (error) {
      console.error(`Error in checkDeviceHealth for ${device.macAddress}:`, error);
      return false;
    }
  }

  startMonitoring(device, userId) {
    if (this.devices.has(device.macAddress)) {
      // Already monitoring this device
      return;
    }

    // Initial check
    this.checkDeviceHealth(device, userId);

    // Set up periodic health checks
    const intervalId = setInterval(() => {
      this.checkDeviceHealth(device, userId);
    }, this.healthCheckInterval);

    this.devices.set(device.macAddress, intervalId);
  }

  stopMonitoring(device) {
    const intervalId = this.devices.get(device.macAddress);
    if (intervalId) {
      clearInterval(intervalId);
      this.devices.delete(device.macAddress);
    }
  }

  stopMonitoringAll() {
    this.devices.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.devices.clear();
  }
}

// Create a singleton instance
const deviceConnectionService = new DeviceConnectionService();
export default deviceConnectionService;
