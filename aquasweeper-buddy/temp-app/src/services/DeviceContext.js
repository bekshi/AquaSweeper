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
          console.log('Loading saved device:', device);
          setCurrentDevice(device);
          
          // Initialize device communication
          if (device.ipAddress && user) {
            console.log('Initializing device communication with IP:', device.ipAddress);
            deviceCommunication.initialize(device.ipAddress, device.id || device.deviceId, user.email);
            
            // Set up status callback
            deviceCommunication.onStatus((status) => {
              console.log('Received status update:', status);
              setDeviceState(status.state || 'stopped');
              if (status.battery) {
                setBatteryLevel(status.battery);
              }
              // If we receive a status update, we're definitely connected
              setIsConnected(true);
            });
            
            // Set up connection status callback
            deviceCommunication.onConnectionStatus((connected) => {
              console.log('Connection status changed:', connected);
              setIsConnected(connected);
              if (!connected) {
                console.log('Lost connection to device');
              }
            });
            
            // Connect to the device
            console.log('Attempting to connect to device...');
            deviceCommunication.connect()
              .then(connected => {
                console.log('Initial connection attempt result:', connected);
                if (!connected) {
                  console.log('Initial connection failed, retrying in 5 seconds...');
                  // Try again after a delay
                  setTimeout(() => {
                    console.log('Retrying connection...');
                    deviceCommunication.connect()
                      .then(retryConnected => {
                        console.log('Retry connection result:', retryConnected);
                      })
                      .catch(error => {
                        console.error('Error during retry connection:', error);
                      });
                  }, 5000);
                }
              })
              .catch(error => {
                console.error('Error connecting to device:', error);
              });
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
      deviceCommunication.cleanup();
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
      
      // Initialize and connect to device
      if (user) {
        deviceCommunication.initialize(device.ipAddress, enhancedDevice.id, user.email);
        const connected = await deviceCommunication.connect();
        
        if (!connected) {
          Alert.alert(
            'Connection Failed',
            'Unable to connect to the device. Please check that the device is powered on and try again.',
            [{ text: 'OK' }]
          );
        }
        
        return connected;
      }
      
      return false;
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
    deviceCommunication.disconnect();
    setCurrentDevice(null);
    setIsConnected(false);
    setDeviceState('stopped');
    setBatteryLevel(null);
  };

  const checkDeviceConnection = async () => {
    if (!currentDevice || !currentDevice.ipAddress) {
      return false;
    }
    
    try {
      const status = await deviceCommunication.getDeviceStatus();
      return !!status;
    } catch (error) {
      console.error('Error checking device connection:', error);
      return false;
    }
  };

  // Device control functions
  const startDevice = async () => {
    try {
      if (!isConnected) {
        console.log('Cannot start device: not connected');
        return false;
      }
      
      console.log('Starting device...');
      const result = await deviceCommunication.sendCommand('start');
      console.log('Start device result:', result);
      
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
    try {
      if (!isConnected) {
        console.log('Cannot stop device: not connected');
        return false;
      }
      
      console.log('Stopping device...');
      const result = await deviceCommunication.sendCommand('stop');
      console.log('Stop device result:', result);
      
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
    try {
      if (!isConnected) {
        console.log('Cannot pause device: not connected');
        return false;
      }
      
      console.log('Pausing device...');
      const result = await deviceCommunication.sendCommand('pause');
      console.log('Pause device result:', result);
      
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
        checkDeviceConnection,
        startDevice,
        stopDevice,
        pauseDevice
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => useContext(DeviceContext);

export default DeviceContext;
