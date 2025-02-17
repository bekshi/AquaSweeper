import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

class DeviceConnectionService {
  constructor() {
    this.devices = new Map(); // Store device status check intervals
    this.healthCheckInterval = 5000; // Check every 5 seconds
    this.maxRetries = 3;
    this.scanning = false;
    this.lastKnownIPs = new Map(); // Store last known IPs for devices
    this.networkInfo = null;
  }

  async initialize() {
    // Load last known IPs from storage
    try {
      const savedIPs = await AsyncStorage.getItem('lastKnownDeviceIPs');
      if (savedIPs) {
        this.lastKnownIPs = new Map(JSON.parse(savedIPs));
      }
    } catch (error) {
      console.error('Error loading last known IPs:', error);
    }

    // Start network monitoring
    NetInfo.addEventListener(state => {
      this.networkInfo = state;
      if (state.isConnected && state.type === 'wifi') {
        this.startNetworkScan();
      }
    });
  }

  async saveLastKnownIPs() {
    try {
      await AsyncStorage.setItem(
        'lastKnownDeviceIPs',
        JSON.stringify(Array.from(this.lastKnownIPs.entries()))
      );
    } catch (error) {
      console.error('Error saving last known IPs:', error);
    }
  }

  async startNetworkScan() {
    if (this.scanning) return;
    this.scanning = true;

    while (this.scanning) {
      try {
        // Get current network info
        const networkState = await NetInfo.fetch();
        if (!networkState.isConnected || networkState.type !== 'wifi') {
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s before retry
          continue;
        }

        // Get base IP from network info (e.g., 192.168.1)
        const baseIP = networkState.details?.ipAddress?.split('.').slice(0, 3).join('.');
        if (!baseIP) continue;

        // Scan last known IPs first
        for (const [macAddress, lastIP] of this.lastKnownIPs.entries()) {
          await this.tryConnectToDevice(lastIP, macAddress);
        }

        // Scan common IP ranges
        for (let i = 1; i <= 254; i++) {
          const ip = `${baseIP}.${i}`;
          await this.tryConnectToDevice(ip);
        }

      } catch (error) {
        console.error('Error during network scan:', error);
      }

      // Wait before next scan
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30s between full scans
    }
  }

  async tryConnectToDevice(ip, knownMacAddress = null) {
    try {
      const response = await fetch(`http://${ip}/discover`, {
        signal: AbortSignal.timeout(1000)
      });

      if (response.ok) {
        const deviceInfo = await response.json();
        if (deviceInfo.macAddress) {
          // Update last known IP
          this.lastKnownIPs.set(deviceInfo.macAddress, ip);
          await this.saveLastKnownIPs();

          // If this is a new device, add it to Firestore
          if (!knownMacAddress) {
            await this.registerNewDevice(deviceInfo, ip);
          }

          return true;
        }
      }
    } catch (error) {
      // Ignore connection errors during scanning
    }
    return false;
  }

  async registerNewDevice(deviceInfo, ip) {
    // Get current user ID from AsyncStorage
    const userId = await AsyncStorage.getItem('userId');
    if (!userId) return;

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const devices = userData.settings?.devices || [];
      
      // Check if device already exists
      if (!devices.some(d => d.macAddress === deviceInfo.macAddress)) {
        const newDevice = {
          macAddress: deviceInfo.macAddress,
          name: deviceInfo.name || `AquaSweeper-${deviceInfo.macAddress.slice(-4)}`,
          ipAddress: ip,
          isConnected: true,
          lastSeen: new Date().toISOString(),
          firstSeen: new Date().toISOString(),
          firmwareVersion: deviceInfo.firmwareVersion,
        };

        await updateDoc(userRef, {
          'settings.devices': [...devices, newDevice]
        });
      }
    }
  }

  async checkDeviceHealth(device) {
    try {
      console.log(`Checking device health for ${device.macAddress}`);
      
      let isConnected = false;
      let deviceInfo = null;
      let lastError = null;

      // Try last known IP first
      const lastKnownIP = this.lastKnownIPs.get(device.macAddress);
      if (lastKnownIP) {
        isConnected = await this.tryConnectToDevice(lastKnownIP, device.macAddress);
        if (isConnected) {
          deviceInfo = await this.getDeviceInfo(lastKnownIP);
        }
      }

      // If not connected, try device's stored IP
      if (!isConnected && device.ipAddress) {
        isConnected = await this.tryConnectToDevice(device.ipAddress, device.macAddress);
        if (isConnected) {
          deviceInfo = await this.getDeviceInfo(device.ipAddress);
        }
      }

      // Update device status in Firestore if we have userId
      const userId = await AsyncStorage.getItem('userId');
      if (userId) {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const devices = userData.connectedDevices || [];
          
          const updatedDevices = devices.map(d => {
            if (d.macAddress === device.macAddress) {
              return {
                ...d,
                isConnected,
                lastSeen: isConnected ? new Date().toISOString() : d.lastSeen,
                lastError: isConnected ? null : lastError?.message
              };
            }
            return d;
          });
          
          await updateDoc(userRef, {
            connectedDevices: updatedDevices
          });
        }
      }

      return { isConnected, deviceInfo };
    } catch (error) {
      console.error('Error checking device health:', error);
      throw error;
    }
  }

  async getDeviceInfo(endpoint) {
    try {
      const response = await fetch(`http://${endpoint}/getDeviceInfo`, {
        timeout: 3000,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting device info:', error);
    }
    return null;
  }

  startMonitoring(device, userId) {
    if (this.devices.has(device.macAddress)) {
      return; // Already monitoring this device
    }

    const interval = setInterval(() => {
      this.checkDeviceHealth(device, userId);
    }, this.healthCheckInterval);

    this.devices.set(device.macAddress, interval);
    this.checkDeviceHealth(device, userId); // Initial check
  }

  stopMonitoring(device) {
    const interval = this.devices.get(device.macAddress);
    if (interval) {
      clearInterval(interval);
      this.devices.delete(device.macAddress);
    }
  }

  stopMonitoringAll() {
    this.scanning = false;
    for (const interval of this.devices.values()) {
      clearInterval(interval);
    }
    this.devices.clear();
  }
}

// Create a singleton instance
const deviceConnectionService = new DeviceConnectionService();
export default deviceConnectionService;
