import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useDevice } from '../services/DeviceContext';
import { useAuth } from '../services/AuthContext';
import { collection, addDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

// Pulsing Status Indicator Component
const PulsingStatusIndicator = ({ status }) => {
  const pulseAnim = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#4CAF50'; // Green
      case 'reconnecting':
        return '#FFA500'; // Amber
      case 'disconnected':
        return '#FF3B30'; // Red
      default:
        return '#808080'; // Gray
    }
  };

  return (
    <Animated.View
      style={[
        styles.statusDot,
        {
          backgroundColor: getStatusColor(),
          opacity: pulseAnim,
        }
      ]}
    />
  );
};

// Device Connection Status Component
const DeviceConnectionStatus = () => {
  const { theme } = useTheme();
  const { 
    currentDevice, 
    setDeviceState, 
    setBatteryLevel, 
    setIsConnected,
    deviceState: currentDeviceState,
    elapsedTime
  } = useDevice();
  const [deviceStatus, setDeviceStatus] = useState('disconnected');
  const [lastPing, setLastPing] = useState(null);
  const lastDeviceState = useRef(null);
  const wasConnected = useRef(false);
  const reconnectionCount = useRef(0);

  // Store the current device state for reconnection
  useEffect(() => {
    if (currentDeviceState) {
      lastDeviceState.current = currentDeviceState;
      console.log('DeviceConnectionStatus - Stored last device state:', lastDeviceState.current);
    }
  }, [currentDeviceState]);

  // Check device connection status
  useEffect(() => {
    if (!currentDevice?.ipAddress) {
      console.log('DeviceConnectionStatus - No device IP available');
      setDeviceStatus('disconnected');
      setIsConnected(false);
      return;
    }

    const checkConnection = async () => {
      try {
        console.log('DeviceConnectionStatus - Checking connection to:', currentDevice.ipAddress);
        
        const fetchWithTimeout = async (url, options = {}, timeout = 3000) => {
          try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, {
              ...options,
              signal: controller.signal,
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
            
            clearTimeout(id);
            return response;
          } catch (error) {
            if (error.name === 'AbortError') {
              console.log('DeviceConnectionStatus - Fetch request timed out');
            }
            throw error;
          }
        };
        
        // Try to connect to the device using status endpoint
        const response = await fetchWithTimeout(
          `http://${currentDevice.ipAddress}/status?nocache=${Date.now()}`, 
          {}, 
          3000
        );
        
        if (response.ok) {
          // Parse the response to get device state and battery level
          try {
            const data = await response.json();
            console.log('DeviceConnectionStatus - Status data:', data);
            
            // Check if this is a reconnection
            const isReconnection = !wasConnected.current;
            
            if (isReconnection) {
              reconnectionCount.current += 1;
              console.log('DeviceConnectionStatus - Reconnection detected #', reconnectionCount.current);
              
              // If this is a reconnection and we had a previous state that was running or paused,
              // keep that state instead of taking the one from the device
              if (lastDeviceState.current && 
                  (lastDeviceState.current === 'running' || lastDeviceState.current === 'paused')) {
                console.log('DeviceConnectionStatus - Reconnected, preserving previous state:', 
                  lastDeviceState.current, 'instead of device state:', data.operatingState);
                
                // Force the device to match our state
                setDeviceState(lastDeviceState.current);
                
                // Send a command to the device to match our state
                setTimeout(async () => {
                  try {
                    if (lastDeviceState.current === 'running' && data.operatingState !== 'running') {
                      console.log('DeviceConnectionStatus - Sending start command to match our state');
                      const startUrl = `http://${currentDevice.ipAddress}/control`;
                      await fetch(startUrl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Cache-Control': 'no-cache',
                          'Pragma': 'no-cache'
                        },
                        body: JSON.stringify({ numericCommand: 1 }) // 1 = start
                      });
                    } else if (lastDeviceState.current === 'paused' && data.operatingState !== 'paused') {
                      console.log('DeviceConnectionStatus - Sending pause command to match our state');
                      const pauseUrl = `http://${currentDevice.ipAddress}/control`;
                      await fetch(pauseUrl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Cache-Control': 'no-cache',
                          'Pragma': 'no-cache'
                        },
                        body: JSON.stringify({ numericCommand: 2 }) // 2 = pause
                      });
                    }
                  } catch (error) {
                    console.error('DeviceConnectionStatus - Error syncing device state:', error);
                  }
                }, 1000);
              } else {
                // Otherwise, take the state from the device
                console.log('DeviceConnectionStatus - Setting device state to:', data.operatingState);
                if (data.operatingState) {
                  setDeviceState(data.operatingState);
                  lastDeviceState.current = data.operatingState;
                }
              }
            } else {
              // Normal connection, just update the state if it's different
              if (data.operatingState && data.operatingState !== currentDeviceState) {
                console.log('DeviceConnectionStatus - Updating device state from:', 
                  currentDeviceState, 'to:', data.operatingState);
                setDeviceState(data.operatingState);
                lastDeviceState.current = data.operatingState;
              }
            }
            
            // Update battery level in context if available
            if (data.batteryLevel !== undefined) {
              setBatteryLevel(data.batteryLevel);
            }
            
            wasConnected.current = true;
          } catch (error) {
            console.error('DeviceConnectionStatus - Error parsing status response:', error);
          }
          
          setDeviceStatus('connected');
          setIsConnected(true);
          setLastPing(Date.now());
        } else {
          console.log('DeviceConnectionStatus - Device not responding');
          const newStatus = lastPing && Date.now() - lastPing < 10000 ? 'reconnecting' : 'disconnected';
          setDeviceStatus(newStatus);
          setIsConnected(false);
          wasConnected.current = false;
          
          // We don't update the device state here, so the timer can continue if it was running
          // This preserves the UI state even when connection is lost
        }
      } catch (error) {
        console.log('DeviceConnectionStatus - Connection error:', error.message);
        const newStatus = lastPing && Date.now() - lastPing < 10000 ? 'reconnecting' : 'disconnected';
        setDeviceStatus(newStatus);
        setIsConnected(false);
        wasConnected.current = false;
        
        // We don't update the device state here, so the timer can continue if it was running
        // This preserves the UI state even when connection is lost
      }
    };

    // Check immediately
    checkConnection();

    // Then check every 5 seconds
    const interval = setInterval(checkConnection, 5000);

    return () => clearInterval(interval);
  }, [currentDevice?.ipAddress, lastPing, setDeviceState, setBatteryLevel, setIsConnected, currentDeviceState]);

  return (
    <View style={styles.connectionStatus}>
      <PulsingStatusIndicator status={deviceStatus} />
      <Text style={[styles.statusText, { color: theme.text }]}>
        {deviceStatus === 'connected' ? 'Connected' : deviceStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
      </Text>
    </View>
  );
};

const HomeScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { 
    currentDevice, 
    deviceState, 
    batteryLevel, 
    startDevice, 
    stopDevice, 
    pauseDevice,
    isConnected,
    elapsedTime
  } = useDevice();

  const [sessionStartTime, setSessionStartTime] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Debug logs for device state
  useEffect(() => {
    console.log('HomeScreen - Device State:', {
      deviceState,
      currentDevice: currentDevice ? {
        id: currentDevice.id,
        name: currentDevice.name,
        ipAddress: currentDevice.ipAddress
      } : null,
      batteryLevel,
      elapsedTime
    });
  }, [deviceState, currentDevice, batteryLevel, elapsedTime]);

  // Start or stop the pulse animation based on device state
  useEffect(() => {
    console.log('Device state changed:', deviceState);
    
    // Start or stop the animation based on device state
    if (deviceState === 'running') {
      console.log('Starting pulse animation because device is running');
      startPulseAnimation();
    } else {
      console.log('Stopping pulse animation because device is not running');
      pulseAnim.setValue(1);
    }
  }, [deviceState]);

  // Separate effect to handle connection status changes
  useEffect(() => {
    // Log connection status changes
    console.log('Connection status changed:', isConnected ? 'Connected' : 'Disconnected');
    console.log('Current device state:', deviceState);
  }, [isConnected]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const logCleaningSession = async () => {
    if (!user || !currentDevice) return;
    
    try {
      console.log('Logging cleaning session with duration:', elapsedTime);
      const sessionData = {
        userId: user.uid,
        deviceId: currentDevice.id || currentDevice.deviceId,
        deviceName: currentDevice.name,
        startTime: sessionStartTime,
        endTime: new Date(),
        durationSeconds: elapsedTime,
        timestamp: new Date()
      };
      
      const userSessionsRef = collection(db, 'users', user.uid, 'cleaningSessions');
      await addDoc(userSessionsRef, sessionData);
      console.log('Cleaning session logged successfully');
    } catch (error) {
      console.error('Error logging cleaning session:', error);
    }
  };

  const handleStartPress = async () => {
    if (!isConnected) {
      Alert.alert('Device Disconnected', 'Cannot start device while disconnected.');
      return;
    }
    
    if (deviceState === 'running') {
      Alert.alert('Device Already Running', 'The device is already running.');
      return;
    }
    
    console.log('Sending start command to device');
    const success = await startDevice();
    
    if (success) {
      console.log('Device started successfully');
      // If we're starting from a paused state, don't reset the session start time
      if (!sessionStartTime) {
        setSessionStartTime(new Date());
      }
    } else {
      console.log('Failed to start device');
      Alert.alert('Error', 'Failed to start device. Please try again.');
    }
  };

  const handleStopPress = async () => {
    if (!isConnected) {
      Alert.alert('Device Disconnected', 'Cannot stop device while disconnected.');
      return;
    }
    
    if (deviceState === 'stopped') {
      Alert.alert('Device Already Stopped', 'The device is already stopped.');
      return;
    }
    
    console.log('Sending stop command to device');
    const success = await stopDevice();
    
    if (success) {
      console.log('Device stopped successfully');
      
      // Log the cleaning session before resetting the timer
      if (sessionStartTime) {
        logCleaningSession();
      }
      Alert.alert('Run Completed', 'Your cleaning session has been logged.', [{ text: 'OK' }]);
    } else {
      console.log('Failed to stop device');
      Alert.alert('Error', 'Failed to stop device. Please try again.');
    }
  };

  const handlePausePress = async () => {
    if (!isConnected) {
      Alert.alert('Device Disconnected', 'Cannot pause device while disconnected.');
      return;
    }
    
    if (deviceState !== 'running') {
      Alert.alert('Device Not Running', 'Cannot pause device that is not running.');
      return;
    }
    
    console.log('Sending pause command to device');
    const success = await pauseDevice();
    
    if (success) {
      console.log('Device paused successfully');
    } else {
      console.log('Failed to pause device');
      Alert.alert('Error', 'Failed to pause device. Please try again.');
    }
  };

  const handleResumePress = async () => {
    if (!isConnected) {
      Alert.alert('Device Disconnected', 'Cannot resume device while disconnected.');
      return;
    }
    
    if (deviceState !== 'paused') {
      Alert.alert('Device Not Paused', 'Cannot resume device that is not paused.');
      return;
    }
    
    console.log('Sending resume command to device');
    const success = await startDevice();
    
    if (success) {
      console.log('Device resumed successfully');
    } else {
      console.log('Failed to resume device');
      Alert.alert('Error', 'Failed to resume device. Please try again.');
    }
  };

  const handleToggleRun = () => {
    if (!currentDevice) {
      Alert.alert('Not Connected', 'Please connect to your AquaSweeper device first.');
      return;
    }

    if (!isConnected) {
      Alert.alert(
        "Device Disconnected",
        "Cannot control device because it is currently disconnected. Please wait for the device to reconnect.",
        [{ text: "OK" }]
      );
      return;
    }

    if (deviceState === 'running') {
      handlePausePress();
    } else {
      handleStartPress();
    }
  };

  const handleEndRun = () => {
    if (!currentDevice) {
      Alert.alert('Not Connected', 'Please connect to your AquaSweeper device first.');
      return;
    }

    if (!isConnected) {
      Alert.alert(
        "Device Disconnected",
        "Cannot stop device because it is currently disconnected. Please wait for the device to reconnect.",
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "End Run",
      "Are you sure you want to end the current run?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Yes",
          onPress: () => handleStopPress()
        }
      ]
    );
  };

  useEffect(() => {
    if (deviceState === 'running' && !sessionStartTime) {
      setSessionStartTime(new Date());
    } else if (deviceState !== 'running' && deviceState !== 'paused') {
      setSessionStartTime(null);
    }
  }, [deviceState]);

  useEffect(() => {
    const fetchDeviceInfo = async () => {
      if (!currentDevice?.ipAddress) return;
      
      try {
        console.log('Fetching device info from:', currentDevice.ipAddress);
        const response = await fetch(`http://${currentDevice.ipAddress}/info?nocache=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Device info received:', data);
          // This will help debugging what fields are available
        }
      } catch (error) {
        console.error('Error fetching device info:', error);
      }
    };
    
    fetchDeviceInfo();
  }, [currentDevice?.ipAddress]);

  useEffect(() => {
    if (currentDevice) {
      console.log('======= CURRENT DEVICE DETAILS =======');
      console.log('Device ID:', currentDevice.id || currentDevice.deviceId);
      console.log('Device Name:', currentDevice.name);
      console.log('Device IP Address:', currentDevice.ipAddress);
      console.log('Device Keys:', Object.keys(currentDevice));
      console.log('======================================');
    } else {
      console.log('No current device available');
    }
  }, [currentDevice]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {/* Status Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="robot" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {currentDevice ? (currentDevice.name || `AquaSweeper-${currentDevice.id || ''}`) : 'AquaSweeper'} Status
            </Text>
          </View>
          
          {/* Connection Status */}
          <DeviceConnectionStatus />
          
          {/* Battery and Status */}
          <View style={styles.statusRow}>
            <View style={styles.batteryContainer}>
              <MaterialCommunityIcons 
                name={batteryLevel > 20 ? "battery-high" : "battery-low"} 
                size={24} 
                color={batteryLevel > 20 ? theme.success : theme.error} 
              />
              <Text style={[styles.batteryText, { color: theme.text }]}>
                {batteryLevel !== null ? `${batteryLevel}%` : 'Unknown'}
              </Text>
            </View>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { 
                backgroundColor: deviceState === 'running' 
                  ? theme.success 
                  : deviceState === 'paused' 
                    ? theme.warning
                    : theme.textSecondary 
              }]} />
              <Text style={[styles.statusText, { color: theme.text }]}>
                {deviceState === 'running' ? 'Running' : deviceState === 'paused' ? 'Paused' : 'Stopped'}
              </Text>
            </View>
          </View>

          {/* Timer Display */}
          <View style={styles.timerContainer}>
            <Animated.View style={[styles.timerCircle, 
              { 
                borderColor: deviceState === 'running' 
                  ? theme.success 
                  : deviceState === 'paused' 
                    ? theme.warning
                    : theme.primary,
                transform: [{ scale: deviceState === 'running' ? pulseAnim : 1 }]
              }
            ]}>
              <Text style={[styles.timerText, { color: theme.text }]}>
                {formatTime(elapsedTime)}
              </Text>
              <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>Current Run Time</Text>
            </Animated.View>
          </View>

          {/* Control Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                { 
                  backgroundColor: deviceState === 'running' 
                    ? theme.warning
                    : deviceState === 'paused' 
                      ? theme.success 
                      : theme.primary,
                  opacity: isConnected ? 1 : 0.5
                }
              ]}
              onPress={handleToggleRun}
              disabled={!isConnected}
            >
              <MaterialCommunityIcons
                name={deviceState === 'running' ? "pause" : "play"}
                size={24}
                color="#fff"
              />
              <Text style={styles.buttonText}>
                {deviceState === 'running' ? 'Pause' : deviceState === 'paused' ? 'Resume' : 'Start'}
              </Text>
            </TouchableOpacity>

            {(deviceState === 'running' || deviceState === 'paused' || elapsedTime > 0) && (
              <TouchableOpacity
                style={[
                  styles.button, 
                  { 
                    backgroundColor: theme.error,
                    opacity: isConnected ? 1 : 0.5
                  }
                ]}
                onPress={handleEndRun}
                disabled={!isConnected}
              >
                <MaterialCommunityIcons name="stop" size={24} color="#fff" />
                <Text style={styles.buttonText}>End Run</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  timerLabel: {
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 140,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default HomeScreen;
