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
  const [step, setStep] = useState('connect'); // 'connect' or 'configure'
  const [connecting, setConnecting] = useState(false);
  const [wifiCredentials, setWifiCredentials] = useState({
    ssid: '',
    password: '',
  });

  const connectToEsp = async () => {
    try {
      setConnecting(true);
      
      // Try to connect to the ESP32's default IP
      const response = await fetch('http://192.168.4.1/connect', {
        method: 'GET',
        timeout: 5000,
      });

      if (response.ok) {
        Alert.alert(
          'Connected',
          'Successfully connected to ESP32. Now you can configure its WiFi settings.',
          [{ text: 'OK', onPress: () => setStep('configure') }]
        );
      } else {
        Alert.alert(
          'Connection Failed',
          'Could not connect to ESP32. Make sure you are connected to the ESP32\'s WiFi network (usually named "ESP32-XXXX")'
        );
      }
    } catch (error) {
      Alert.alert(
        'Connection Error',
        'Make sure you are connected to the ESP32\'s WiFi network and try again'
      );
      console.error('Connection error:', error);
    } finally {
      setConnecting(false);
    }
  };

  const configureWifi = async () => {
    try {
      setConnecting(true);

      if (!wifiCredentials.ssid || !wifiCredentials.password) {
        Alert.alert('Error', 'Please enter both WiFi name and password');
        return;
      }

      // Send WiFi credentials to ESP32
      const response = await fetch('http://192.168.4.1/configure-wifi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(wifiCredentials),
        timeout: 5000,
      });

      if (response.ok) {
        Alert.alert(
          'Success',
          'WiFi credentials sent to ESP32. The device will now connect to your WiFi network.',
          [{ text: 'OK', onPress: () => setStep('connect') }]
        );
      } else {
        Alert.alert('Error', 'Failed to send WiFi credentials to ESP32');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to configure WiFi. Please try again.');
      console.error('Configure error:', error);
    } finally {
      setConnecting(false);
    }
  };

  const renderConnectStep = () => (
    <>
      <View style={styles.instructionContainer}>
        <Text style={[styles.instructionTitle, { color: theme.text }]}>
          Connect to ESP32
        </Text>
        <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
          1. Go to your device's WiFi settings{'\n'}
          2. Connect to the ESP32's WiFi network (usually named "ESP32-XXXX"){'\n'}
          3. Return to this app and tap "Connect to ESP32"
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={connectToEsp}
        disabled={connecting}>
        <Text style={styles.buttonText}>
          {connecting ? 'Connecting...' : 'Connect to ESP32'}
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderConfigureStep = () => (
    <>
      <View style={styles.instructionContainer}>
        <Text style={[styles.instructionTitle, { color: theme.text }]}>
          Configure WiFi
        </Text>
        <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
          Enter your WiFi network details below. The ESP32 will connect to this network.
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <MaterialCommunityIcons 
          name="wifi" 
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
          value={wifiCredentials.ssid}
          onChangeText={(text) => setWifiCredentials(prev => ({ ...prev, ssid: text }))}
          placeholder="WiFi Name (SSID)"
          placeholderTextColor={theme.textSecondary}
        />
      </View>

      <View style={styles.inputContainer}>
        <MaterialCommunityIcons 
          name="key" 
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
          value={wifiCredentials.password}
          onChangeText={(text) => setWifiCredentials(prev => ({ ...prev, password: text }))}
          placeholder="WiFi Password"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
        />
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={configureWifi}
        disabled={connecting}>
        <Text style={styles.buttonText}>
          {connecting ? 'Configuring...' : 'Configure WiFi'}
        </Text>
      </TouchableOpacity>
    </>
  );

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {step === 'connect' ? renderConnectStep() : renderConfigureStep()}

      <View style={styles.helpContainer}>
        <Text style={[styles.helpTitle, { color: theme.text }]}>
          Having trouble?
        </Text>
        <Text style={[styles.helpText, { color: theme.textSecondary }]}>
          {step === 'connect' ? (
            <>
              • Make sure the ESP32 is powered on{'\n'}
              • Look for a WiFi network named "ESP32-XXXX"{'\n'}
              • The ESP32's WiFi has no password by default{'\n'}
              • Try restarting the ESP32 if you can't find its network
            </>
          ) : (
            <>
              • Enter the exact WiFi name and password{'\n'}
              • The WiFi network must be 2.4GHz (not 5GHz){'\n'}
              • Stay close to the ESP32 during configuration{'\n'}
              • Make sure you remain connected to ESP32's WiFi
            </>
          )}
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
    marginBottom: 16,
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
  button: {
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
