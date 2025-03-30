import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../services/AuthContext';
import { useDevice } from '../services/DeviceContext';

const HomeScreen = () => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const { user } = useAuth();
  const { 
    currentDevice, 
    isConnected, 
    deviceState, 
    batteryLevel, 
    startDevice, 
    stopDevice, 
    pauseDevice 
  } = useDevice();

  const isRunning = deviceState === 'running';
  const isPaused = deviceState === 'paused';

  // Timer logic
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Reset timer when stopped
  useEffect(() => {
    if (deviceState === 'stopped') {
      setElapsedTime(0);
    }
  }, [deviceState]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const toggleRunning = () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Cannot control device: not connected');
      return;
    }
    
    if (isRunning) {
      // If running, pause it
      pauseDevice((success, error) => {
        if (!success) {
          Alert.alert('Error', `Failed to pause: ${error}`);
        }
      });
    } else if (isPaused) {
      // If paused, resume it
      startDevice((success, error) => {
        if (!success) {
          Alert.alert('Error', `Failed to resume: ${error}`);
        }
      });
    } else {
      // If stopped, start it
      startDevice((success, error) => {
        if (!success) {
          Alert.alert('Error', `Failed to start: ${error}`);
        }
      });
    }
  };

  const handleStop = () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Cannot control device: not connected');
      return;
    }
    
    stopDevice((success, error) => {
      if (!success) {
        Alert.alert('Error', `Failed to stop: ${error}`);
      }
    });
  };

  // Calculate circle properties for battery indicator
  const batteryPercentage = batteryLevel || 64; // Default to 64% if no data
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - batteryPercentage / 100);

  if (!currentDevice) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.noDeviceText}>No device connected</Text>
          <TouchableOpacity 
            style={styles.setupButton}
            onPress={() => navigation.navigate('DevicePairing')}
          >
            <Text style={styles.setupButtonText}>Set Up Device</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{currentDevice.deviceName}</Text>
        <View style={[
          styles.statusIndicator, 
          { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }
        ]} />
      </View>

      <View style={styles.content}>
        {/* Connection Status */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            Status: {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
          <Text style={styles.deviceStateText}>
            Device: {deviceState.charAt(0).toUpperCase() + deviceState.slice(1)}
          </Text>
        </View>

        {/* Battery Percentage Circle */}
        <View style={styles.batteryContainer}>
          <Svg width={120} height={120}>
            {/* Background circle */}
            <Circle
              cx={60}
              cy={60}
              r={radius}
              stroke="#E0E0E0"
              strokeWidth={10}
              fill="none"
            />
            {/* Progress circle */}
            <Circle
              cx={60}
              cy={60}
              r={radius}
              stroke="#4CAF50"
              strokeWidth={10}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          </Svg>
          <Text style={styles.batteryText}>{`${batteryPercentage}%`}</Text>
        </View>

        {/* Play/Pause Button */}
        <TouchableOpacity 
          style={[styles.playButton, !isConnected && styles.buttonDisabled]} 
          onPress={toggleRunning}
          disabled={!isConnected}
        >
          <View style={styles.playButtonInner}>
            {isRunning ? (
              // Pause icon
              <View style={styles.pauseContainer}>
                <View style={styles.pauseBar} />
                <View style={styles.pauseBar} />
              </View>
            ) : isPaused ? (
              // Play icon (for resume)
              <View style={styles.playIcon} />
            ) : (
              // Play icon (for start)
              <View style={styles.playIcon} />
            )}
          </View>
        </TouchableOpacity>

        {/* Stop Button - Only show when running or paused */}
        {(isRunning || isPaused) && (
          <TouchableOpacity 
            style={[styles.stopButton, !isConnected && styles.buttonDisabled]} 
            onPress={handleStop}
            disabled={!isConnected}
          >
            <View style={styles.stopIcon} />
          </TouchableOpacity>
        )}

        {/* Timer Display */}
        <View style={styles.timerContainer}>
          <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 50,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 5,
  },
  deviceStateText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  batteryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  batteryText: {
    position: 'absolute',
    fontSize: 20,
    fontWeight: 'bold',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  playButtonInner: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 24,
    borderRightWidth: 0,
    borderBottomWidth: 16,
    borderTopWidth: 16,
    borderLeftColor: '#fff',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderTopColor: 'transparent',
    marginLeft: 8,
  },
  pauseContainer: {
    flexDirection: 'row',
    width: 24,
    justifyContent: 'space-between',
  },
  pauseBar: {
    width: 8,
    height: 24,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  stopButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  stopIcon: {
    width: 24,
    height: 24,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  timerContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  noDeviceText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  setupButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  setupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
