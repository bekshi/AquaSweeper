import AsyncStorage from '@react-native-async-storage/async-storage';

class DeviceDiscoveryService {
  constructor() {
    this.cachedIPs = new Map();
    this.CACHE_KEY = 'device_ip_cache';
    this.COMMON_IPS = [
      // Default gateway
      1,
      // Common static IPs
      2, 3, 4, 5,
      // Common DHCP ranges
      100, 101, 102,
      150, 151, 152,
      200, 201, 202
    ];
    this.loadCache();
  }

  async loadCache() {
    try {
      const cache = await AsyncStorage.getItem(this.CACHE_KEY);
      if (cache) {
        this.cachedIPs = new Map(JSON.parse(cache));
        console.log('Loaded IP cache:', this.cachedIPs);
      }
    } catch (error) {
      console.error('Error loading IP cache:', error);
    }
  }

  async saveCache() {
    try {
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify([...this.cachedIPs]));
    } catch (error) {
      console.error('Error saving IP cache:', error);
    }
  }

  async updateDeviceIP(deviceId, ip) {
    this.cachedIPs.set(deviceId, ip);
    await this.saveCache();
  }

  getCachedIP(deviceId) {
    return this.cachedIPs.get(deviceId);
  }

  async checkIP(ip, timeout = 300) {
    console.log(`Checking IP: ${ip}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`http://${ip}/discover`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data.deviceType === 'AquaSweeper') {
        console.log('Found device at:', ip);
        // Add IP to response if not present
        if (!data.ip) {
          data.ip = ip;
        }
        return data;
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.debug(`No device at ${ip}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
    return null;
  }

  isAquaSweeperNetwork(ssid) {
    return ssid?.startsWith('AquaSweeper-');
  }

  async findDevice(deviceId, subnet = '192.168.1', networkInfo = null) {
    console.log('Starting device discovery...', { subnet, networkInfo });
    
    // If connected to AquaSweeper network, use fixed IP with longer timeout
    if (networkInfo?.type === 'wifi' && this.isAquaSweeperNetwork(networkInfo?.details?.ssid)) {
      console.log('Connected to AquaSweeper network, using fixed IP');
      const result = await this.checkIP('192.168.4.1', 5000); // 5 second timeout for direct connection
      if (result) {
        return result;
      }
      throw new Error('Could not connect to AquaSweeper device on its network. Please ensure you are connected to the correct network.');
    }

    // Otherwise proceed with network scanning
    // First try cached IP if available
    const cachedIP = this.getCachedIP(deviceId);
    if (cachedIP) {
      console.log('Trying cached IP:', cachedIP);
      const result = await this.checkIP(cachedIP);
      if (result) {
        console.log('Device found at cached IP');
        return result;
      }
      console.log('Cached IP not responding, starting network scan');
    }

    // Check common IPs first
    console.log('Checking common IP addresses...');
    for (const lastOctet of this.COMMON_IPS) {
      const ip = `${subnet}.${lastOctet}`;
      const result = await this.checkIP(ip);
      if (result) {
        await this.updateDeviceIP(deviceId, ip);
        return result;
      }
    }

    // If not found in common IPs, do a limited scan
    console.log('Scanning limited IP range...');
    for (let i = 50; i <= 100; i++) {
      const ip = `${subnet}.${i}`;
      const result = await this.checkIP(ip);
      if (result) {
        await this.updateDeviceIP(deviceId, ip);
        return result;
      }
    }

    throw new Error('Device not found on network');
  }
}

export default new DeviceDiscoveryService();
