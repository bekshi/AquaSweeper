import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  TextInput,
  Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { db } from '../services/firebase';
import { doc, updateDoc, arrayUnion, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../services/AuthContext';
import { useDevice } from '../services/DeviceContext';
import NetInfo from '@react-native-community/netinfo';

const AQUASWEEPER_AP_PREFIX = 'AquaSweeper';
const DEVICE_IP = '192.168.4.1';

const DevicePairingScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { connectToDevice } = useDevice();
  const [currentStep, setCurrentStep] = useState(0);
  const [homeWifiSSID, setHomeWifiSSID] = useState('');
  const [homeWifiPassword, setHomeWifiPassword] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [connectedToAquaSweeper, setConnectedToAquaSweeper] = useState(false);
  const [showingWifiSettings, setShowingWifiSettings] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [manualIpInput, setManualIpInput] = useState('');
  const [showIpInputDialog, setShowIpInputDialog] = useState(false);

  // Monitor network changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log('Network state changed:', state);
      setNetworkInfo(state);
      
      // Auto-detect connection to AquaSweeper network
      if (state.isConnected && 
          state.type === 'wifi' && 
          state.details && 
          state.details.ssid && 
          state.details.ssid.startsWith(AQUASWEEPER_AP_PREFIX)) {
        console.log('Connected to AquaSweeper network:', state.details.ssid);
        setConnectedToAquaSweeper(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const saveWiFiCredentials = async () => {
    try {
      await AsyncStorage.setItem('HOME_WIFI_SSID', homeWifiSSID);
      await AsyncStorage.setItem('HOME_WIFI_PASSWORD', homeWifiPassword);
      return true;
    } catch (error) {
      setConnectionError('Failed to save WiFi credentials');
      return false;
    }
  };

  const validateAquaSweeperConnection = async () => {
    setIsVerifying(true);
    setConnectionError('');
    console.log('Starting AquaSweeper validation...');

    try {
      console.log('Attempting to connect to device at:', DEVICE_IP);
      
      // First try the /discover endpoint
      try {
        console.log('Checking /discover endpoint...');
        const discoverResponse = await fetch(`http://${DEVICE_IP}/discover`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          cache: 'no-store',
          mode: 'cors',
          credentials: 'omit',
          timeout: 3000 // 3 second timeout
        });

        console.log('Discover response status:', discoverResponse.status);
        
        if (discoverResponse.ok) {
          const discoverData = await discoverResponse.json();
          console.log('Discover data:', discoverData);
          
          if (discoverData.deviceType === 'AquaSweeper') {
            console.log('Device identified as AquaSweeper via /discover');
            
            // Now check the /status endpoint to validate according to the required sequence
            console.log('Checking /status endpoint for validation...');
            const statusResponse = await fetch(`http://${DEVICE_IP}/status`, {
              method: 'GET',
              headers: {
                'Accept': 'application/json'
              },
              timeout: 3000
            });
            
            console.log('Status response:', statusResponse.status);
            
            if (!statusResponse.ok) {
              throw new Error(`Status endpoint returned ${statusResponse.status}`);
            }
            
            // Check content type
            const contentType = statusResponse.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
              throw new Error(`Invalid content type: ${contentType}`);
            }
            
            const statusData = await statusResponse.json();
            console.log('Status data:', statusData);
            
            // Validate required fields
            if (!statusData.hasOwnProperty('operatingState') || !statusData.hasOwnProperty('batteryLevel')) {
              throw new Error('Status response missing required fields');
            }
            
            // If we got here, validation is successful
            setDeviceStatus(statusData);
            setConnectedToAquaSweeper(true);
            
            // Get complete device info
            try {
              const deviceInfo = await getDeviceInfo();
              console.log('Retrieved device info:', deviceInfo);
            } catch (infoError) {
              console.warn('Could not get device info, but device is validated:', infoError);
              // Continue anyway since status validation succeeded
            }
            
            setCurrentStep(1);
            return true;
          } else {
            throw new Error('Not an AquaSweeper device');
          }
        }
      } catch (discoverError) {
        console.error('Error with discover endpoint:', discoverError);
        // Continue to try status endpoint directly
      }
      
      // If discover failed, try status endpoint directly
      console.log('Trying status endpoint directly...');
      const statusResponse = await fetch(`http://${DEVICE_IP}/status`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        timeout: 3000
      });
      
      if (!statusResponse.ok) {
        throw new Error(`HTTP error! status: ${statusResponse.status}`);
      }
      
      // Check content type
      const contentType = statusResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }
      
      const statusData = await statusResponse.json();
      
      // Validate required fields
      if (!statusData.hasOwnProperty('operatingState') || !statusData.hasOwnProperty('batteryLevel')) {
        throw new Error('Status response missing required fields');
      }
      
      setDeviceStatus(statusData);
      setConnectedToAquaSweeper(true);
      setCurrentStep(1);
      return true;

    } catch (error) {
      console.error('Validation error:', error.message);
      setConnectionError(`Could not connect to AquaSweeper: ${error.message}`);
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const openWiFiSettings = async () => {
    if (Platform.OS === 'ios') {
      try {
        await Linking.openURL('App-prefs:root=WIFI');
      } catch (error) {
        try {
          await Linking.openURL('prefs:root=WIFI');
        } catch (error) {
          console.error('Could not open WiFi settings:', error);
          await Linking.openSettings();
        }
      }
    } else {
      await Linking.sendIntent('android.settings.WIFI_SETTINGS');
    }
  };

  const configureWiFi = async () => {
    setIsConfiguring(true);
    setConnectionError('');
    console.log('Starting WiFi configuration...');
    
    try {
      console.log(`Sending WiFi configuration to device at ${DEVICE_IP}`);
      console.log(`SSID: ${homeWifiSSID}, Password: [hidden]`);
      
      // Send the configuration to the device
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const response = await fetch(`http://${DEVICE_IP}/wifi`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ssid: homeWifiSSID,
            password: homeWifiPassword
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('WiFi configuration response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        let data;
        try {
          data = await response.json();
          console.log('WiFi configuration response data:', data);
        } catch (jsonError) {
          console.error('Error parsing JSON response:', jsonError);
          throw new Error('Failed to parse response from device');
        }
        
        if (!data.success) {
          throw new Error(data.message || 'Configuration failed');
        }
        
        // Save device info to Firestore
        console.log('Saving device info to Firestore...');
        const saved = await saveDeviceToFirestore({
          ...deviceInfo,
          homeWifiSSID,
          lastConfigured: new Date().toISOString()
        });
        
        if (!saved) {
          console.error('Failed to save device info to Firestore');
          // Continue anyway, as the device configuration was successful
        }

        // Start the 10-second delay immediately
        console.log('Starting 10-second delay for device configuration...');
        
        // Show a message that the delay is in progress
        Alert.alert(
          'Configuration Sent',
          'WiFi configuration sent to the device. Please wait while the device connects...',
          [{ text: 'OK' }]
        );
        
        // Wait 10 seconds before prompting to reconnect
        setTimeout(() => {
          Alert.alert(
            'Ready to Continue',
            'Now please reconnect to your home WiFi network to complete the setup.',
            [{ 
              text: 'Open WiFi Settings',
              onPress: () => {
                openWiFiSettings();
                setCurrentStep(2);
              }
            }]
          );
          setIsConfiguring(false);
        }, 10000);
      } catch (configError) {
        if (configError.name === 'AbortError') {
          console.log('WiFi configuration request timed out');
          
          // Even though the request timed out, the device might still be configuring
          // Let's assume it worked and proceed anyway
          console.log('Proceeding despite timeout...');
          
          // Save device info to Firestore
          console.log('Saving device info to Firestore despite timeout...');
          const saved = await saveDeviceToFirestore({
            ...deviceInfo,
            homeWifiSSID,
            lastConfigured: new Date().toISOString()
          });
          
          if (!saved) {
            console.error('Failed to save device info to Firestore');
          }
          
          // Start the 10-second delay immediately
          console.log('Starting 10-second delay for device configuration (after timeout)...');
          
          // Show a message that the delay is in progress
          Alert.alert(
            'Configuration Sent',
            'WiFi configuration timed out, but the device may still be configuring. Please wait...',
            [{ text: 'OK' }]
          );
          
          // Wait 10 seconds before prompting to reconnect
          setTimeout(() => {
            Alert.alert(
              'Ready to Continue',
              'Now please reconnect to your home WiFi network to complete the setup.',
              [{ 
                text: 'Open WiFi Settings',
                onPress: () => {
                  openWiFiSettings();
                  setCurrentStep(2);
                }
              }]
            );
            setIsConfiguring(false);
          }, 10000);
        } else {
          throw configError;
        }
      }
    } catch (error) {
      console.error('Configuration error:', error);
      setConnectionError('Failed to configure device: ' + error.message);
      setIsConfiguring(false);
    }
  };

  const verifyHomeNetworkConnection = async () => {
    setIsVerifying(true);
    setConnectionError(null);
    
    try {
      console.log('Verifying device connection on home network...');
      
      // Wait a moment to give the device time to connect to WiFi
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Try to discover the device on the home network
      console.log('Attempting to discover device on home network...');
      const discoveredDevice = await discoverDeviceOnNetwork();
      
      if (discoveredDevice && discoveredDevice.ipAddress) {
        console.log('Device discovered on home network at IP:', discoveredDevice.ipAddress);
        
        // Check if the discovered IP is different from the AP IP
        if (discoveredDevice.ipAddress !== DEVICE_IP) {
          // Update the device info with the new IP
          const updatedDeviceInfo = {
            ...deviceInfo,
            ipAddress: discoveredDevice.ipAddress,
            ip: discoveredDevice.ipAddress // For backward compatibility
          };
          
          // If we got device info from discovery, use it
          if (discoveredDevice.deviceInfo) {
            Object.assign(updatedDeviceInfo, discoveredDevice.deviceInfo);
          }
          
          setDeviceInfo(updatedDeviceInfo);
          console.log('Updated device info with new IP:', updatedDeviceInfo);
          
          // Now verify the device status with the new IP
          try {
            const statusData = await verifyDeviceStatus(discoveredDevice.ipAddress);
            console.log('Device status verified on home network:', statusData);
            
            // Get complete device info from the device if we don't already have it
            let completeDeviceInfo = discoveredDevice.deviceInfo;
            if (!completeDeviceInfo) {
              try {
                completeDeviceInfo = await getDeviceInfo(discoveredDevice.ipAddress);
                console.log('Complete device info retrieved:', completeDeviceInfo);
              } catch (infoError) {
                console.warn('Could not get complete device info:', infoError);
                // Continue anyway since we have the status
              }
            }
            
            // Update device info with complete information
            if (completeDeviceInfo) {
              setDeviceInfo({
                ...updatedDeviceInfo,
                ...completeDeviceInfo,
                // Ensure these fields are set correctly
                ipAddress: discoveredDevice.ipAddress,
                ip: discoveredDevice.ipAddress
              });
            }
            
            // Continue with the verification process
            setIsVerifying(false);
            handleStepAction(2);
            return;
          } catch (statusError) {
            console.error('Error verifying device status on home network:', statusError);
            throw new Error('Device discovered but status verification failed: ' + statusError.message);
          }
        } else {
          console.log('Discovered IP is still the AP IP. Device might not have connected to home network yet.');
          throw new Error('Device is still in AP mode. Please ensure it has connected to your home network.');
        }
      } else {
        console.log('Device not discovered on home network');
        
        // Prompt user to enter IP manually
        Alert.alert(
          'Device Not Found',
          'Could not automatically find your AquaSweeper device on the network. Would you like to enter the IP address manually?',
          [
            {
              text: 'Enter IP Manually',
              onPress: () => {
                // Show dialog to enter IP
                setShowIpInputDialog(true);
              }
            },
            {
              text: 'Try Again',
              onPress: () => {
                // Try again
                verifyHomeNetworkConnection();
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error verifying home network connection:', error);
      setConnectionError('Failed to verify device on home network: ' + error.message);
    } finally {
      setIsVerifying(false);
    }
  };
  
  const promptForDeviceIP = () => {
    setShowIpInputDialog(true);
  };
  
  const handleIpSubmit = async () => {
    if (!manualIpInput || !manualIpInput.trim()) {
      Alert.alert('Error', 'Please enter a valid IP address');
      return;
    }
    
    const ip = manualIpInput.trim();
    setIsVerifying(true);
    
    try {
      console.log(`Verifying manually entered IP: ${ip}`);
      
      // First verify the device status
      const statusData = await verifyDeviceStatus(ip);
      console.log('Device status verified at manual IP:', statusData);
      
      // Then get device info
      const deviceInfoData = await getDeviceInfo(ip);
      console.log('Device info retrieved from manual IP:', deviceInfoData);
      
      // Update the device info with the new IP and info
      const updatedDeviceInfo = {
        ...deviceInfoData,
        ipAddress: ip,
        ip: ip // For backward compatibility
      };
      
      setDeviceInfo(updatedDeviceInfo);
      setShowIpInputDialog(false);
      
      // Continue with the verification process using the new IP
      setCurrentStep(2);
      handleStepAction(2);
      
      Alert.alert('Success', 'Device verified successfully on your home network!');
    } catch (error) {
      console.error('Error verifying manual IP:', error);
      Alert.alert('Verification Failed', `Could not verify device at IP ${ip}: ${error.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // A more comprehensive device discovery function
  const discoverDeviceOnNetwork = async () => {
    console.log('Starting device discovery on network...');
    
    // Get current network info to determine the subnet
    const netInfo = await NetInfo.fetch();
    console.log('Current network info for discovery:', netInfo);
    
    // Generate a list of potential IP addresses to try
    const potentialIPs = [];
    
    // Try to extract subnet from current network info
    let currentSubnet = null;
    if (netInfo && netInfo.details && netInfo.details.ipAddress) {
      const ipParts = netInfo.details.ipAddress.split('.');
      if (ipParts.length === 4) {
        currentSubnet = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
        console.log('Detected current subnet:', currentSubnet);
      }
    }
    
    // If we have a current subnet, prioritize it
    if (currentSubnet) {
      console.log(`Prioritizing current subnet: ${currentSubnet}`);
      
      // First try common router-assigned IPs on current subnet (2-20, 100-150)
      for (let i = 2; i <= 20; i++) {
        potentialIPs.push(`${currentSubnet}.${i}`);
      }
      
      for (let i = 100; i <= 150; i++) {
        potentialIPs.push(`${currentSubnet}.${i}`);
      }
      
      // Then add the rest of the IPs in the subnet (21-99, 151-254)
      for (let i = 21; i <= 99; i++) {
        potentialIPs.push(`${currentSubnet}.${i}`);
      }
      
      for (let i = 151; i <= 254; i++) {
        potentialIPs.push(`${currentSubnet}.${i}`);
      }
    }
    
    // Common home network subnets as fallback
    const commonSubnets = ['192.168.0', '192.168.1', '192.168.2', '10.0.0', '10.0.1'];
    
    // Add IPs from common subnets if they're different from current subnet
    for (const subnet of commonSubnets) {
      if (subnet !== currentSubnet) {
        // Try common router-assigned IPs first (2-20, 100-150)
        for (let i = 2; i <= 20; i++) {
          potentialIPs.push(`${subnet}.${i}`);
        }
        
        for (let i = 100; i <= 150; i++) {
          potentialIPs.push(`${subnet}.${i}`);
        }
      }
    }
    
    console.log(`Generated ${potentialIPs.length} potential IP addresses to check`);
    
    // Try each IP address
    for (const ip of potentialIPs) {
      try {
        console.log(`Trying to connect to possible device IP: ${ip}`);
        
        // First try the status endpoint which is required for validation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 500); // 500ms timeout for faster scanning
        
        const response = await fetch(`http://${ip}/status`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          // Check content type
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.log(`IP ${ip} responded but with wrong content type: ${contentType}`);
            continue;
          }
          
          const data = await response.json();
          console.log(`Response from ${ip}:`, data);
          
          // Validate required fields according to the API interface
          if (data.hasOwnProperty('operatingState') && data.hasOwnProperty('batteryLevel')) {
            console.log('Found AquaSweeper device at IP:', ip);
            
            // Double check with the info endpoint to make sure it's our device
            try {
              const infoResponse = await fetch(`http://${ip}/info`, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json'
                },
                timeout: 1000
              });
              
              if (infoResponse.ok) {
                const infoData = await infoResponse.json();
                console.log(`Device info from ${ip}:`, infoData);
                
                // Check if this is our device by looking for expected fields
                if (infoData.deviceName && infoData.deviceName.startsWith('AquaSweeper')) {
                  console.log('Confirmed AquaSweeper device at IP:', ip);
                  return { 
                    ipAddress: ip,
                    deviceInfo: infoData
                  };
                }
              }
            } catch (infoError) {
              console.log(`Error getting info from ${ip}:`, infoError);
              // Continue with just the IP if we can't get the info
            }
            
            return { ipAddress: ip };
          } else {
            console.log(`IP ${ip} responded but missing required fields`);
          }
        }
      } catch (error) {
        // Ignore errors and try next IP
        if (error.name !== 'AbortError') {
          console.log(`Error checking ${ip}:`, error.message);
        }
      }
    }
    
    console.log('No AquaSweeper device found on the network');
    return null;
  };

  const handleStepAction = async (index) => {
    setConnectionError('');

    switch (index) {
      case 0: // Save home WiFi credentials
        if (!homeWifiSSID || !homeWifiPassword) {
          Alert.alert('Error', 'Please enter both WiFi name and password');
          return;
        }
        if (await saveWiFiCredentials()) {
          Alert.alert(
            'WiFi Details Saved',
            'Now connect to your AquaSweeper device\'s WiFi network. The network name starts with "AquaSweeper-".',
            [
              {
                text: 'Open WiFi Settings',
                onPress: () => {
                  setShowingWifiSettings(true);
                  openWiFiSettings();
                  setCurrentStep(1);
                }
              }
            ]
          );
        }
        break;

      case 1: // Handle AquaSweeper connection and configuration
        if (!showingWifiSettings) {
          // First click: Open WiFi settings
          setShowingWifiSettings(true);
          openWiFiSettings();
        } else if (!connectedToAquaSweeper) {
          // Second click: Validate connection to AquaSweeper
          setIsVerifying(true);
          try {
            const isConnected = await validateAquaSweeperConnection();
            if (isConnected) {
              setConnectedToAquaSweeper(true);
            }
          } finally {
            setIsVerifying(false);
          }
        } else {
          // Third click: Configure AquaSweeper with home network
          configureWiFi();
        }
        break;

      case 2: // Complete setup
        setIsVerifying(true);
        try {
          console.log('Starting device discovery for final setup...');
          
          // First try to discover the device on the network
          const discoveredDevice = await discoverDeviceOnNetwork();
          
          if (discoveredDevice) {
            console.log('Device discovered on network:', discoveredDevice);
            
            // Create device data from discovered device
            const deviceData = {
              deviceId: `${(discoveredDevice.deviceInfo?.macAddress || discoveredDevice.deviceInfo?.mac || '').replace(/:/g, '')}_${Date.now()}`,
              ipAddress: discoveredDevice.ipAddress,
              macAddress: discoveredDevice.deviceInfo?.macAddress || discoveredDevice.deviceInfo?.mac,
              name: discoveredDevice.deviceInfo?.deviceName || discoveredDevice.deviceInfo?.name || 
                    `AquaSweeper-${(discoveredDevice.deviceInfo?.macAddress || discoveredDevice.deviceInfo?.mac || '').slice(-6)}`
            };
            
            console.log('Using discovered device data for connection:', deviceData);
            
            // Connect to the device using DeviceContext
            const connected = await handleDeviceConnection(deviceData);
            
            if (connected) {
              Alert.alert(
                'Setup Complete!',
                'Your AquaSweeper device has been successfully paired and registered.',
                [
                  {
                    text: 'Continue',
                    onPress: () => navigation.navigate('MainHome')
                  }
                ]
              );
            } else {
              throw new Error('Failed to connect to discovered device');
            }
          } 
          // If discovery failed, fall back to stored device info
          else if (deviceInfo) {
            console.log('Device discovery failed. Using stored device info:', deviceInfo);
            
            // Get IP address from device info
            const deviceIp = deviceInfo.ipAddress || deviceInfo.ip;
            
            // Create device data object for DeviceContext
            const deviceData = {
              deviceId: `${(deviceInfo.macAddress || deviceInfo.mac || '').replace(/:/g, '')}_${Date.now()}`,
              ipAddress: deviceIp,
              macAddress: deviceInfo.macAddress || deviceInfo.mac,
              name: deviceInfo.deviceName || deviceInfo.name || `AquaSweeper-${(deviceInfo.macAddress || deviceInfo.mac || '').slice(-6)}`
            };
            
            console.log('Using stored device data for connection:', deviceData);
            
            // Connect to the device using DeviceContext
            const connected = await handleDeviceConnection(deviceData);
            
            if (connected) {
              Alert.alert(
                'Setup Complete!',
                'Your AquaSweeper device has been successfully paired and registered.',
                [
                  {
                    text: 'Continue',
                    onPress: () => navigation.navigate('MainHome')
                  }
                ]
              );
            } else {
              throw new Error('Failed to connect to device');
            }
          } else {
            throw new Error('No device information available for setup');
          }
        } catch (error) {
          console.error('Setup error:', error);
          Alert.alert(
            'Setup Error',
            'Could not complete device setup: ' + error.message,
            [
              {
                text: 'Try Again',
                onPress: () => setCurrentStep(2)
              }
            ]
          );
        } finally {
          setIsVerifying(false);
        }
        break;
    }
  };

  const getStep2ButtonText = () => {
    if (isVerifying) return 'Validating...';
    if (connectedToAquaSweeper) return 'Configure Device';
    if (showingWifiSettings) return "I'm Connected";
    return 'Connect to AquaSweeper';
  };

  const saveDeviceToFirestore = async (deviceInfo) => {
    try {
      console.log('Saving device to Firestore:', deviceInfo);
      
      // Extract device identifiers
      const macAddress = deviceInfo.macAddress || deviceInfo.mac;
      if (!macAddress) {
        console.error('MAC address not found in device info:', deviceInfo);
        throw new Error('MAC address not found in device info');
      }
      
      // Create a unique device ID from MAC address
      const cleanMac = macAddress.replace(/:/g, '');
      const deviceId = cleanMac.slice(-6); // Use last 6 characters of MAC
      
      // Get IP address - check all possible field names
      const ipAddress = deviceInfo.ipAddress || deviceInfo.ip;
      if (!ipAddress) {
        console.error('IP address not found in device info:', deviceInfo);
        throw new Error('IP address not found in device info');
      }
      
      // Get device name - check all possible field names
      const deviceName = deviceInfo.deviceName || deviceInfo.name || `AquaSweeper-${deviceId}`;
      
      // Get a reference to the user document
      const userRef = doc(db, 'users', user.uid);
      
      // Get the user document to check if it exists
      const userDoc = await getDoc(userRef);
      
      // Prepare the device data
      const deviceData = {
        id: deviceId,
        deviceId: deviceId,
        ipAddress: ipAddress,
        macAddress: macAddress,
        name: deviceName,
        addedAt: new Date().toISOString(),
        status: 'online',
        state: 'stopped'
      };
      
      console.log('Prepared device data:', deviceData);
      
      if (userDoc.exists()) {
        // Check if device already exists
        const userData = userDoc.data();
        const connectedDevices = userData.connectedDevices || [];
        const existingDeviceIndex = connectedDevices.findIndex(device => 
          device.id === deviceId || device.deviceId === deviceId || device.macAddress === macAddress
        );
        
        if (existingDeviceIndex >= 0) {
          // Update existing device
          console.log('Updating existing device:', deviceId);
          const updatedDevices = [...connectedDevices];
          updatedDevices[existingDeviceIndex] = {
            ...updatedDevices[existingDeviceIndex],
            ...deviceData,
            updatedAt: new Date().toISOString()
          };
          
          await updateDoc(userRef, {
            connectedDevices: updatedDevices
          });
        } else {
          // Add new device
          console.log('Adding new device:', deviceId);
          await updateDoc(userRef, {
            connectedDevices: arrayUnion(deviceData)
          });
        }
      } else {
        // Create a new user document with connectedDevices array
        await setDoc(userRef, {
          email: user.email,
          connectedDevices: [deviceData]
        });
      }
      
      console.log('Device saved to Firestore successfully');
      return true;
    } catch (error) {
      console.error('Error saving device to Firestore:', error);
      return false;
    }
  };

  const handleDeviceConnection = async (deviceData) => {
    try {
      console.log('Connecting to device with data:', deviceData);
      
      // Ensure we have all required fields before saving
      if (!deviceData.deviceId || !deviceData.ipAddress || !deviceData.macAddress) {
        console.error('Missing required device fields:', deviceData);
        throw new Error('Device information is incomplete');
      }
      
      // If we're still using the AP IP, try to discover the device on the network
      if (deviceData.ipAddress === DEVICE_IP) {
        console.log('Still using AP IP address. Attempting to discover device on home network...');
        
        // Try to discover the device on the network
        const discoveredDevice = await discoverDeviceOnNetwork();
        
        if (discoveredDevice && discoveredDevice.ipAddress) {
          console.log('Found device on home network at IP:', discoveredDevice.ipAddress);
          deviceData.ipAddress = discoveredDevice.ipAddress;
          
          // If we also got device info, update our data
          if (discoveredDevice.deviceInfo) {
            deviceData.macAddress = discoveredDevice.deviceInfo.macAddress || discoveredDevice.deviceInfo.mac || deviceData.macAddress;
            deviceData.name = discoveredDevice.deviceInfo.deviceName || discoveredDevice.deviceInfo.name || deviceData.name;
          }
        } else {
          console.log('Could not discover device on home network. Will continue with AP IP.');
          // We'll continue with the AP IP and hope for the best
        }
      }
      
      // Add network information to the device data
      const netInfo = await NetInfo.fetch();
      const enhancedDeviceData = {
        ...deviceData,
        homeNetwork: netInfo.details?.ssid || 'Unknown',
        lastConnected: new Date().toISOString(),
        isConfigured: true,
        connectedToWiFi: true
      };
      
      console.log('Saving enhanced device data to Firestore:', enhancedDeviceData);
      
      // Save to Firestore
      const saved = await saveDeviceToFirestore(enhancedDeviceData);
      if (!saved) {
        throw new Error('Failed to save device information');
      }
      
      // Connect to the device via DeviceContext
      connectToDevice(enhancedDeviceData);
      
      return true;
    } catch (error) {
      console.error('Error connecting to device:', error);
      Alert.alert('Connection Error', error.message);
      return false;
    }
  };

  const getDeviceInfo = async (deviceIp = DEVICE_IP) => {
    try {
      console.log(`Getting device info from http://${deviceIp}/info`);
      const response = await fetch(`http://${deviceIp}/info`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (!response.ok) {
        console.log('Info endpoint failed, trying /device fallback');
        // Try fallback to /device endpoint
        const fallbackResponse = await fetch(`http://${deviceIp}/device`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          timeout: 5000
        });
        
        if (!fallbackResponse.ok) {
          throw new Error('Failed to get device info from both /info and /device endpoints');
        }
        
        const data = await fallbackResponse.json();
        console.log('Device info from fallback endpoint:', data);
        setDeviceInfo(data);
        return data;
      }
      
      const data = await response.json();
      console.log('Device info from /info endpoint:', data);
      setDeviceInfo(data); // Store the device info in state
      return data;
    } catch (error) {
      console.error('Error getting device info:', error);
      throw error;
    }
  };

  const verifyDeviceStatus = async (deviceIp) => {
    console.log(`Verifying device status at http://${deviceIp}/status`);
    
    try {
      const response = await fetch(`http://${deviceIp}/status`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`Status endpoint returned error: ${response.status}`);
      }
      
      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }
      
      const statusData = await response.json();
      console.log('Status data received:', statusData);
      
      // Validate required fields according to the API interface requirements
      if (!statusData.hasOwnProperty('operatingState')) {
        throw new Error('Status response missing required operatingState field');
      }
      
      if (!statusData.hasOwnProperty('batteryLevel')) {
        throw new Error('Status response missing required batteryLevel field');
      }
      
      // Update device status in state
      setDeviceStatus(statusData);
      return statusData;
    } catch (error) {
      console.error('Error verifying device status:', error);
      throw error;
    }
  };

  const steps = [
    {
      title: 'Enter Home WiFi Details',
      description: 'Enter your home WiFi network details. These will be used to connect your AquaSweeper device.',
      action: () => handleStepAction(0),
      actionText: 'Save WiFi Details',
      loadingText: 'Saving...',
      showWiFiForm: true,
      icon: 'wifi'
    },
    {
      title: 'Connect to AquaSweeper',
      description: 'Connect to your AquaSweeper device to configure it:\n\n1. Open WiFi settings\n2. Connect to "AquaSweeper-XXXX" network\n3. Return to this app',
      action: () => handleStepAction(1),
      actionText: 'Connect to AquaSweeper',
      loadingText: isVerifying ? 'Validating...' : 'Configuring...',
      showSettings: true,
      icon: 'settings-input-antenna'
    },
    {
      title: 'Complete Setup',
      description: 'Reconnect to your home network to complete the setup.',
      action: () => handleStepAction(2),
      actionText: 'Finish Setup',
      loadingText: 'Verifying...',
      showSettings: true,
      icon: 'check-circle'
    }
  ];

  const renderStep = (step, index) => {
    const isCurrentStep = currentStep === index;
    const isCompleted = currentStep > index;
    const buttonText = index === 1 ? getStep2ButtonText() : step.actionText;
    const isLoading = (isConfiguring && index === 1) || (isVerifying && (index === 1 || index === 2));

    return (
      <View key={index} style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <MaterialIcons
            name={isCompleted ? 'check-circle' : step.icon}
            size={24}
            color={isCompleted ? '#4caf50' : isCurrentStep ? '#007AFF' : '#757575'}
          />
          <Text style={[styles.stepTitle, isCurrentStep && styles.activeStepTitle]}>
            {step.title}
          </Text>
        </View>

        <Text style={styles.stepDescription}>{step.description}</Text>

        {isCurrentStep && (
          <View style={styles.inputContainer}>
            {step.showWiFiForm && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="WiFi Network Name (SSID)"
                  placeholderTextColor="#757575"
                  value={homeWifiSSID}
                  onChangeText={setHomeWifiSSID}
                />
                <TextInput
                  style={styles.input}
                  placeholder="WiFi Password"
                  placeholderTextColor="#757575"
                  value={homeWifiPassword}
                  onChangeText={setHomeWifiPassword}
                  secureTextEntry
                />
              </>
            )}
            
            <TouchableOpacity
              style={[
                styles.button,
                (step.showWiFiForm && (!homeWifiSSID || !homeWifiPassword)) && { opacity: 0.5 }
              ]}
              onPress={step.action}
              disabled={step.showWiFiForm && (!homeWifiSSID || !homeWifiPassword) || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>
                  {buttonText}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderConnectionError = () => {
    if (!connectionError) return null;
    
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={24} color="#c62828" />
        <Text style={styles.errorText}>
          {connectionError}
        </Text>
      </View>
    );
  };

  const renderIpInputDialog = () => {
    if (!showIpInputDialog) return null;
    
    return (
      <View style={styles.modalOverlay}>
        <View style={styles.ipInputDialog}>
          <Text style={styles.ipInputDialogTitle}>
            Enter Device IP Address
          </Text>
          <Text style={styles.ipInputDialogSubtitle}>
            Your AquaSweeper device has connected to your home network and received a new IP address. 
            Please enter the IP address assigned by your router.
          </Text>
          <TextInput
            style={styles.ipInputDialogInput}
            placeholder="192.168.x.x"
            placeholderTextColor="#757575"
            value={manualIpInput}
            onChangeText={setManualIpInput}
            keyboardType="numeric"
            autoFocus={true}
          />
          <View style={styles.ipInputDialogButtonRow}>
            <TouchableOpacity
              style={[styles.ipInputDialogButton, styles.cancelButton]}
              onPress={() => setShowIpInputDialog(false)}
            >
              <Text style={styles.ipInputDialogButtonText}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ipInputDialogButton}
              onPress={handleIpSubmit}
            >
              <Text style={styles.ipInputDialogButtonText}>
                Submit
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>
        Device Setup
      </Text>
      
      <Text style={styles.subheader}>
        Follow these steps to connect your AquaSweeper device
      </Text>

      {renderConnectionError()}

      {deviceStatus && (currentStep === 1 || currentStep === 2) && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            Device Status:
          </Text>
          <Text style={[styles.statusDetail, { color: deviceStatus.wifi_connected ? '#4caf50' : '#c62828' }]}>
            {deviceStatus.wifi_connected ? '✓ Connected to WiFi' : '✗ Not Connected to WiFi'}
          </Text>
          <Text style={styles.statusDetail}>
            IP: {deviceStatus.ip || '192.168.4.1'}
          </Text>
          <Text style={styles.statusDetail}>
            Mode: {deviceStatus.mode || 'setup'}
          </Text>
        </View>
      )}

      {steps.map((step, index) => renderStep(step, index))}
      {renderIpInputDialog()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#ffffff',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  subheader: {
    fontSize: 16,
    marginBottom: 24,
    color: '#757575',
  },
  stepContainer: {
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
    color: '#000000',
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    color: '#757575',
  },
  inputContainer: {
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  button: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#ffebee',
    borderRadius: 10,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
    color: '#c62828',
  },
  statusContainer: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#000000',
  },
  statusDetail: {
    fontSize: 14,
    marginBottom: 3,
    color: '#000000',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ipInputDialog: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 20,
    width: 300,
  },
  ipInputDialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000000',
  },
  ipInputDialogSubtitle: {
    fontSize: 14,
    marginBottom: 12,
    color: '#757575',
  },
  ipInputDialogInput: {
    width: 200,
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  ipInputDialogButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ipInputDialogButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  ipInputDialogButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default DevicePairingScreen;
