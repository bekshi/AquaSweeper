import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { collection, query, orderBy, getDocs, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../services/AuthContext';

const InformationScreen = () => {
  const [cleaningSessions, setCleaningSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState('week'); // 'week', 'month', 'all'
  const { user } = useAuth(); // Get current user
  const skimmerId = "AS-001"; // This should come from your connected device state

  useEffect(() => {
    fetchCleaningSessions();
  }, [selectedTimeFrame]);

  const fetchCleaningSessions = async () => {
    try {
      setLoading(true);
      // Get the date threshold based on selected timeframe
      const now = new Date();
      let dateThreshold = new Date();
      if (selectedTimeFrame === 'week') {
        dateThreshold.setDate(now.getDate() - 7);
      } else if (selectedTimeFrame === 'month') {
        dateThreshold.setMonth(now.getMonth() - 1);
      }

      // Reference to the skimmer's cleaningSessions collection
      const skimmerRef = doc(db, 'skimmers', skimmerId);
      const cleaningSessionsRef = collection(skimmerRef, 'cleaningSessions');
      
      // Query the sessions
      const q = query(
        cleaningSessionsRef,
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const sessions = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Only add sessions within the selected timeframe
        if (selectedTimeFrame === 'all' || data.date.toDate() >= dateThreshold) {
          sessions.push({
            id: doc.id,
            ...data,
            date: data.date.toDate(),
          });
        }
      });
      
      setCleaningSessions(sessions);
    } catch (error) {
      console.error('Error fetching cleaning sessions:', error);
      Alert.alert(
        "Error",
        "Failed to load cleaning sessions. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const TimeFrameSelector = () => (
    <View style={styles.timeFrameContainer}>
      <TouchableOpacity
        style={[
          styles.timeFrameButton,
          selectedTimeFrame === 'week' && styles.timeFrameButtonActive,
        ]}
        onPress={() => setSelectedTimeFrame('week')}
      >
        <Text style={[
          styles.timeFrameButtonText,
          selectedTimeFrame === 'week' && styles.timeFrameButtonTextActive,
        ]}>Week</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.timeFrameButton,
          selectedTimeFrame === 'month' && styles.timeFrameButtonActive,
        ]}
        onPress={() => setSelectedTimeFrame('month')}
      >
        <Text style={[
          styles.timeFrameButtonText,
          selectedTimeFrame === 'month' && styles.timeFrameButtonTextActive,
        ]}>Month</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.timeFrameButton,
          selectedTimeFrame === 'all' && styles.timeFrameButtonActive,
        ]}
        onPress={() => setSelectedTimeFrame('all')}
      >
        <Text style={[
          styles.timeFrameButtonText,
          selectedTimeFrame === 'all' && styles.timeFrameButtonTextActive,
        ]}>All Time</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSession = ({ item }) => (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionDate}>{formatDate(item.date)}</Text>
        <View style={styles.batteryIndicator}>
          <Text style={styles.batteryText}>{item.batteryUsed}% used</Text>
        </View>
      </View>
      <View style={styles.sessionDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Duration</Text>
          <Text style={styles.detailValue}>{formatDuration(item.duration)}</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cleaning History</Text>
      <TimeFrameSelector />
      {cleaningSessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No cleaning sessions found</Text>
          <Text style={styles.emptySubtext}>
            Your completed cleaning sessions will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={cleaningSessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  timeFrameContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
  },
  timeFrameButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  timeFrameButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  timeFrameButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  timeFrameButtonTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingBottom: 16,
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  batteryIndicator: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  batteryText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
  },
  sessionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    alignItems: 'flex-start',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default InformationScreen;
