import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { updateDeviceStatus, syncDevice } from './deviceService';

// Device commands
const DEVICE_COMMANDS = {
  START: 'start',
  STOP: 'stop',
  PAUSE: 'pause'
};

// Device states
const DEVICE_STATES = {
  RUNNING: 'running',
  STOPPED: 'stopped',
  PAUSED: 'paused',
  ERROR: 'error'
};

class DeviceCommunication {
  constructor() {
    this.deviceIp = null;
    this.isConnected = false;
    this.statusCallback = null;
    this.connectionStatusCallback = null;
    this.userEmail = null;
    this.deviceId = null;
    this.pollingInterval = null;
    this.pollFrequency = 3000; // Poll every 3 seconds
    this.connectionFailCount = 0;
    this.maxConnectionFailCount = 3;
  }

  // Initialize with device information
  initialize(deviceIp, deviceId, userEmail) {
    this.deviceIp = deviceIp;
    this.deviceId = deviceId;
    this.userEmail = userEmail;
    this.setupNetworkListener();
    return this;
  }

  // Setup network state change listener
  setupNetworkListener() {
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && this.deviceIp && !this.isConnected) {
        this.connect();
      }
    });
  }

  // Connect to the device
  async connect() {
    if (!this.deviceIp) {
      console.error('Device IP not set');
      this.updateConnectionStatus(false);
      return false;
    }

    try {
      console.log(`Attempting to connect to device at IP: ${this.deviceIp}`);
      
      // First try to get device info to verify this is our device
      const deviceInfo = await this.getDeviceInfo();
      if (deviceInfo) {
        console.log('Device info retrieved successfully:', deviceInfo);
      } else {
        console.log('Could not retrieve device info');
      }
      
      // Check if device is reachable with a status request
      const status = await this.getDeviceStatus();
      
      if (status) {
        console.log('Device status retrieved successfully:', status);
        this.isConnected = true;
        this.updateConnectionStatus(true);
        
        // Start polling for status updates
        this.startStatusPolling();
        
        return true;
      } else {
        console.log('Device connection failed - could not get status');
        this.updateConnectionStatus(false);
        return false;
      }
    } catch (error) {
      console.error('Device connection error:', error);
      this.updateConnectionStatus(false);
      return false;
    }
  }

  // Start polling for status updates
  startStatusPolling() {
    console.log('Starting status polling');
    
    // Clear any existing polling
    this.stopStatusPolling();
    
    // Set up polling interval
    this.statusPollingInterval = setInterval(async () => {
      try {
        if (!this.deviceIp) {
          console.warn('Device IP not set, stopping status polling');
          this.stopStatusPolling();
          return;
        }
        
        const status = await this.getDeviceStatus();
        
        if (status) {
          // Status received successfully
          if (this.statusCallback) {
            this.statusCallback(this.transformStatus(status));
          }
          
          // Reset connection fail count
          this.connectionFailCount = 0;
          
          // Update connection status if it was previously disconnected
          if (!this.isConnected) {
            console.log('Device reconnected during status polling');
            this.isConnected = true;
            this.updateConnectionStatus(true);
          }
        } else {
          // Failed to get status
          this.connectionFailCount++;
          console.warn(`Failed to get status, fail count: ${this.connectionFailCount}`);
          
          // If we've failed too many times, consider the device disconnected
          if (this.connectionFailCount >= 3) {
            console.log('Device considered disconnected after multiple failed status polls');
            this.isConnected = false;
            this.updateConnectionStatus(false);
            
            // Try to reconnect if we've hit the threshold
            if (this.connectionFailCount === 3) {
              console.log('Attempting to reconnect...');
              this.connect().catch(error => {
                console.error('Reconnection attempt failed:', error);
              });
            }
            
            // If we've failed too many times, stop polling
            if (this.connectionFailCount >= 10) {
              console.log('Too many failed status polls, stopping polling');
              this.stopStatusPolling();
            }
          }
        }
      } catch (error) {
        console.error('Error during status polling:', error);
        this.connectionFailCount++;
        
        // If we've failed too many times, consider the device disconnected
        if (this.connectionFailCount >= 3) {
          this.isConnected = false;
          this.updateConnectionStatus(false);
        }
      }
    }, this.pollFrequency);
  }

  // Stop polling for status updates
  stopStatusPolling() {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
  }

  // Disconnect from device
  disconnect() {
    this.stopStatusPolling();
    this.isConnected = false;
    this.updateConnectionStatus(false);
    console.log('Disconnected from device');
  }

  // Clean up resources
  cleanup() {
    this.disconnect();
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }
  }

  // Send a command to the device
  async sendCommand(command, params = {}) {
    if (!this.deviceIp) {
      console.error('Device IP not set');
      return { success: false, error: 'Device IP not set' };
    }

    try {
      const url = `http://${this.deviceIp}/control`;
      console.log(`Sending command to ${url}: ${command}`);
      
      const requestBody = JSON.stringify({
        action: command,
        ...params
      });
      
      console.log('Request body:', requestBody);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: requestBody,
        timeout: 5000 // 5 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP error! status: ${response.status}, response: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      try {
        const result = await response.json();
        console.log('Command result:', result);
        
        // If command was successful, get latest status
        if (result.success) {
          this.getDeviceStatus();
        }
        
        return result;
      } catch (parseError) {
        console.error('Error parsing command result:', parseError);
        throw parseError;
      }
    } catch (error) {
      console.error('Error sending command:', error);
      return { success: false, error: error.message };
    }
  }

  // Get device status
  async getDeviceStatus() {
    if (!this.deviceIp) {
      console.error('Device IP not set');
      return null;
    }

    try {
      const url = `http://${this.deviceIp}/status`;
      console.log(`Getting device status from ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Check content type to ensure we're getting JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      try {
        const status = await response.json();
        console.log('Device status:', status);
        
        // Validate the response has expected fields
        if (!status.hasOwnProperty('operatingState') && !status.hasOwnProperty('batteryLevel')) {
          console.warn('Status response missing expected fields:', status);
        }
        
        // Reset connection fail count on successful status fetch
        this.connectionFailCount = 0;
        this.updateConnectionStatus(true);
        
        return status;
      } catch (parseError) {
        console.error('Error parsing status JSON:', parseError);
        throw parseError;
      }
    } catch (error) {
      console.error('Error getting device status:', error);
      return null;
    }
  }

  // Handle status update
  handleStatusUpdate(status) {
    if (this.statusCallback) {
      // Transform the status to match expected format if needed
      const transformedStatus = {
        state: status.operatingState,
        battery: status.batteryLevel,
        isRunning: status.isRunning,
        isPaused: status.isPaused
      };
      
      this.statusCallback(transformedStatus);
    }
    
    // Sync with cloud if we have user email and device ID
    if (this.userEmail && this.deviceId) {
      syncDevice(this.userEmail, this.deviceId, {
        state: status.operatingState,
        battery: status.batteryLevel,
        lastSeen: new Date().toISOString()
      });
    }
  }

  // Update connection status and notify callback
  updateConnectionStatus(isConnected) {
    const statusChanged = this.isConnected !== isConnected;
    this.isConnected = isConnected;
    
    if (statusChanged && this.connectionStatusCallback) {
      this.connectionStatusCallback(isConnected);
    }
  }

  // Register status callback
  onStatus(callback) {
    this.statusCallback = callback;
  }

  // Register connection status callback
  onConnectionStatus(callback) {
    this.connectionStatusCallback = callback;
    // Immediately notify with current status
    if (callback) {
      callback(this.isConnected);
    }
  }

  // Check if connected to device
  isDeviceConnected() {
    return this.isConnected;
  }

  // Get device info
  async getDeviceInfo() {
    if (!this.deviceIp) {
      console.error('Device IP not set');
      return null;
    }

    try {
      const url = `http://${this.deviceIp}/info`;
      console.log(`Getting device info from ${url}`);
      
      let response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 5000 // 5 second timeout
        });
      } catch (fetchError) {
        console.error(`Error fetching from ${url}:`, fetchError);
        throw fetchError;
      }
      
      if (!response.ok) {
        console.log(`/info endpoint failed with status ${response.status}, trying fallback...`);
        // Try fallback to /device endpoint
        const fallbackUrl = `http://${this.deviceIp}/device`;
        console.log(`Trying fallback URL: ${fallbackUrl}`);
        
        try {
          const fallbackResponse = await fetch(fallbackUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            timeout: 5000 // 5 second timeout
          });
          
          if (!fallbackResponse.ok) {
            throw new Error(`HTTP error! status: ${fallbackResponse.status}`);
          }
          
          // Check content type to ensure we're getting JSON
          const contentType = fallbackResponse.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Invalid content type from fallback: ${contentType}`);
          }
          
          try {
            const info = await fallbackResponse.json();
            console.log('Device info (fallback):', info);
            return info;
          } catch (parseError) {
            console.error('Error parsing fallback JSON:', parseError);
            throw parseError;
          }
        } catch (fallbackError) {
          console.error(`Error with fallback URL:`, fallbackError);
          throw fallbackError;
        }
      }

      // Check content type to ensure we're getting JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }
      
      try {
        const info = await response.json();
        console.log('Device info:', info);
        return info;
      } catch (parseError) {
        console.error('Error parsing info JSON:', parseError);
        throw parseError;
      }
    } catch (error) {
      console.error('Error getting device info:', error);
      return null;
    }
  }

  transformStatus(status) {
    return {
      state: status.operatingState,
      battery: status.batteryLevel,
      isRunning: status.isRunning,
      isPaused: status.isPaused
    };
  }
}

// Create and export singleton instance
const deviceCommunication = new DeviceCommunication();
export default deviceCommunication;
