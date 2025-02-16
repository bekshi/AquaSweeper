import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { collection, query, orderBy, getDocs, doc, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../services/AuthContext';

const InformationScreen = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [deviceInfo] = useState({
    model: 'AquaSweeper Pro',
    serialNumber: 'AS-001-2023',
    firmwareVersion: '1.2.3',
    batteryHealth: '95%',
    totalRunTime: '127 hours',
    lastMaintenance: '2024-12-15',
  });
  const [cleaningSessions, setCleaningSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState('week'); // 'week', 'month', 'all'

  useEffect(() => {
    if (user) {
      addTestDataIfNeeded();
      fetchCleaningSessions();
    }
  }, [selectedTimeFrame, user]);

  const addTestDataIfNeeded = async () => {
    try {
      const userSkimmersRef = collection(db, 'users', user.email, 'skimmers');
      const skimmersSnapshot = await getDocs(userSkimmersRef);

      if (skimmersSnapshot.empty) {
        const skimmerRef = doc(userSkimmersRef, 'test-skimmer-1');
        await setDoc(skimmerRef, {
          name: 'AquaSweeper Pro',
          model: 'AS-001',
          serialNumber: 'AS-001-2023',
          addedAt: new Date()
        });

        const sessionsRef = collection(skimmerRef, 'cleaningSessions');
        const now = new Date();
        
        for (let i = 0; i < 5; i++) {
          const startTime = new Date(now);
          startTime.setDate(now.getDate() - i);
          startTime.setHours(9 + i, 0, 0); // Different times each day
          
          const endTime = new Date(startTime);
          endTime.setHours(startTime.getHours() + 2); // 2-hour sessions
          
          await addDoc(sessionsRef, {
            startTime: startTime,
            endTime: endTime,
            debrisCollected: Math.floor(Math.random() * 500) + 100, // Random amount between 100-600g
            areasCovered: ['Main Pool', 'Deep End'],
            batteryUsed: Math.floor(Math.random() * 20) + 10, // Random between 10-30%
            status: 'completed'
          });
        }
      }
    } catch (error) {
      console.error('Error adding test data:', error);
    }
  };

  const fetchCleaningSessions = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log('Fetching sessions for user:', user.email); // Debug log
      
      const now = new Date();
      let dateThreshold = new Date();
      
      if (selectedTimeFrame === 'week') {
        dateThreshold.setDate(now.getDate() - 7);
      } else if (selectedTimeFrame === 'month') {
        dateThreshold.setMonth(now.getMonth() - 1);
      }

      const userSkimmersRef = collection(db, 'users', user.email, 'skimmers');
      const userSkimmersSnapshot = await getDocs(userSkimmersRef);
      
      console.log('Found skimmers:', userSkimmersSnapshot.size); // Debug log
      
      const sessions = [];
      
      for (const skimmerDoc of userSkimmersSnapshot.docs) {
        console.log('Fetching sessions for skimmer:', skimmerDoc.id); // Debug log
        
        const sessionsRef = collection(skimmerDoc.ref, 'cleaningSessions');
        const q = query(sessionsRef, orderBy('startTime', 'desc'));
        const querySnapshot = await getDocs(q);
        
        console.log('Found sessions:', querySnapshot.size); // Debug log
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (selectedTimeFrame === 'all' || new Date(data.startTime.toDate()) >= dateThreshold) {
            sessions.push({
              id: doc.id,
              skimmerId: skimmerDoc.id,
              ...data,
              startTime: data.startTime.toDate(),
              endTime: data.endTime.toDate(),
            });
          }
        });
      }
      
      sessions.sort((a, b) => b.startTime - a.startTime);
      setCleaningSessions(sessions);
    } catch (error) {
      console.error('Error fetching cleaning sessions:', error);
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
    <View style={[styles.timeFrameContainer, { backgroundColor: theme.surface }]}>
      <TouchableOpacity
        style={[
          styles.timeFrameButton,
          selectedTimeFrame === 'week' && [
            styles.timeFrameButtonActive,
            { backgroundColor: theme.primary }
          ]
        ]}
        onPress={() => setSelectedTimeFrame('week')}
      >
        <Text style={[
          styles.timeFrameButtonText,
          selectedTimeFrame === 'week' && { color: '#fff' }
        ]}>Week</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.timeFrameButton,
          selectedTimeFrame === 'month' && [
            styles.timeFrameButtonActive,
            { backgroundColor: theme.primary }
          ]
        ]}
        onPress={() => setSelectedTimeFrame('month')}
      >
        <Text style={[
          styles.timeFrameButtonText,
          selectedTimeFrame === 'month' && { color: '#fff' }
        ]}>Month</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.timeFrameButton,
          selectedTimeFrame === 'all' && [
            styles.timeFrameButtonActive,
            { backgroundColor: theme.primary }
          ]
        ]}
        onPress={() => setSelectedTimeFrame('all')}
      >
        <Text style={[
          styles.timeFrameButtonText,
          selectedTimeFrame === 'all' && { color: '#fff' }
        ]}>All Time</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSession = ({ item }) => (
    <View style={[styles.sessionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.sessionHeader}>
        <Text style={[styles.sessionDate, { color: theme.text }]}>{formatDate(item.startTime)}</Text>
        <View style={styles.batteryIndicator}>
          <Text style={[styles.batteryText, { color: theme.textSecondary }]}>{item.batteryUsed}% used</Text>
        </View>
      </View>
      <View style={styles.sessionDetails}>
        <View style={styles.detailColumn}>
          <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Duration</Text>
          <Text style={[styles.detailValue, { color: theme.text }]}>{formatDuration(item.duration)}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Device Information Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="robot" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Device Information</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Model</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{deviceInfo.model}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Serial Number</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{deviceInfo.serialNumber}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Firmware Version</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{deviceInfo.firmwareVersion}</Text>
            </View>
          </View>
        </View>

        {/* Status Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="chart-bar" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Status</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Battery Health</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{deviceInfo.batteryHealth}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Total Run Time</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{deviceInfo.totalRunTime}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Last Maintenance</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{deviceInfo.lastMaintenance}</Text>
            </View>
          </View>
        </View>

        {/* Cleaning History */}
        <Text style={[styles.title, { color: theme.text }]}>Cleaning History</Text>
        <TimeFrameSelector />
        {cleaningSessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.text }]}>No cleaning sessions found</Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              Your completed cleaning sessions will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={cleaningSessions}
            renderItem={renderSession}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  cardContent: {
    marginLeft: 36,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  timeFrameContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  timeFrameButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  timeFrameButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  timeFrameButtonText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    color: '#666',
  },
  sessionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
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
  },
  batteryIndicator: {
    padding: 6,
    borderRadius: 12,
  },
  batteryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sessionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailColumn: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 16,
  },
});

export default InformationScreen;
