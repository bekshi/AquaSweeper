import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../services/ThemeContext';
import WifiManager from 'react-native-wifi-reborn';

const ScanDevicesScreen = () => {
  const { theme } = useTheme();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [ipAddress, setIpAddress] = useState('192.168.4.1');

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to location to scan for ESP32 devices.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const startScan = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Location permission is required to scan for ESP32 devices.');
        return;
      }

      setScanning(true);
      setDevices([]);

      // Scan for WiFi networks
      const wifiList = await WifiManager.loadWifiList();
      
      // Filter for ESP32 devices (they usually have SSIDs starting with "ESP32")
      const espDevices = wifiList
        .filter(wifi => wifi.SSID.toLowerCase().includes('esp32'))
        .map(wifi => ({
          id: wifi.BSSID,
          name: wifi.SSID,
          rssi: wifi.level,
          capabilities: wifi.capabilities
        }));

      setDevices(espDevices);
    } catch (error) {
      Alert.alert('Scan Error', error.message || 'Failed to scan for devices');
      console.error('Scan error:', error);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    startScan();
  }, []);

  const connectToDevice = async (device) => {
    try {
      setScanning(true);
      
      // Connect to the ESP32's WiFi network
      // Note: You might need to handle the case where a password is required
      await WifiManager.connectToProtectedSSID(device.name, '', false);
      
      Alert.alert('Success', `Connected to ${device.name}`);
      
      // After connecting to the ESP32's WiFi, you can communicate with it
      // using its local IP address (typically 192.168.4.1)
      // You'll need to implement the specific communication protocol here
      
    } catch (error) {
      Alert.alert('Connection Error', error.message || 'Failed to connect to device');
      console.error('Connection error:', error);
    } finally {
      setScanning(false);
    }
  };

  const connectToIp = async () => {
    try {
      setConnecting(true);
      
      // Validate IP address format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(ipAddress)) {
        Alert.alert('Invalid IP', 'Please enter a valid IP address');
        return;
      }

      // Try to connect to the ESP32's web server
      const response = await fetch(`http://${ipAddress}/status`, {
        method: 'GET',
        timeout: 5000, // 5 second timeout
      });

      if (response.ok) {
        Alert.alert('Success', 'Connected to ESP32 device');
      } else {
        Alert.alert('Connection Failed', 'Could not connect to ESP32 device');
      }
    } catch (error) {
      Alert.alert(
        'Connection Error',
        'Make sure you are connected to the ESP32\'s WiFi network and the IP address is correct'
      );
      console.error('Connection error:', error);
    } finally {
      setConnecting(false);
    }
  };

  const renderDevice = ({ item }) => (
    <TouchableOpacity
      style={[styles.deviceItem, { backgroundColor: theme.cardBackground }]}
      onPress={() => connectToDevice(item)}>
      <View style={styles.deviceInfo}>
        <MaterialCommunityIcons 
          name="wifi" 
          size={24} 
          color={theme.primary} 
        />
        <View style={styles.deviceDetails}>
          <Text style={[styles.deviceName, { color: theme.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.signalStrength, { color: theme.textSecondary }]}>
            Signal Strength: {item.rssi} dBm
          </Text>
        </View>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={24}
        color={theme.textSecondary}
      />
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {scanning ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.scanningText, { color: theme.textSecondary }]}>
            Scanning for devices...
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={devices}
            renderItem={renderDevice}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
          />
          <TouchableOpacity
            style={[styles.scanButton, { backgroundColor: theme.primary }]}
            onPress={startScan}>
            <Text style={styles.scanButtonText}>Scan Again</Text>
          </TouchableOpacity>
          <View style={styles.instructionContainer}>
            <Text style={[styles.instructionTitle, { color: theme.text }]}>
              Connect to ESP32 Device via IP
            </Text>
            <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
              1. Connect to your ESP32's WiFi network in your device settings{'\n'}
              2. Enter the ESP32's IP address (default is 192.168.4.1){'\n'}
              3. Tap Connect to establish connection
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <MaterialCommunityIcons 
              name="ip-network" 
              size={24} 
              color={theme.primary} 
              style={styles.inputIcon}
            />
            <TextInput
              style={[
                styles.input,
                { 
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.cardBackground
                }
              ]}
              value={ipAddress}
              onChangeText={setIpAddress}
              placeholder="ESP32 IP Address"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity
            style={[styles.connectButton, { backgroundColor: theme.primary }]}
            onPress={connectToIp}
            disabled={connecting}>
            <Text style={styles.connectButtonText}>
              {connecting ? 'Connecting...' : 'Connect'}
            </Text>
          </TouchableOpacity>

          <View style={styles.helpContainer}>
            <Text style={[styles.helpTitle, { color: theme.text }]}>
              Having trouble connecting?
            </Text>
            <Text style={[styles.helpText, { color: theme.textSecondary }]}>
              • Make sure you're connected to the ESP32's WiFi network{'\n'}
              • The default IP is usually 192.168.4.1{'\n'}
              • Check if the ESP32 is powered on and in range{'\n'}
              • Try restarting the ESP32 if connection fails
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningText: {
    marginTop: 16,
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceDetails: {
    marginLeft: 12,
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  signalStrength: {
    fontSize: 14,
    marginTop: 4,
  },
  scanButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionContainer: {
    marginBottom: 24,
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  connectButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpContainer: {
    padding: 16,
    borderRadius: 8,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    lineHeight: 22,
  },
});

export default ScanDevicesScreen;
