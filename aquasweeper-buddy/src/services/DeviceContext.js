import React, { createContext, useState, useContext, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import deviceCommunication from './deviceCommunication';
import { useAuth } from './AuthContext';

const DeviceContext = createContext({});

export const DeviceProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentDevice, setCurrentDevice] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceState, setDeviceState] = useState('stopped');
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load saved device on startup
  useEffect(() => {
    const loadSavedDevice = async () => {
      try {
        const savedDeviceJson = await AsyncStorage.getItem('CURRENT_DEVICE');
        if (savedDeviceJson) {
          const device = JSON.parse(savedDeviceJson);
          setCurrentDevice(device);
          
          // Initialize device communication
          if (device.ipAddress && user) {
            deviceCommunication.initialize(device.ipAddress, device.deviceId, user.email);
            
            // Set up status callback
            deviceCommunication.onStatusUpdate((status) => {
              setDeviceState(status.state || 'stopped');
              if (status.battery) {
                setBatteryLevel(status.battery);
              }
            });
            
            // Set up connection status callback
            deviceCommunication.onConnectionStatusChange((connected) => {
              setIsConnected(connected);
              if (!connected) {
                console.log('Lost connection to device');
              }
            });
            
            // Connect to the device
            deviceCommunication.connect();
          }
        }
      } catch (error) {
        console.error('Error loading saved device:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadSavedDevice();
    } else {
      setLoading(false);
    }

    // Clean up on unmount
    return () => {
      deviceCommunication.disconnect();
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
      setCurrentDevice(device);
      
      if (device.ipAddress && user) {
        // Initialize device communication
        deviceCommunication.initialize(device.ipAddress, device.deviceId, user.email);
        
        // Connect to the device
        const connected = deviceCommunication.connect();
        
        if (!connected) {
          Alert.alert('Connection Failed', 'Could not connect to device');
        }
      }
    } catch (error) {
      console.error('Error connecting to device:', error);
      Alert.alert('Connection Error', error.message);
    }
  };

  const disconnectFromDevice = () => {
    deviceCommunication.disconnect();
    setIsConnected(false);
  };

  const forgetDevice = async () => {
    try {
      disconnectFromDevice();
      setCurrentDevice(null);
      await AsyncStorage.removeItem('CURRENT_DEVICE');
    } catch (error) {
      console.error('Error forgetting device:', error);
    }
  };

  const startDevice = (callback) => {
    return deviceCommunication.start(callback);
  };

  const stopDevice = (callback) => {
    return deviceCommunication.stop(callback);
  };

  const pauseDevice = (callback) => {
    return deviceCommunication.pause(callback);
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
        forgetDevice,
        startDevice,
        stopDevice,
        pauseDevice
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => {
  return useContext(DeviceContext);
};

export default DeviceContext;
