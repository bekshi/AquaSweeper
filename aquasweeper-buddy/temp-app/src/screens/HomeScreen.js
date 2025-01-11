import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../services/AuthContext';
import { db } from '../services/firebase';
import { collection, addDoc, doc } from 'firebase/firestore';

const HomeScreen = ({ navigation }) => {
  const [batteryPercentage, setBatteryPercentage] = useState(64);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const { user } = useAuth();
  const skimmerId = "AS-001"; // This should come from your connected device state

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

  const handleEndRun = () => {
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
          onPress: async () => {
            try {
              // Save the current session data
              const sessionData = {
                duration: elapsedTime,
                date: new Date(),
                batteryUsed: 64 - batteryPercentage,
                userId: user.uid,
                deviceName: "Backyard Pool", // Get this from connected device
              };
              
              // Reference to the skimmer's cleaningSessions collection
              const skimmerRef = doc(db, 'skimmers', skimmerId);
              const cleaningSessionsRef = collection(skimmerRef, 'cleaningSessions');
              
              // Save to Firebase
              const docRef = await addDoc(cleaningSessionsRef, sessionData);
              console.log('Session saved with ID:', docRef.id);

              // Reset the timer and stop running
              setIsRunning(false);
              setElapsedTime(0);

              // Show confirmation message
              Alert.alert(
                "Run Saved",
                "Your cleaning session has been saved. You can view it in the Information screen.",
                [
                  {
                    text: "View History",
                    onPress: () => navigation.navigate('Information')
                  },
                  {
                    text: "OK",
                    style: "cancel"
                  }
                ]
              );
            } catch (error) {
              console.error('Error saving session:', error);
              Alert.alert(
                "Error",
                "Failed to save cleaning session. Please try again."
              );
            }
          }
        }
      ]
    );
  };

  // Calculate circle properties for battery indicator
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - batteryPercentage / 100);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Battery Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Battery Status</Text>
          <View style={styles.batteryContainer}>
            <Svg width={120} height={120}>
              <Circle
                cx={60}
                cy={60}
                r={radius}
                stroke="#E0E0E0"
                strokeWidth={10}
                fill="none"
              />
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
        </View>

        {/* Controls Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Controls</Text>
          <View style={styles.controlsContainer}>
            {/* Play/Pause Button */}
            <TouchableOpacity 
              style={[
                styles.playButton,
                isRunning && styles.playButtonActive
              ]} 
              onPress={toggleRunning}
            >
              <View style={styles.playButtonInner}>
                {isRunning ? (
                  <View style={styles.pauseContainer}>
                    <View style={styles.pauseBar} />
                    <View style={styles.pauseBar} />
                  </View>
                ) : (
                  <View style={styles.playIcon} />
                )}
              </View>
            </TouchableOpacity>

            {/* End Run Button - Always visible */}
            <TouchableOpacity 
              style={[
                styles.endRunButton,
                !elapsedTime && styles.endRunButtonDisabled
              ]} 
              onPress={handleEndRun}
              disabled={!elapsedTime}
            >
              <Text style={[
                styles.endRunText,
                !elapsedTime && styles.endRunTextDisabled
              ]}>
                End Current Run
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Timer Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Run Time</Text>
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
          </View>
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
  section: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  batteryContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  batteryText: {
    position: 'absolute',
    top: '50%',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    transform: [{ translateY: -10 }],
  },
  controlsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
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
    marginBottom: 20,
  },
  playButtonActive: {
    backgroundColor: '#0056b3',
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
  endRunButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '80%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  endRunButtonDisabled: {
    backgroundColor: '#ffcccb',
  },
  endRunText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  endRunTextDisabled: {
    color: '#999',
  },
  timerContainer: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default HomeScreen;
