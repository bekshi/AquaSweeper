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
    this.hasConnectedDevice = false;
    this.onDeviceFound = null; // Callback when a device is found
  }

  setDeviceFoundCallback(callback) {
    this.onDeviceFound = callback;
  }

  async initialize() {
    console.log('Device connection service initialized');
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
    this.hasConnectedDevice = false;

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

        console.log(`Starting network scan on base IP: ${baseIP}`);

        // Scan last known IPs first
        for (const [macAddress, lastIP] of this.lastKnownIPs.entries()) {
          console.log(`Checking last known IP: ${lastIP} for device: ${macAddress}`);
          const connected = await this.tryConnectToDevice(lastIP, macAddress);
          if (connected) {
            this.hasConnectedDevice = true;
            break; // Stop scanning if we found our device
          }
        }

        // If we already found our device, skip further scanning
        if (this.hasConnectedDevice) {
          await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s before next scan
          continue;
        }

        // Only check AP mode IP if we haven't found our device and we're not on the AP network
        if (!this.hasConnectedDevice && baseIP !== '192.168.4') {
          console.log('No device found on local network, checking AP mode IP');
          const connected = await this.tryConnectToDevice('192.168.4.1');
          if (connected) {
            this.hasConnectedDevice = true;
          }
        }

      } catch (error) {
        console.error('Error during network scan:', error);
      }

      // Wait before next scan
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30s between full scans
    }
  }

  async tryConnectToDevice(ip, macAddress) {
    try {
      console.log(`Trying to connect to device at ${ip}`);
      const response = await fetch(`http://${ip}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 3000
      });
      
      if (response.ok) {
        // Check if the response is actually JSON before proceeding
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.log(`Response from ${ip} is not JSON (${contentType}), skipping`);
          return false;
        }
        
        // Try to parse the JSON to verify it's a valid response
        try {
          const data = await response.json();
          
          // Verify this is actually our device by checking for expected properties
          if (!data.hasOwnProperty('operatingState') && !data.hasOwnProperty('batteryLevel')) {
            console.log(`Response from ${ip} is not from an AquaSweeper device, skipping`);
            return false;
          }
          
          console.log(`Successfully connected to AquaSweeper device at ${ip}`);
          
          // Try to get device info to get MAC address if not provided
          if (!macAddress) {
            const deviceInfo = await this.getDeviceInfo(ip);
            if (deviceInfo && deviceInfo.macAddress) {
              macAddress = deviceInfo.macAddress;
            }
          }
          
          // Update last known IP if we have a MAC address
          if (macAddress) {
            this.lastKnownIPs.set(macAddress, ip);
            this.saveLastKnownIPs();

            // Notify about found device
            if (this.onDeviceFound) {
              const deviceInfo = await this.getDeviceInfo(ip);
              if (deviceInfo) {
                const device = {
                  id: deviceInfo.macAddress.replace(/:/g, '').slice(-6),
                  name: `AquaSweeper-${deviceInfo.macAddress.replace(/:/g, '').slice(-6)}`,
                  ipAddress: ip,
                  macAddress: deviceInfo.macAddress,
                  state: data.operatingState || 'stopped',
                  status: 'online',
                  addedAt: new Date().toISOString()
                };
                console.log('Device found, notifying context:', device);
                this.onDeviceFound(device);
              }
            }
          }
          
          return true;
        } catch (parseError) {
          console.log(`Failed to parse JSON from ${ip}: ${parseError.message}`);
          return false;
        }
      }
      return false;
    } catch (error) {
      console.log(`Failed to connect to device at ${ip}: ${error.message}`);
      return false;
    }
  }

  async getDeviceInfo(ip) {
    try {
      // Try the /info endpoint first
      let response = await fetch(`http://${ip}/info`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 3000
      });
      
      // If /info fails, try the /device endpoint as fallback
      if (!response.ok) {
        response = await fetch(`http://${ip}/device`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          timeout: 3000
        });
      }
      
      if (response.ok) {
        try {
          const data = await response.json();
          console.log(`Successfully parsed device info from ${ip}:`, data);
          return {
            ...data,
            // Ensure we have a consistent property name for MAC address
            macAddress: data.macAddress || data.mac
          };
        } catch (parseError) {
          console.error(`Error parsing JSON from ${ip}:`, parseError);
          return null;
        }
      }
      return null;
    } catch (error) {
      console.error(`Error getting device info from ${ip}:`, error);
      return null;
    }
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

  async scanNetwork() {
    try {
      console.log('Starting network scan...');
      
      // Get network state
      const netInfo = await NetInfo.fetch();
      
      if (!netInfo.isConnected) {
        console.log('Not connected to any network');
        return { success: false, error: 'Not connected to any network' };
      }
      
      if (netInfo.type !== 'wifi') {
        console.log('Not connected to WiFi network');
        return { success: false, error: 'Please connect to a WiFi network to find your AquaSweeper device' };
      }
      
      console.log('Network details:', netInfo);
      
      // Get IP address and subnet
      const ipAddress = netInfo.details?.ipAddress;
      
      if (!ipAddress) {
        console.log('Could not determine device IP address');
        return { success: false, error: 'Could not determine your device IP address' };
      }
      
      console.log('Device IP address:', ipAddress);
      
      // Parse IP to get subnet
      const ipParts = ipAddress.split('.');
      const subnet = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
      
      console.log('Subnet:', subnet);
      
      // Start scanning for devices
      return await this.scanSubnet(subnet);
    } catch (error) {
      console.error('Error scanning network:', error);
      return { success: false, error: error.message };
    }
  }

  async scanSubnet(subnet) {
    try {
      console.log(`Scanning subnet: ${subnet}`);
      
      // Create a list of IPs to scan
      const ipsToScan = [];
      
      // Skip common gateway IPs and prioritize ESP32 default IP range
      for (let i = 1; i <= 254; i++) {
        // Skip common gateway/router IPs
        if (i === 1 || i === 254 || i === 255) {
          continue;
        }
        
        // Prioritize ESP32 default IP range (usually 192.168.4.x)
        if (subnet === '192.168.4') {
          ipsToScan.push(`${subnet}.${i}`);
        } else {
          // For other subnets, add to the end
          ipsToScan.push(`${subnet}.${i}`);
        }
      }
      
      // Add common ESP32 AP IPs if not already in the list
      if (subnet !== '192.168.4') {
        for (let i = 1; i <= 254; i++) {
          if (i === 1 || i === 254 || i === 255) {
            continue;
          }
          ipsToScan.unshift(`192.168.4.${i}`);
        }
      }
      
      console.log(`Generated ${ipsToScan.length} IPs to scan`);
      
      // Scan IPs in batches to avoid overwhelming the network
      const batchSize = 10;
      const timeout = 2000; // 2 second timeout for each request
      
      let foundDevices = [];
      let progress = 0;
      
      // Process IPs in batches
      for (let i = 0; i < ipsToScan.length; i += batchSize) {
        const batch = ipsToScan.slice(i, i + batchSize);
        
        // Update progress
        progress = Math.floor((i / ipsToScan.length) * 100);
        console.log(`Scanning progress: ${progress}%`);
        
        // Scan batch in parallel
        const results = await Promise.all(
          batch.map(ip => this.checkDeviceAtIp(ip, timeout))
        );
        
        // Filter out null results and add to found devices
        const validResults = results.filter(result => result !== null);
        foundDevices = [...foundDevices, ...validResults];
        
        // If we found devices, we can stop scanning
        if (foundDevices.length > 0) {
          console.log(`Found ${foundDevices.length} devices, stopping scan`);
          break;
        }
      }
      
      console.log(`Scan complete, found ${foundDevices.length} devices`);
      
      return {
        success: true,
        devices: foundDevices
      };
    } catch (error) {
      console.error('Error scanning subnet:', error);
      return { success: false, error: error.message };
    }
  }

  async checkDeviceAtIp(ip, timeout = 2000) {
    try {
      console.log(`Checking IP: ${ip}`);
      
      // Try to get device info
      const infoUrl = `http://${ip}/info`;
      const deviceUrl = `http://${ip}/device`;
      const statusUrl = `http://${ip}/status`;
      
      // Create an AbortController to handle timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        // Try info endpoint first
        const infoResponse = await fetch(infoUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        });
        
        // Clear timeout
        clearTimeout(timeoutId);
        
        if (infoResponse.ok) {
          try {
            const info = await infoResponse.json();
            console.log(`Found device at ${ip}:`, info);
            
            // Validate that this is our device
            if (info.deviceType === 'AquaSweeper' || info.name === 'AquaSweeper') {
              return {
                ipAddress: ip,
                deviceId: info.id || info.deviceId || 'unknown',
                name: info.name || 'AquaSweeper',
                type: info.deviceType || 'AquaSweeper',
                firmware: info.firmware || 'unknown'
              };
            }
          } catch (parseError) {
            console.error(`Error parsing info from ${ip}:`, parseError);
          }
        }
      } catch (infoError) {
        console.log(`Info endpoint failed for ${ip}:`, infoError);
        // Continue to try other endpoints
      }
      
      // Try device endpoint if info failed
      try {
        const deviceResponse = await fetch(deviceUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        });
        
        // Clear timeout
        clearTimeout(timeoutId);
        
        if (deviceResponse.ok) {
          try {
            const device = await deviceResponse.json();
            console.log(`Found device at ${ip} (device endpoint):`, device);
            
            // Validate that this is our device
            if (device.deviceType === 'AquaSweeper' || device.name === 'AquaSweeper') {
              return {
                ipAddress: ip,
                deviceId: device.id || device.deviceId || 'unknown',
                name: device.name || 'AquaSweeper',
                type: device.deviceType || 'AquaSweeper',
                firmware: device.firmware || 'unknown'
              };
            }
          } catch (parseError) {
            console.error(`Error parsing device info from ${ip}:`, parseError);
          }
        }
      } catch (deviceError) {
        console.log(`Device endpoint failed for ${ip}:`, deviceError);
        // Continue to try status endpoint
      }
      
      // Try status endpoint as a last resort
      try {
        const statusResponse = await fetch(statusUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        });
        
        // Clear timeout
        clearTimeout(timeoutId);
        
        if (statusResponse.ok) {
          try {
            const status = await statusResponse.json();
            console.log(`Found device at ${ip} (status endpoint):`, status);
            
            // If we get a valid status response, assume it's our device
            return {
              ipAddress: ip,
              deviceId: 'unknown',
              name: 'AquaSweeper',
              type: 'AquaSweeper',
              firmware: 'unknown'
            };
          } catch (parseError) {
            console.error(`Error parsing status from ${ip}:`, parseError);
          }
        }
      } catch (statusError) {
        console.log(`Status endpoint failed for ${ip}:`, statusError);
      }
      
      // If we get here, no valid device was found at this IP
      return null;
    } catch (error) {
      console.log(`Error checking device at ${ip}:`, error);
      return null;
    }
  }
}

// Create a singleton instance
const deviceConnectionService = new DeviceConnectionService();
export default deviceConnectionService;
