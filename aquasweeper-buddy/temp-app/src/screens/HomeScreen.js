import React, { useState, useEffect, useRef } from 'react';
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
import { useTheme } from '../services/ThemeContext';
import { useNavigation } from '@react-navigation/native';

const HomeScreen = () => {
  const { theme } = useTheme();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const batteryLevel = 85; // Mock battery level
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const navigation = useNavigation();

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedTime(time => time + 1);
      }, 1000);
      
      // Start pulse animation
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
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleRun = () => {
    setIsRunning(!isRunning);
  };

  const handleEndRun = () => {
    if (!elapsedTime) return;

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
            setElapsedTime(0);
            setIsRunning(false);
            Alert.alert('Run Completed', 'Your cleaning session has ended.', [{ text: 'OK' }]);
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
            <Text style={[styles.cardTitle, { color: theme.text }]}>AquaSweeper Status</Text>
          </View>
          
          {/* Battery and Status */}
          <View style={styles.statusRow}>
            <View style={styles.batteryContainer}>
              <MaterialCommunityIcons 
                name={batteryLevel > 20 ? "battery-high" : "battery-low"} 
                size={24} 
                color={batteryLevel > 20 ? theme.success : theme.error} 
              />
              <Text style={[styles.batteryText, { color: theme.text }]}>{batteryLevel}%</Text>
            </View>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: isRunning ? theme.success : theme.textSecondary }]} />
              <Text style={[styles.statusText, { color: theme.text }]}>
                {isRunning ? 'Running' : 'Ready'}
              </Text>
            </View>
          </View>

          {/* Timer Display */}
          <View style={styles.timerContainer}>
            <Animated.View style={[styles.timerCircle, 
              { 
                borderColor: isRunning ? theme.success : theme.primary,
                transform: [{ scale: isRunning ? pulseAnim : 1 }]
              }
            ]}>
              <Text style={[styles.timerText, { color: theme.text }]}>{formatTime(elapsedTime)}</Text>
              <Text style={[styles.timerLabel, { color: theme.textSecondary }]}>Current Run Time</Text>
            </Animated.View>
          </View>

          {/* Control Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: isRunning ? theme.error : theme.primary }
              ]}
              onPress={handleToggleRun}
            >
              <MaterialCommunityIcons
                name={isRunning ? "pause" : "play"}
                size={24}
                color="#fff"
              />
              <Text style={styles.buttonText}>
                {isRunning ? 'Pause' : 'Start'}
              </Text>
            </TouchableOpacity>

            {elapsedTime > 0 && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.error }]}
                onPress={handleEndRun}
              >
                <MaterialCommunityIcons name="stop" size={24} color="#fff" />
                <Text style={styles.buttonText}>End Run</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      
      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => navigation.navigate('ScanDevices')}>
        <MaterialCommunityIcons name="plus" size={30} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
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
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
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
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 1000,
  },
});

export default HomeScreen;
