import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAuth } from '../services/AuthContext';
import { useNavigation } from '@react-navigation/native';

const HomeScreen = () => {
  const [batteryPercentage, setBatteryPercentage] = useState(64); // Mock battery value
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const { user } = useAuth();
  const navigation = useNavigation();

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

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const toggleRunning = () => {
    setIsRunning(!isRunning);
  };

  // Calculate circle properties for battery indicator
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - batteryPercentage / 100);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.debugText}>Debug: Home Screen Loaded</Text>
        
        {/* Main Content */}
        <View style={styles.content}>
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
              <Text
                x={60}
                y={60}
                textAnchor="middle"
                dy=".3em"
                fill="#333"
                fontSize={20}
              >
                {`${batteryPercentage}%`}
              </Text>
            </Svg>
          </View>

          {/* Play/Pause Button */}
          <TouchableOpacity style={styles.playButton} onPress={toggleRunning}>
            <View style={styles.playButtonInner}>
              {isRunning ? (
                // Pause icon
                <View style={styles.pauseContainer}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              ) : (
                // Play icon
                <View style={styles.playIcon} />
              )}
            </View>
          </TouchableOpacity>

          {/* Timer Display */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
          </View>
        </View>

        {/* Floating Action Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            console.log('FAB Pressed');
            navigation.navigate('ScanDevices');
          }}>
          <Text style={styles.fabText}>ADD DEVICE</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  debugText: {
    color: 'red',
    fontSize: 16,
    padding: 10,
    backgroundColor: 'yellow',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: 50,
  },
  batteryContainer: {
    alignItems: 'center',
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
  timerContainer: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'red',
    borderRadius: 25,
    elevation: 8,
    zIndex: 1000,
    borderWidth: 2,
    borderColor: 'black',
  },
  fabText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
