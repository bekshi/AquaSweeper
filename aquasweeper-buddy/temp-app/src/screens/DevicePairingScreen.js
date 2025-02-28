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
      
      const response = await fetch(`http://${DEVICE_IP}/discover`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        cache: 'no-store',
        mode: 'cors',
        credentials: 'omit',
        timeout: 3000 // 3 second timeout
      });

      console.log('Device response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      console.log('Raw response:', text);

      let data;
      try {
        data = JSON.parse(text);
        console.log('Parsed device response:', data);
      } catch (e) {
        console.error('JSON parse error:', e);
        throw new Error('Invalid response format');
      }

      if (!data.type || data.type !== 'AquaSweeper') {
        throw new Error('Not an AquaSweeper device');
      }

      setConnectedToAquaSweeper(true);
      setDeviceStatus(data);
      setCurrentStep(1);
      return true;

    } catch (error) {
      console.error('Validation error:', error.message);
      setConnectionError(
        'Could not connect to AquaSweeper device. Please ensure you are connected to the device\'s WiFi network.'
      );
      setConnectedToAquaSweeper(false);
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
    try {
      // Get device info first while we know we're connected
      const deviceInfo = await getDeviceInfo();
      
      // Then configure WiFi
      const response = await fetch(`http://${DEVICE_IP}/wifi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          ssid: homeWifiSSID, 
          password: homeWifiPassword 
        }),
        timeout: 5000 // 5 second timeout
      });

      if (!response.ok) {
        throw new Error('Failed to configure WiFi');
      }

      const data = await response.json();
      if (data.success) {
        // Save device info to Firestore
        const saved = await saveDeviceToFirestore(deviceInfo);
        if (!saved) {
          throw new Error('Failed to save device info');
        }

        setCurrentStep(2);
        Alert.alert(
          'Success',
          'Device configured successfully. Please reconnect to your home network to complete the setup.',
          [{ 
            text: 'Open WiFi Settings',
            onPress: openWiFiSettings
          }]
        );
      } else {
        throw new Error(data.message || 'Configuration failed');
      }
    } catch (error) {
      console.error('Configuration error:', error);
      setConnectionError('Failed to configure device: ' + error.message);
    } finally {
      setIsConfiguring(false);
    }
  };

  const verifyHomeNetworkConnection = async () => {
    setIsVerifying(true);
    try {
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
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert(
        'Connection Error',
        error.message,
        [
          {
            text: 'Try Again',
            onPress: () => verifyHomeNetworkConnection()
          }
        ]
      );
    } finally {
      setIsVerifying(false);
    }
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
          setIsConfiguring(true);
          try {
            const response = await fetch(`http://${DEVICE_IP}/wifi`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                ssid: homeWifiSSID, 
                password: homeWifiPassword 
              }),
              timeout: 5000 // 5 second timeout
            });

            if (!response.ok) {
              throw new Error('Failed to configure WiFi');
            }

            const data = await response.json();
            if (data.success) {
              try {
                // Get device info before it disconnects
                const deviceInfo = await getDeviceInfo();
                
                // Save device info to Firestore
                const saved = await saveDeviceToFirestore(deviceInfo);
                if (!saved) {
                  throw new Error('Failed to save device info');
                }

                setCurrentStep(2);
                Alert.alert(
                  'Success',
                  'Device configured successfully. Please reconnect to your home network to complete the setup.',
                  [{ 
                    text: 'Open WiFi Settings',
                    onPress: openWiFiSettings
                  }]
                );
              } catch (error) {
                console.error('Error in final setup:', error);
                setConnectionError('Device configured but failed to save device info. Please try again.');
              }
            } else {
              throw new Error(data.message || 'Configuration failed');
            }
          } catch (error) {
            console.error('Configuration error:', error);
            setConnectionError('Failed to configure device: ' + error.message);
          } finally {
            setIsConfiguring(false);
          }
        }
        break;

      case 2: // Verify home network connection
        setIsVerifying(true);
        try {
          // If we have device info, connect to it via DeviceContext
          if (deviceInfo) {
            const deviceData = {
              deviceId: `${deviceInfo.mac.replace(/:/g, '')}_${Date.now()}`,
              ipAddress: deviceInfo.ip,
              macAddress: deviceInfo.mac,
              name: deviceInfo.name || `AquaSweeper-${deviceInfo.mac.slice(-6)}`
            };
            
            // Connect to the device using DeviceContext
            connectToDevice(deviceData);
          }
          
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
        } catch (error) {
          console.error('Verification error:', error);
          Alert.alert(
            'Connection Error',
            error.message,
            [
              {
                text: 'Try Again',
                onPress: () => handleStepAction(2)
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
      if (!user || !user.uid) {
        throw new Error('User not authenticated');
      }

      console.log('Saving device to Firestore:', deviceInfo);
      
      // Create a unique device ID from MAC address
      const cleanMac = deviceInfo.mac.replace(/:/g, '');
      const deviceId = cleanMac.slice(-6); // Use last 6 characters of MAC
      
      // Get a reference to the user document
      const userRef = doc(db, 'users', user.uid);
      
      // Get the user document to check if it exists
      const userDoc = await getDoc(userRef);
      
      // Prepare the device data
      const deviceData = {
        id: deviceId,
        deviceId: deviceId,
        ipAddress: deviceInfo.ip,
        macAddress: deviceInfo.mac,
        name: `AquaSweeper-${deviceId}`,
        addedAt: new Date().toISOString(),
        status: 'online',
        state: 'stopped'
      };
      
      console.log('Prepared device data:', deviceData);
      
      if (userDoc.exists()) {
        // Update the existing user document with connectedDevices array
        await updateDoc(userRef, {
          connectedDevices: arrayUnion(deviceData)
        });
        console.log('Updated existing user document with device');
      } else {
        // Create a new user document with connectedDevices array
        await setDoc(userRef, {
          email: user.email,
          connectedDevices: [deviceData]
        });
        console.log('Created new user document with device');
      }
      
      // Save device to context
      connectToDevice(deviceData);
      
      return true;
    } catch (error) {
      console.error('Error saving device to Firestore:', error);
      return false;
    }
  };

  const getDeviceInfo = async () => {
    try {
      const response = await fetch(`http://${DEVICE_IP}/info`, {
        timeout: 5000 // 5 second timeout
      });
      if (!response.ok) {
        throw new Error('Failed to get device info');
      }
      const data = await response.json();
      setDeviceInfo(data); // Store the device info in state
      return data;
    } catch (error) {
      console.error('Error getting device info:', error);
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
  settingsButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  settingsButtonText: {
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  spinner: {
    marginLeft: 8,
  },
});

export default DevicePairingScreen;
