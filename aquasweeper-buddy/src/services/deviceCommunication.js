import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { updateDeviceStatus, syncDevice } from './deviceService';

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
    this.pollInterval = null;
    this.pollTimeout = 10000; // 10 seconds
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
      console.error('No device IP configured');
      return false;
    }

    try {
      // Try to get initial device status
      const status = await this.getDeviceStatus();
      if (status) {
        this.isConnected = true;
        this.updateConnectionStatus(true);
        this.startPolling();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Connection error:', error);
      this.updateConnectionStatus(false);
      return false;
    }
  }

  // Start polling for device status
  startPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    // Poll every 10 seconds
    this.pollInterval = setInterval(async () => {
      try {
        const status = await this.getDeviceStatus();
        if (!status) {
          this.updateConnectionStatus(false);
        }
      } catch (error) {
        console.error('Error polling device status:', error);
        this.updateConnectionStatus(false);
      }
    }, this.pollTimeout);
  }

  // Stop polling
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // Update connection status and notify callback
  updateConnectionStatus(connected) {
    const statusChanged = this.isConnected !== connected;
    this.isConnected = connected;
    
    if (statusChanged && this.connectionStatusCallback) {
      this.connectionStatusCallback(connected);
    }
    
    // Update device status in Firebase
    if (statusChanged && this.userEmail && this.deviceId) {
      updateDeviceStatus(
        this.userEmail, 
        this.deviceId, 
        connected ? 'online' : 'offline'
      ).catch(error => {
        console.error('Error updating device status:', error);
      });
    }
  }

  // Get device status via HTTP
  async getDeviceStatus() {
    try {
      const response = await fetch(`http://${this.deviceIp}/status`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get device status');
      }

      const status = await response.json();
      
      if (this.statusCallback) {
        this.statusCallback(status);
      }

      // Sync device status with Firebase
      if (this.userEmail && this.deviceId) {
        syncDevice(this.userEmail, this.deviceId, {
          state: status.state || 'stopped',
          lastUpdate: new Date().toISOString()
        }).catch(error => {
          console.error('Error syncing device status:', error);
        });
      }

      return status;
    } catch (error) {
      console.error('Error getting device status:', error);
      return null;
    }
  }

  // Send command to device via HTTP
  async sendCommand(command) {
    if (!this.isConnected) {
      console.warn('Cannot send command: Not connected to device');
      return false;
    }

    try {
      const response = await fetch(`http://${this.deviceIp}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ numericCommand: this.getNumericCommand(command) })
      });

      if (!response.ok) {
        throw new Error('Failed to send command');
      }

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Error sending command:', error);
      return false;
    }
  }

  // Convert command string to numeric command
  getNumericCommand(command) {
    switch (command) {
      case 'stop':
        return 0;
      case 'start':
        return 1;
      case 'pause':
        return 2;
      default:
        throw new Error('Invalid command');
    }
  }

  // Disconnect from device
  disconnect() {
    this.stopPolling();
    this.isConnected = false;
    this.updateConnectionStatus(false);
  }

  // Clean up resources
  cleanup() {
    this.disconnect();
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }
  }

  // Set status callback
  onStatus(callback) {
    this.statusCallback = callback;
  }

  // Set connection status callback
  onConnectionStatus(callback) {
    this.connectionStatusCallback = callback;
  }
}

// Create and export singleton instance
const deviceCommunication = new DeviceCommunication();
export default deviceCommunication;
