import React, { createContext, useState, useContext, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import deviceConnectionService from './DeviceConnectionService';

const DeviceContext = createContext({});

export const DeviceProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentDevice, setCurrentDevice] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceState, setDeviceState] = useState('stopped');
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [loading, setLoading] = useState(true);

  // Debug log for state changes
  useEffect(() => {
    console.log('DeviceContext - State Change:', {
      hasDevice: !!currentDevice,
      deviceIp: currentDevice?.ipAddress,
      isConnected,
      deviceState,
      batteryLevel
    });
  }, [currentDevice, isConnected, deviceState, batteryLevel]);

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
  const startDevice = async () => {
    if (!isConnected || !currentDevice?.ipAddress) {
      console.log('Cannot start device: not connected');
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
        body: JSON.stringify({ numericCommand: 1 }) // 1 = start
      });

      if (!response.ok) {
        throw new Error('Failed to start device');
      }

      const result = await response.json();
      if (result.success) {
        setDeviceState('running');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error starting device:', error);
      return false;
    }
  };

  const stopDevice = async () => {
    if (!isConnected || !currentDevice?.ipAddress) {
      console.log('Cannot stop device: not connected');
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
        body: JSON.stringify({ numericCommand: 0 }) // 0 = stop
      });

      if (!response.ok) {
        throw new Error('Failed to stop device');
      }

      const result = await response.json();
      if (result.success) {
        setDeviceState('stopped');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error stopping device:', error);
      return false;
    }
  };

  const pauseDevice = async () => {
    if (!isConnected || !currentDevice?.ipAddress) {
      console.log('Cannot pause device: not connected');
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
        body: JSON.stringify({ numericCommand: 2 }) // 2 = pause
      });

      if (!response.ok) {
        throw new Error('Failed to pause device');
      }

      const result = await response.json();
      if (result.success) {
        setDeviceState('paused');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error pausing device:', error);
      return false;
    }
  };

  return (
    <DeviceContext.Provider
      value={{
        currentDevice,
        isConnected,
        deviceState,
        batteryLevel,
        loading,
        connectToDevice,
        disconnectFromDevice,
        startDevice,
        stopDevice,
        pauseDevice,
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
