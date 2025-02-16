import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../services/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';

const WIFI_CONFIG_STORAGE_KEY = '@aquasweeper_wifi_config';
const ESP_SSID_PREFIX = 'AquaSweeper-';
const ESP_CONFIG_URL = 'http://192.168.4.1';

const DevicePairingScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [homeWifiSSID, setHomeWifiSSID] = useState('');
  const [homeWifiPassword, setHomeWifiPassword] = useState('');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isConnectedToESP32, setIsConnectedToESP32] = useState(false);
  const [manuallyConnected, setManuallyConnected] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [config, setConfig] = useState(null);

  const ESP32_IP = '192.168.4.1';
  const ESP32_STATUS_URL = `http://${ESP32_IP}/status`;

  // Store WiFi credentials for when we reconnect to dev server
  const saveWifiConfig = async () => {
    try {
      const config = {
        ssid: homeWifiSSID,
        password: homeWifiPassword,
        timestamp: new Date().toISOString(),
      };
      await AsyncStorage.setItem(WIFI_CONFIG_STORAGE_KEY, JSON.stringify(config));
      return true;
    } catch (error) {
      console.error('Error saving WiFi config:', error);
      return false;
    }
  };

  // Check if we have pending configuration from before network switch
  const checkPendingConfig = async () => {
    try {
      const configStr = await AsyncStorage.getItem(WIFI_CONFIG_STORAGE_KEY);
      if (configStr) {
        const config = JSON.parse(configStr);
        const configTime = new Date(config.timestamp);
        const now = new Date();
        // Only use config if it's less than 5 minutes old
        if (now.getTime() - configTime.getTime() < 5 * 60 * 1000) {
          setHomeWifiSSID(config.ssid);
          setHomeWifiPassword(config.password);
          return true;
        }
        // Clear old config
        await AsyncStorage.removeItem(WIFI_CONFIG_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error checking pending config:', error);
    }
    return false;
  };

  useEffect(() => {
    checkPendingConfig();
  }, []);

  useEffect(() => {
    console.log('Current step:', currentStep);
    console.log('Is connected to ESP32:', isConnectedToESP32);
  }, [currentStep, isConnectedToESP32]);

  const steps = [
    {
      title: 'Enter Home WiFi Details',
      description: 'Enter your home WiFi 2.4GHz network details. These will be used to configure your AquaSweeper device.',
      action: 'Save WiFi Details',
      icon: 'wifi'
    },
    {
      title: 'Connect to AquaSweeper',
      description: `1. Open WiFi settings and connect to "AquaSweeper-XXXX" network (password: 12345678)\n2. Once connected, tap "I'm Connected" below\n3. Then tap "Configure Device" to send WiFi details`,
      action: manuallyConnected ? 'Configure Device' : "I'm Connected",
      icon: 'settings-input-antenna'
    },
    {
      title: 'Verify Connection',
      description: 'Verify that your AquaSweeper device has connected to your home network successfully.',
      action: 'Verify Connection',
      icon: 'check-circle'
    }
  ];

  const checkESP32Connection = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      console.log('Current network:', netInfo);
      console.log('SSID:', netInfo.details?.ssid);
      
      // Check if connected to AquaSweeper network
      if (netInfo.type === 'wifi' && netInfo.details?.ssid?.includes('AquaSweeper')) {
        console.log('✅ Connected to AquaSweeper network');
        setIsConnectedToESP32(true);
        return true;
      }
      
      console.log('❌ Not connected to AquaSweeper network');
      setIsConnectedToESP32(false);
      return false;
    } catch (error) {
      console.log('❌ Network check error:', error);
      setIsConnectedToESP32(false);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    let checkInterval;

    const startChecking = async () => {
      if (currentStep === 1 && mounted) {
        console.log('Starting network checks...');
        
        // Initial check
        await checkESP32Connection();
        
        // Start periodic checks
        checkInterval = setInterval(async () => {
          if (mounted) {
            await checkESP32Connection();
          }
        }, 3000);
      } else {
        setIsConnectedToESP32(false);
      }
    };

    startChecking();

    return () => {
      mounted = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [currentStep]);

  // Function to scan for networks
  const scanNetworks = async () => {
    try {
      const response = await fetch(`${ESP_CONFIG_URL}/scan`);
      if (!response.ok) {
        throw new Error('Network scan failed');
      }
      const networks = await response.json();
      return networks;
    } catch (error) {
      console.error('Error scanning networks:', error);
      return null;
    }
  };

  // Function to verify network exists
  const verifyNetwork = async (ssid) => {
    const networks = await scanNetworks();
    if (!networks) {
      return false;
    }
    return networks.some(network => network.ssid === ssid);
  };

  const configureDevice = async (config, retryCount = 0) => {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    try {
      // First try to get device status
      console.log(`Attempt ${retryCount + 1}: Getting device status...`);
      try {
        const statusResponse = await fetch('http://192.168.4.1/status', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          timeout: 5000 // 5 second timeout for status
        });
        console.log('Status response:', statusResponse.status);
        const statusData = await statusResponse.json();
        console.log('Status data:', statusData);
      } catch (error) {
        console.log('Status check failed (this is normal if device was just reset):', error);
      }

      // Then send WiFi configuration
      console.log('Sending config to device:', {
        ssid: config.ssid,
        password: config.password ? '********' : undefined
      });
      
      const requestConfig = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          ssid: config.ssid,
          password: config.password
        })
      };
      
      console.log('Request headers:', requestConfig.headers);
      console.log('Request body:', requestConfig.body);
      
      const response = await fetch('http://192.168.4.1/configure', requestConfig);

      console.log('Response status:', response.status);
      console.log('Response headers:', {
        type: response.headers.get('content-type'),
        cors: response.headers.get('access-control-allow-origin'),
      });

      let data;
      try {
        data = JSON.parse(response.headers.get('content-type'));
      } catch (e) {
        console.error('Error parsing response:', e);
        throw new Error(`Invalid response from device: ${response.headers.get('content-type')}`);
      }

      if (response.ok && data.success) {
        console.log('Configuration successful:', data);
        // Store device info for verification
        if (data.deviceId) {
          await AsyncStorage.setItem('DEVICE_ID', data.deviceId);
        }
        return { success: true, data };
      } else {
        throw new Error(data.error || data.message || 'Failed to configure device');
      }
    } catch (error) {
      console.error(`Configuration attempt ${retryCount + 1} failed:`, error);
      
      // If we haven't exceeded max retries, try again with exponential backoff
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return configureDevice(config, retryCount + 1);
      }
      
      throw error;
    }
  };

  const handleStepAction = async (stepIndex) => {
    console.log('handleStepAction called with step:', stepIndex);
    
    switch (stepIndex) {
      case 0:
        console.log('Step 0: Handling WiFi details save');
        handleWifiDetailsSave();
        break;
      case 1:
        console.log('Step 1: Handling device configuration');
        if (!manuallyConnected) {
          console.log('Setting manually connected flag...');
          setManuallyConnected(true);
        } else {
          console.log('Configuring device...');
          const configStr = await AsyncStorage.getItem(WIFI_CONFIG_STORAGE_KEY);
          if (configStr) {
            const config = JSON.parse(configStr);
            setIsConfiguring(true);
            try {
              const result = await configureDevice(config);
              setConfig(config);

              Alert.alert(
                'Device Configured',
                'Configuration successful! Now connect back to your home WiFi network and tap "Verify Connection".',
                [
                  {
                    text: 'Open WiFi Settings',
                    onPress: async () => {
                      setManuallyConnected(false);
                      // Wait a moment before opening WiFi settings to ensure device has time to switch modes
                      setTimeout(async () => {
                        await openWiFiSettings();
                        setCurrentStep(2);
                      }, 2000);
                    }
                  }
                ]
              );
            } catch (error) {
              console.error('Configuration error:', error);
              Alert.alert(
                'Error',
                `Failed to configure device: ${error.message}. Please make sure you're connected to the AquaSweeper network and try again.`
              );
            } finally {
              setIsConfiguring(false);
            }
          }
        }
        break;
      case 2:
        console.log('Step 2: Verifying connection...');
        await verifyDeviceConnection();
        break;
      default:
        console.log('Unknown step:', stepIndex);
    }
  };

  const findDeviceOnNetwork = async () => {
    console.log('Starting device discovery...');
    
    const deviceId = await AsyncStorage.getItem('DEVICE_ID');
    console.log('Stored device ID:', deviceId);
    
    if (!deviceId) {
      throw new Error('No device ID stored. Please reconfigure the device.');
    }

    // Wait for WiFi to reconnect to home network
    console.log('Waiting for WiFi reconnection...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
      // Method 1: Try mDNS hostname
      const hostname = `aquasweeper-${deviceId.toLowerCase()}`;
      console.log('Trying hostname:', hostname);
      try {
        const response = await fetch(`http://${hostname}.local/status`);
        if (response.ok) {
          const status = await response.json();
          console.log('Device status via hostname:', status);
          if (status.device_id?.toLowerCase() === deviceId.toLowerCase()) {
            console.log('Found device via hostname!');
            return status;
          }
        }
      } catch (error) {
        console.log('Hostname lookup failed:', error);
      }

      // Method 2: Scan common IP addresses
      console.log('Scanning common IPs...');
      const commonIPs = [
        '192.168.1.', 
        '192.168.0.',
        '10.0.0.'
      ];

      for (const baseIP of commonIPs) {
        for (let i = 2; i <= 20; i++) {
          const ip = baseIP + i;
          console.log('Trying IP:', ip);
          try {
            const response = await fetch(`http://${ip}/status`, { 
              timeout: 1000
            });
            if (response.ok) {
              const status = await response.json();
              console.log('Got status from', ip, ':', status);
              if (status.device_id?.toLowerCase() === deviceId.toLowerCase()) {
                console.log('Found device at IP:', ip);
                return status;
              }
            }
          } catch (error) {
            // Ignore timeouts and continue
          }
        }
      }

      throw new Error('Device not found on network');
    } catch (error) {
      console.error('Error finding device:', error);
      throw error;
    }
  };

  const verifyDeviceConnection = async () => {
    setIsVerifying(true);
    let attempts = 0;
    const maxAttempts = 10; // Try for about 50 seconds total
    
    const attemptVerification = async () => {
      try {
        // Wait for network to be ready
        const netInfo = await NetInfo.fetch();
        if (netInfo.type !== 'wifi' || !netInfo.isConnected) {
          console.log('Not connected to WiFi:', netInfo);
          throw new Error('Please connect to your home WiFi network');
        }

        // Try to get device info using stored configuration
        const configStr = await AsyncStorage.getItem(WIFI_CONFIG_STORAGE_KEY);
        if (!configStr) {
          throw new Error('No device configuration found');
        }
        const config = JSON.parse(configStr);

        // Get device MAC address from previous configuration
        const deviceResponse = await fetch('http://192.168.4.1/getDeviceInfo', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          timeout: 5000
        });

        if (!deviceResponse.ok) {
          throw new Error('Could not get device information');
        }

        const deviceInfo = await deviceResponse.json();
        console.log('Device info:', deviceInfo);

        if (!deviceInfo.isConnected) {
          throw new Error('Device is not connected to WiFi network');
        }

        if (deviceInfo.wifiSSID !== config.ssid) {
          throw new Error(`Device is connected to wrong network. Expected: ${config.ssid}, Got: ${deviceInfo.wifiSSID}`);
        }

        // Store device in Firestore
        if (user?.uid) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            'settings.devices': arrayUnion({
              id: deviceInfo.deviceId,
              name: deviceInfo.name,
              macAddress: deviceInfo.macAddress,
              ipAddress: deviceInfo.ipAddress,
              dateAdded: new Date().toISOString(),
              lastSeen: new Date().toISOString(),
              isConnected: true
            })
          });
        }

        Alert.alert(
          'Success!',
          'Device successfully connected to your network!',
          [
            {
              text: 'OK',
              onPress: () => navigation.replace('MainHome')
            }
          ]
        );
        return true;
      } catch (error) {
        console.log(`Verification attempt ${attempts + 1} failed:`, error);
        return false;
      }
    };

    while (attempts < maxAttempts && !isVerifying) {
      const success = await attemptVerification();
      if (success) {
        setIsVerifying(false);
        return;
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    setIsVerifying(false);
    Alert.alert(
      'Connection Failed',
      'Could not verify the device connection. Please make sure:\n\n' +
      '1. You are connected to your home WiFi network\n' +
      '2. The device LED is solid (not blinking)\n' +
      '3. You are within range of the device\n\n' +
      'Would you like to try again?',
      [
        {
          text: 'Try Again',
          onPress: () => verifyDeviceConnection()
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const verifyConnection = async () => {
    setIsVerifying(true);
    let attempts = 0;
    const maxAttempts = 6; // Try for 30 seconds (6 attempts * 5 seconds)
    
    const attemptVerification = async () => {
      try {
        // First quick check with short timeout
        const quickCheck = await fetch('http://192.168.4.1/status', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          timeout: 2000 // 2 second timeout
        });

        if (!quickCheck.ok) {
          throw new Error('Device not responding');
        }

        // If quick check passes, get the device info
        const deviceInfoResponse = await fetch('http://192.168.4.1/info', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          timeout: 2000
        });

        if (!deviceInfoResponse.ok) {
          throw new Error('Could not get device information');
        }

        const deviceInfo = await deviceInfoResponse.json();
        console.log('Device found! Status:', deviceInfo);
        
        if (!deviceInfo.connected) {
          throw new Error('Device is not connected to WiFi network');
        }

        if (deviceInfo.ssid !== config.ssid) {
          throw new Error(`Device is connected to wrong network. Expected: ${config.ssid}, Got: ${deviceInfo.ssid}`);
        }

        // Store device in Firestore
        if (user?.uid) {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          const userData = userDoc.data();
          
          // Use settings.devices consistently
          const devices = userData.settings?.devices || [];
          
          // Check if device already exists
          const deviceIndex = devices.findIndex(d => d.id === deviceInfo.device_id);
          if (deviceIndex >= 0) {
            devices[deviceIndex] = { ...devices[deviceIndex], ...deviceInfo };
          } else {
            devices.push(deviceInfo);
          }

          await updateDoc(userRef, {
            'settings.devices': devices
          });
        }
        
        Alert.alert(
          'Success!',
          'Device successfully connected to your network!',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to main home screen with drawer
                navigation.replace('MainHome');
              }
            }
          ]
        );
        return true;
      } catch (error) {
        console.log(`Verification attempt ${attempts + 1} failed:`, error);
        return false;
      }
    };

    while (attempts < maxAttempts) {
      console.log(`Verification attempt ${attempts + 1} of ${maxAttempts}`);
      const success = await attemptVerification();
      if (success) {
        setIsVerifying(false);
        return;
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        console.log('Waiting 5 seconds before next attempt...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // If we get here, all attempts failed
    setIsVerifying(false);
    Alert.alert(
      'Connection Failed',
      'Could not find the device on your network after multiple attempts. Make sure:\n\n' +
      '1. You entered the correct WiFi credentials\n' +
      '2. Your device is powered on\n' +
      '3. You are connected to your home WiFi',
      [
        {
          text: 'Try Again',
          onPress: () => verifyConnection()
        },
        {
          text: 'Cancel'
        }
      ]
    );
  };

  const handleWifiDetailsSave = async () => {
    if (!homeWifiSSID || !homeWifiPassword) {
      Alert.alert('Error', 'Please enter both WiFi name and password');
      return;
    }

    setIsConfiguring(true);
    try {
      // Save the WiFi config first
      await saveWifiConfig();
      
      Alert.alert(
        'Connect to AquaSweeper',
        'Please follow these steps:\n\n' +
        '1. Open WiFi settings\n' +
        '2. Connect to "AquaSweeper-XXXX" network\n' +
        '3. Stay connected until configuration is complete.\n\n' +
        'The app will automatically configure the device once connected.',
        [
          {
            text: 'Open WiFi Settings',
            onPress: async () => {
              await openWiFiSettings();
              setCurrentStep(1);
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Error saving config:', error);
      Alert.alert('Error', 'Failed to save WiFi configuration. Please try again.');
    } finally {
      setIsConfiguring(false);
    }
  };

  const openWiFiSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('App-Prefs:root=WIFI');
      } else {
        await Linking.sendIntent('android.settings.WIFI_SETTINGS');
      }
    } catch (error) {
      console.error('Error opening WiFi settings:', error);
      Alert.alert('Error', 'Unable to open WiFi settings. Please open them manually.');
    }
  };

  const renderWiFiForm = () => (
    <View style={styles.formContainer}>
      <TextInput
        style={[styles.input, { 
          backgroundColor: theme.cardBackground,
          color: theme.text,
          borderColor: theme.border
        }]}
        placeholder="WiFi Network Name"
        placeholderTextColor={theme.textSecondary}
        value={homeWifiSSID}
        onChangeText={setHomeWifiSSID}
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, { 
          backgroundColor: theme.cardBackground,
          color: theme.text,
          borderColor: theme.border
        }]}
        placeholder="WiFi Password"
        placeholderTextColor={theme.textSecondary}
        value={homeWifiPassword}
        onChangeText={setHomeWifiPassword}
        secureTextEntry
        autoCapitalize="none"
      />
    </View>
  );

  const renderStep = (step, index) => {
    const isActive = index === currentStep;
    const isCompleted = index < currentStep;
    const buttonEnabled = isActive && (
      index === 0 ? (homeWifiSSID && homeWifiPassword) :
      index === 1 ? !isConfiguring :
      index === 2 ? !isVerifying :
      true
    );

    return (
      <View key={index} style={styles.stepContainer}>
        <View style={styles.stepHeader}>
          <View style={[
            styles.stepNumber,
            isActive && { backgroundColor: theme.primary },
            isCompleted && { backgroundColor: theme.success }
          ]}>
            <MaterialIcons
              name={step.icon}
              size={24}
              color={isActive || isCompleted ? '#FFF' : theme.text}
            />
          </View>
          <Text style={[styles.stepTitle, { color: theme.text }]}>{step.title}</Text>
        </View>
        
        <Text style={[styles.stepDescription, { color: theme.textSecondary }]}>
          {step.description}
        </Text>

        {index === 0 && isActive && renderWiFiForm()}

        <TouchableOpacity
          style={[
            styles.actionButton,
            { backgroundColor: theme.primary },
            !buttonEnabled && { opacity: 0.5 }
          ]}
          onPress={() => handleStepAction(index)}
          disabled={!buttonEnabled}
        >
          {(isConfiguring && index === 1) || (isVerifying && index === 2) ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.actionButtonText}>{step.action}</Text>
          )}
        </TouchableOpacity>

        {index < steps.length - 1 && (
          <View style={[styles.stepConnector, { backgroundColor: theme.border }]} />
        )}
      </View>
    );
  };

  const handleConfigureDevice = async () => {
    try {
      setIsConfiguring(true);
      setError(null);

      // Get device info first
      const deviceInfoResponse = await fetch(`http://${ESP32_IP}/getDeviceInfo`);
      if (!deviceInfoResponse.ok) {
        throw new Error('Failed to get device information');
      }
      const deviceInfo = await deviceInfoResponse.json();

      // Configure WiFi
      const response = await fetch(`http://${ESP32_IP}/wifi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ssid: homeWifiSSID,
          password: homeWifiPassword,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to configure device');
      }

      const result = await response.json();
      
      if (result.success) {
        // Create new device entry
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User document not found');
        }

        const userData = userDoc.data();
        const currentDevices = userData.settings?.devices || [];

        // Check if device already exists
        const existingDeviceIndex = currentDevices.findIndex(
          d => d.macAddress === deviceInfo.macAddress
        );

        const newDevice = {
          id: deviceInfo.macAddress,
          name: deviceInfo.name || `AquaSweeper-${deviceInfo.macAddress.slice(-4)}`,
          macAddress: deviceInfo.macAddress,
          ipAddress: deviceInfo.ipAddress,
          isConnected: true,
          lastSeen: new Date().toISOString(),
          dateAdded: new Date().toISOString()
        };

        let updatedDevices;
        if (existingDeviceIndex >= 0) {
          // Update existing device
          updatedDevices = [...currentDevices];
          updatedDevices[existingDeviceIndex] = {
            ...updatedDevices[existingDeviceIndex],
            ...newDevice
          };
        } else {
          // Add new device
          updatedDevices = [...currentDevices, newDevice];
        }

        await updateDoc(userRef, {
          'settings.devices': updatedDevices
        });

        navigation.navigate('DeviceDetails', { 
          device: newDevice,
          userId: user.uid 
        });
      } else {
        throw new Error('Device configuration failed');
      }
    } catch (error) {
      console.error('Error configuring device:', error);
      setError('Failed to configure device. Please try again.');
    } finally {
      setIsConfiguring(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={[styles.header, { color: theme.text }]}>
          Device Setup
        </Text>
        
        <Text style={[styles.subheader, { color: theme.textSecondary }]}>
          Follow these steps to connect your AquaSweeper device
        </Text>

        {steps.map(renderStep)}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subheader: {
    fontSize: 16,
    marginBottom: 32,
  },
  stepContainer: {
    marginBottom: 24,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E1E1E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 52,
    marginBottom: 16,
  },
  actionButton: {
    marginLeft: 52,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  stepConnector: {
    width: 2,
    height: 24,
    position: 'absolute',
    left: 19,
    top: 50,
  },
  formContainer: {
    marginLeft: 52,
    marginBottom: 16,
    width: '80%',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  }
});

export default DevicePairingScreen;
