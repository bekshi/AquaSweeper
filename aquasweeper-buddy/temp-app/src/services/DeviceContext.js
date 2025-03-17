import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import deviceConnectionService from './DeviceConnectionService';

const DeviceContext = createContext();

export const DeviceProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentDevice, setCurrentDevice] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceState, setDeviceState] = useState('stopped');
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerInterval = useRef(null);
  const lastKnownElapsedTime = useRef(0);
  const lastConnectionState = useRef(false);

  // Debug log for state changes
  useEffect(() => {
    console.log('DeviceContext - State updated:', {
      deviceState,
      isConnected,
      batteryLevel,
      elapsedTime
    });
    
    // Store the last known elapsed time
    lastKnownElapsedTime.current = elapsedTime;
  }, [deviceState, isConnected, batteryLevel, elapsedTime]);

  // Handle connection state changes
  useEffect(() => {
    console.log('DeviceContext - Connection state changed:', isConnected);
    
    // If we're reconnecting after a disconnection
    if (isConnected && !lastConnectionState.current) {
      console.log('DeviceContext - Reconnected, last known elapsed time:', lastKnownElapsedTime.current);
    }
    
    lastConnectionState.current = isConnected;
  }, [isConnected]);

  // Update timer when device state changes
  useEffect(() => {
    console.log('DeviceContext - Device state changed to:', deviceState);
    
    if (deviceState === 'running') {
      startTimerTracking();
    } else if (deviceState === 'paused') {
      stopTimerTracking();
    } else if (deviceState === 'stopped') {
      stopTimerTracking();
      setElapsedTime(0);
      lastKnownElapsedTime.current = 0;
    }
    
    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    };
  }, [deviceState]);

  const startTimerTracking = () => {
    if (timerInterval.current) return;
    
    console.log('DeviceContext - Starting timer tracking, current elapsed time:', elapsedTime);
    timerInterval.current = setInterval(() => {
      setElapsedTime(prevTime => {
        const newTime = prevTime + 1;
        lastKnownElapsedTime.current = newTime;
        return newTime;
      });
    }, 1000);
  };
  
  const stopTimerTracking = () => {
    if (timerInterval.current) {
      console.log('DeviceContext - Stopping timer tracking, final elapsed time:', elapsedTime);
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
  };
  
  const updateElapsedTime = (time) => {
    console.log('DeviceContext - Manually updating elapsed time to:', time);
    setElapsedTime(time);
    lastKnownElapsedTime.current = time;
  };

  // Initialize device connection service and set up callback
  useEffect(() => {
    const initializeDeviceService = async () => {
      try {
        // Set up callback for when a device is found
        deviceConnectionService.setDeviceFoundCallback((device) => {
          console.log('DeviceContext - Device found callback:', device);
          setCurrentDevice(device);
          setIsConnected(true);
          setDeviceState(device.state);
        });

        // Initialize the service
        await deviceConnectionService.initialize();

        // Load saved device
        const savedDeviceJson = await AsyncStorage.getItem('CURRENT_DEVICE');
        if (savedDeviceJson) {
          const device = JSON.parse(savedDeviceJson);
          console.log('Loading saved device:', device);
          
          // Update the last known IP in the connection service
          if (device.ipAddress && device.macAddress) {
            deviceConnectionService.lastKnownIPs.set(device.macAddress, device.ipAddress);
            await deviceConnectionService.saveLastKnownIPs();
          }
          
          setCurrentDevice(device);
        }
      } catch (error) {
        console.error('Error initializing device service:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      initializeDeviceService();
    } else {
      setLoading(false);
    }

    // Cleanup callback on unmount
    return () => {
      deviceConnectionService.setDeviceFoundCallback(null);
    };
  }, [user]);

  // Save current device when it changes
  useEffect(() => {
    const saveCurrentDevice = async () => {
      if (currentDevice) {
        await AsyncStorage.setItem('CURRENT_DEVICE', JSON.stringify(currentDevice));
      } else {
        await AsyncStorage.removeItem('CURRENT_DEVICE');
      }
    };

    saveCurrentDevice();
  }, [currentDevice]);

  const connectToDevice = async (device) => {
    try {
      console.log('Connecting to device:', device);
      
      // Ensure device has all required properties
      const enhancedDevice = {
        ...device,
        id: device.id || device.deviceId,
        name: device.name || `AquaSweeper-${device.id || device.deviceId || ''}`,
      };
      
      setCurrentDevice(enhancedDevice);
      setIsConnected(true);
      return true;
    } catch (error) {
      console.error('Error connecting to device:', error);
      Alert.alert(
        'Connection Error',
        'An error occurred while connecting to the device: ' + error.message,
        [{ text: 'OK' }]
      );
      return false;
    }
  };

  const disconnectFromDevice = () => {
    setCurrentDevice(null);
    setIsConnected(false);
    setDeviceState('stopped');
    setBatteryLevel(null);
  };

  // Device control functions
  const sendCommand = async (command, newState) => {
    if (!isConnected || !currentDevice?.ipAddress) {
      console.log('Cannot send command: not connected');
      return false;
    }

    try {
      const response = await fetch(`http://${currentDevice.ipAddress}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ numericCommand: command })
      });

      if (!response.ok) {
        throw new Error('Failed to send command');
      }

      const result = await response.json();
      if (result.success) {
        // Update device state if command was successful
        if (newState) {
          setDeviceState(newState);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error sending command:', error);
      return false;
    }
  };

  const startDevice = async () => {
    return sendCommand(1, 'running'); // 1 = start
  };

  const stopDevice = async () => {
    return sendCommand(0, 'stopped'); // 0 = stop
  };

  const pauseDevice = async () => {
    return sendCommand(2, 'paused'); // 2 = pause
  };

  return (
    <DeviceContext.Provider
      value={{
        currentDevice,
        isConnected,
        deviceState,
        batteryLevel,
        elapsedTime,
        loading,
        connectToDevice,
        disconnectFromDevice,
        startDevice,
        stopDevice,
        pauseDevice,
        setDeviceState,
        setBatteryLevel,
        setIsConnected,
        updateElapsedTime
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
};

export default DeviceContext;
