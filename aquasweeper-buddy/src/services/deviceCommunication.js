import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { updateDeviceStatus, syncDevice } from './deviceService';

// Message types
const MESSAGE_TYPES = {
  COMMAND: 'command',
  STATUS: 'status',
  ACK: 'ack'
};

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
    this.socket = null;
    this.deviceIp = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000; // 3 seconds
    this.messageCallbacks = new Map();
    this.statusCallback = null;
    this.connectionStatusCallback = null;
    this.lastMessageId = 0;
    this.userEmail = null;
    this.deviceId = null;
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

  // Connect to the device WebSocket server
  connect() {
    if (this.socket) {
      this.disconnect();
    }

    try {
      const wsUrl = `ws://${this.deviceIp}:81`;
      console.log(`Connecting to WebSocket at ${wsUrl}`);
      
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = this.handleSocketOpen.bind(this);
      this.socket.onmessage = this.handleSocketMessage.bind(this);
      this.socket.onerror = this.handleSocketError.bind(this);
      this.socket.onclose = this.handleSocketClose.bind(this);
      
      return true;
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.updateConnectionStatus(false);
      return false;
    }
  }

  // Handle socket open event
  handleSocketOpen() {
    console.log('WebSocket connection established');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.updateConnectionStatus(true);
  }

  // Handle incoming socket messages
  handleSocketMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log('Received message:', message);
      
      if (message.type === MESSAGE_TYPES.STATUS) {
        this.handleStatusMessage(message);
      } else if (message.type === MESSAGE_TYPES.ACK) {
        this.handleAcknowledgment(message);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  // Handle status messages from device
  handleStatusMessage(message) {
    if (this.statusCallback) {
      this.statusCallback(message.status);
    }
    
    // Sync device status with Firebase if we have user info
    if (this.userEmail && this.deviceId) {
      syncDevice(this.userEmail, this.deviceId, {
        state: message.status.state,
        lastUpdate: new Date().toISOString()
      }).catch(error => {
        console.error('Error syncing device status:', error);
      });
    }
  }

  // Handle acknowledgment messages
  handleAcknowledgment(message) {
    const callback = this.messageCallbacks.get(message.for);
    if (callback) {
      callback(message.success, message.error || null);
      this.messageCallbacks.delete(message.for);
    }
  }

  // Handle socket errors
  handleSocketError(error) {
    console.error('WebSocket error:', error);
    this.updateConnectionStatus(false);
  }

  // Handle socket close
  handleSocketClose(event) {
    console.log('WebSocket connection closed:', event.code, event.reason);
    this.isConnected = false;
    this.updateConnectionStatus(false);
    
    // Attempt to reconnect if not closed intentionally
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    }
  }

  // Update connection status and notify callback
  updateConnectionStatus(connected) {
    this.isConnected = connected;
    
    if (this.connectionStatusCallback) {
      this.connectionStatusCallback(connected);
    }
    
    // Update device status in Firebase
    if (this.userEmail && this.deviceId) {
      updateDeviceStatus(
        this.userEmail, 
        this.deviceId, 
        connected ? 'online' : 'offline'
      ).catch(error => {
        console.error('Error updating device status:', error);
      });
    }
  }

  // Send command to device
  sendCommand(command, callback = null) {
    if (!this.isConnected) {
      console.warn('Cannot send command: WebSocket not connected');
      if (callback) callback(false, 'WebSocket not connected');
      return false;
    }
    
    if (!Object.values(DEVICE_COMMANDS).includes(command)) {
      console.error('Invalid command:', command);
      if (callback) callback(false, 'Invalid command');
      return false;
    }
    
    try {
      const messageId = `msg_${Date.now()}_${++this.lastMessageId}`;
      
      const message = {
        type: MESSAGE_TYPES.COMMAND,
        command: command,
        id: messageId
      };
      
      if (callback) {
        this.messageCallbacks.set(messageId, callback);
      }
      
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending command:', error);
      if (callback) callback(false, error.message);
      return false;
    }
  }

  // Start the device
  start(callback = null) {
    return this.sendCommand(DEVICE_COMMANDS.START, callback);
  }
  
  // Stop the device
  stop(callback = null) {
    return this.sendCommand(DEVICE_COMMANDS.STOP, callback);
  }
  
  // Pause the device
  pause(callback = null) {
    return this.sendCommand(DEVICE_COMMANDS.PAUSE, callback);
  }

  // Set callback for status updates
  onStatusUpdate(callback) {
    this.statusCallback = callback;
  }
  
  // Set callback for connection status changes
  onConnectionStatusChange(callback) {
    this.connectionStatusCallback = callback;
  }

  // Disconnect from WebSocket
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }
    
    this.isConnected = false;
    this.updateConnectionStatus(false);
  }
}

// Create and export singleton instance
const deviceCommunication = new DeviceCommunication();
export default deviceCommunication;
