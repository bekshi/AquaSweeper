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
const DeviceConnectionStatus = ({ device }) => {
  const { theme } = useTheme();
  const [deviceStatus, setDeviceStatus] = useState('disconnected');
  const [lastPing, setLastPing] = useState(null);

  React.useEffect(() => {
    // Start checking device connection
    const checkConnection = async () => {
      try {
        console.log('Checking connection to device:', device);
        if (!device || !device.ipAddress) {
          console.log('No IP address for device:', device);
          return;
        }
        
        // Simple timeout promise
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
              console.log('Fetch request timed out');
            }
            throw error;
          }
        };
        
        try {
          // Try to connect to the device with a longer timeout
          const response = await fetchWithTimeout(
            `http://${device.ipAddress}/discover?nocache=${Date.now()}`, 
            {}, 
            3000
          );
          
          if (response.ok) {
            setDeviceStatus('connected');
            setLastPing(Date.now());
          } else {
            setDeviceStatus(lastPing && Date.now() - lastPing < 10000 ? 'reconnecting' : 'disconnected');
          }
        } catch (error) {
          console.log('Error checking device connection:', error.name, error.message);
          // If we had a successful ping recently, show reconnecting instead of disconnected
          setDeviceStatus(lastPing && Date.now() - lastPing < 10000 ? 'reconnecting' : 'disconnected');
        }
      } catch (error) {
        console.log('Error in connection check outer block:', error);
        setDeviceStatus('disconnected');
      }
    };

    // Check less frequently to reduce network traffic
    const interval = setInterval(checkConnection, 10000);
    checkConnection(); // Initial check

    return () => clearInterval(interval);
  }, [device?.ipAddress, lastPing]);

  return (
    <View style={styles.connectionStatus}>
      <PulsingStatusIndicator status={deviceStatus} />
      <Text style={[styles.statusText, { color: theme.text }]}>
        {deviceStatus === 'connected' 
          ? 'Connected' 
          : deviceStatus === 'reconnecting' 
            ? 'Reconnecting...' 
            : 'Disconnected'}
      </Text>
    </View>
  );
};

const HomeScreen = () => {
  const { theme } = useTheme();
  const { 
    currentDevice, 
    deviceState, 
    batteryLevel, 
    startDevice, 
    stopDevice, 
    pauseDevice 
  } = useDevice();
  
  const isRunning = deviceState === 'running';
  const isPaused = deviceState === 'paused';
  const elapsedTime = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerInterval = useRef(null);

  useEffect(() => {
    // Start or stop the timer based on device state
    if (isRunning) {
      startTimer();
      startPulseAnimation();
    } else if (isPaused) {
      stopTimer();
      pulseAnim.setValue(1);
    } else {
      stopTimer();
      elapsedTime.current = 0;
      pulseAnim.setValue(1);
    }

    return () => {
      stopTimer();
    };
  }, [deviceState]);

  // For development: Debug device info in more detail
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

  // For development: Debug device info
  useEffect(() => {
    console.log('======= HOME SCREEN DEBUG =======');
    console.log(`Device State: ${deviceState}`);
    console.log(`Current Device: ${JSON.stringify(currentDevice)}`);
    console.log(`Battery Level: ${batteryLevel}`);
    console.log('================================');
  }, [deviceState, currentDevice, batteryLevel]);

  const startTimer = () => {
    if (timerInterval.current) return;
    
    timerInterval.current = setInterval(() => {
      elapsedTime.current += 1;
      // Force re-render
      forceUpdate();
    }, 1000);
  };

  const stopTimer = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
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

  // Force re-render hack (for timer updates)
  const [, updateState] = React.useState();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleRun = () => {
    if (!currentDevice) {
      Alert.alert('Not Connected', 'Please connect to your AquaSweeper device first.');
      return;
    }

    if (isRunning) {
      pauseDevice()
        .then(success => {
          if (!success) {
            Alert.alert('Error', 'Failed to pause device');
          }
        })
        .catch(error => {
          Alert.alert('Error', `Failed to pause device: ${error.message}`);
        });
    } else {
      startDevice()
        .then(success => {
          if (!success) {
            Alert.alert('Error', 'Failed to start device');
          }
        })
        .catch(error => {
          Alert.alert('Error', `Failed to start device: ${error.message}`);
        });
    }
  };

  const handleEndRun = () => {
    if (!currentDevice) {
      Alert.alert('Not Connected', 'Please connect to your AquaSweeper device first.');
      return;
    }

    Alert.alert(
      "End Current Run",
      "Are you sure you want to end the current run?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Yes",
          onPress: () => {
            stopDevice()
              .then(success => {
                if (!success) {
                  Alert.alert('Error', 'Failed to stop device');
                } else {
                  elapsedTime.current = 0;
                  Alert.alert('Run Completed', 'Your cleaning session has ended.', [{ text: 'OK' }]);
                }
              })
              .catch(error => {
                Alert.alert('Error', `Failed to stop device: ${error.message}`);
              });
          }
        }
      ]
    );
  };

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
          <DeviceConnectionStatus 
            device={currentDevice} 
          />
          
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
                backgroundColor: isRunning 
                  ? theme.success 
                  : isPaused 
                    ? theme.warning 
                    : theme.textSecondary 
              }]} />
              <Text style={[styles.statusText, { color: theme.text }]}>
                {isRunning ? 'Running' : isPaused ? 'Paused' : 'Stopped'}
              </Text>
            </View>
          </View>

          {/* Timer Display */}
          <View style={styles.timerContainer}>
            <Animated.View style={[styles.timerCircle, 
              { 
                borderColor: isRunning 
                  ? theme.success 
                  : isPaused 
                    ? theme.warning 
                    : theme.primary,
                transform: [{ scale: isRunning ? pulseAnim : 1 }]
              }
            ]}>
              <Text style={[styles.timerText, { color: theme.text }]}>
                {formatTime(elapsedTime.current)}
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
                  backgroundColor: isRunning 
                    ? theme.warning 
                    : isPaused 
                      ? theme.success 
                      : theme.primary,
                  opacity: currentDevice ? 1 : 0.5
                }
              ]}
              onPress={handleToggleRun}
              disabled={!currentDevice}
            >
              <MaterialCommunityIcons
                name={isRunning ? "pause" : "play"}
                size={24}
                color="#fff"
              />
              <Text style={styles.buttonText}>
                {isRunning ? 'Pause' : isPaused ? 'Resume' : 'Start'}
              </Text>
            </TouchableOpacity>

            {(isRunning || isPaused || elapsedTime.current > 0) && (
              <TouchableOpacity
                style={[
                  styles.button, 
                  { 
                    backgroundColor: theme.error,
                    opacity: currentDevice ? 1 : 0.5
                  }
                ]}
                onPress={handleEndRun}
                disabled={!currentDevice}
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
});

export default HomeScreen;
