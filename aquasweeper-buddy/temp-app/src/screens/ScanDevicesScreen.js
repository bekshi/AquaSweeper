import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../services/ThemeContext';

const ScanDevicesScreen = () => {
  const { theme } = useTheme();
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [ipRange, setIpRange] = useState('192.168.1');
  const [foundDevices, setFoundDevices] = useState([]);

  const scanNetwork = async () => {
    try {
      setScanning(true);
      setFoundDevices([]);
      
      // We'll scan the last octet of the IP range (1-254)
      const promises = [];
      for (let i = 1; i <= 254; i++) {
        const ip = `${ipRange}.${i}`;
        promises.push(
          fetch(`http://${ip}/status`, {
            method: 'GET',
            timeout: 500, // Short timeout for quick scanning
          }).then(response => {
            if (response.ok) {
              return { ip, name: `ESP32 at ${ip}` };
            }
          }).catch(() => null)
        );
      }

      // Wait for all scan attempts to complete
      const results = await Promise.all(promises);
      const devices = results.filter(result => result !== null);
      
      setFoundDevices(devices);
      
      if (devices.length === 0) {
        Alert.alert(
          'No Devices Found',
          'Make sure your ESP32 and phone are on the same WiFi network'
        );
      }
    } catch (error) {
      Alert.alert('Scan Error', error.message);
      console.error('Scan error:', error);
    } finally {
      setScanning(false);
    }
  };

  const connectToDevice = async (device) => {
    try {
      setConnecting(true);
      
      // Try to connect to the ESP32's web server
      const response = await fetch(`http://${device.ip}/connect`, {
        method: 'GET',
        timeout: 5000,
      });

      if (response.ok) {
        Alert.alert('Success', `Connected to ESP32 at ${device.ip}`);
      } else {
        Alert.alert('Connection Failed', 'Could not connect to ESP32 device');
      }
    } catch (error) {
      Alert.alert('Connection Error', error.message);
      console.error('Connection error:', error);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.instructionContainer}>
        <Text style={[styles.instructionTitle, { color: theme.text }]}>
          Connect to ESP32 Device
        </Text>
        <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
          1. Make sure your ESP32 is connected to your WiFi network{'\n'}
          2. Connect your phone to the same WiFi network{'\n'}
          3. Enter your network's IP range (e.g., 192.168.1){'\n'}
          4. Tap Scan to find ESP32 devices
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
          value={ipRange}
          onChangeText={setIpRange}
          placeholder="Network IP Range (e.g., 192.168.1)"
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <TouchableOpacity
        style={[styles.scanButton, { backgroundColor: theme.primary }]}
        onPress={scanNetwork}
        disabled={scanning}>
        <Text style={styles.buttonText}>
          {scanning ? 'Scanning...' : 'Scan Network'}
        </Text>
      </TouchableOpacity>

      {scanning && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Scanning network for ESP32 devices...
          </Text>
        </View>
      )}

      {foundDevices.length > 0 && (
        <View style={styles.devicesContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Found Devices
          </Text>
          {foundDevices.map((device, index) => (
            <TouchableOpacity
              key={device.ip}
              style={[
                styles.deviceItem,
                { backgroundColor: theme.cardBackground },
                index === foundDevices.length - 1 && styles.lastDevice
              ]}
              onPress={() => connectToDevice(device)}
              disabled={connecting}>
              <View style={styles.deviceInfo}>
                <MaterialCommunityIcons 
                  name="access-point"
                  size={24}
                  color={theme.primary}
                />
                <View style={styles.deviceDetails}>
                  <Text style={[styles.deviceName, { color: theme.text }]}>
                    {device.name}
                  </Text>
                  <Text style={[styles.deviceIp, { color: theme.textSecondary }]}>
                    IP: {device.ip}
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.helpContainer}>
        <Text style={[styles.helpTitle, { color: theme.text }]}>
          Having trouble connecting?
        </Text>
        <Text style={[styles.helpText, { color: theme.textSecondary }]}>
          • Ensure both devices are on the same WiFi network{'\n'}
          • Check if the ESP32 is powered on{'\n'}
          • Verify the network IP range (check your WiFi settings){'\n'}
          • Try restarting the ESP32 if connection fails
        </Text>
      </View>
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
  scanButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  devicesContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  lastDevice: {
    marginBottom: 0,
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
  deviceIp: {
    fontSize: 14,
    marginTop: 4,
  },
  helpContainer: {
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
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
