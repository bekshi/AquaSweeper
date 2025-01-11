import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { collection, query, orderBy, getDocs, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../services/AuthContext';
import { useTheme } from '../services/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';

const MaintenanceScreen = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDismissed, setShowDismissed] = useState(false);
  const { user } = useAuth();
  const { theme } = useTheme();
  const skimmerId = "AS-001"; // This should come from your connected device state

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      
      // Mock alerts data
      const mockAlerts = [
        {
          id: 'alert1',
          alertId: 'err001',
          alertName: 'Disconnected',
          alertAt: new Date(Date.now() - 1000 * 60 * 5),
          deviceId: 'AS-001',
          dismissed: false,
        },
        {
          id: 'alert2',
          alertId: 'bat001',
          alertName: 'Battery Low',
          alertAt: new Date(Date.now() - 1000 * 60 * 30),
          deviceId: 'AS-001',
          dismissed: false,
        },
        {
          id: 'alert3',
          alertId: 'mnt001',
          alertName: 'Maintenance Required',
          alertAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
          deviceId: 'AS-001',
          dismissed: true,
        },
        {
          id: 'alert4',
          alertId: 'stk001',
          alertName: 'Stuck',
          alertAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
          deviceId: 'AS-001',
          dismissed: true,
        }
      ];

      setAlerts(mockAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      Alert.alert(
        "Error",
        "Failed to load maintenance alerts. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (alertId) => {
    setAlerts(currentAlerts =>
      currentAlerts.map(alert =>
        alert.id === alertId
          ? { ...alert, dismissed: true }
          : alert
      )
    );
  };

  const handleUndismiss = (alertId) => {
    setAlerts(currentAlerts =>
      currentAlerts.map(alert =>
        alert.id === alertId
          ? { ...alert, dismissed: false }
          : alert
      )
    );
  };

  const renderRightActions = (alertId, dismissed) => {
    return (
      <TouchableOpacity
        style={[
          styles.swipeAction,
          { backgroundColor: dismissed ? '#4CAF50' : '#FF3B30' }
        ]}
        onPress={() => dismissed ? handleUndismiss(alertId) : handleDismiss(alertId)}
      >
        <MaterialCommunityIcons
          name={dismissed ? 'bell-ring' : 'bell-off'}
          size={24}
          color="#fff"
        />
        <Text style={styles.swipeActionText}>
          {dismissed ? 'Restore' : 'Dismiss'}
        </Text>
      </TouchableOpacity>
    );
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

  const getAlertIcon = (alertName) => {
    switch (alertName.toLowerCase()) {
      case 'disconnected':
        return 'wifi-off';
      case 'battery low':
        return 'battery-alert';
      case 'maintenance required':
        return 'tools';
      case 'stuck':
        return 'alert-circle';
      default:
        return 'alert';
    }
  };

  const getAlertColor = (alertName) => {
    switch (alertName.toLowerCase()) {
      case 'disconnected':
        return '#FF9800';
      case 'battery low':
        return '#F44336';
      case 'maintenance required':
        return '#2196F3';
      case 'stuck':
        return '#E91E63';
      default:
        return '#757575';
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const activeAlerts = alerts.filter(alert => !alert.dismissed);
  const dismissedAlerts = alerts.filter(alert => alert.dismissed);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={[styles.alertCount, { color: theme.text }]}>
            {showDismissed ? dismissedAlerts.length : activeAlerts.length} {showDismissed ? 'Dismissed' : 'Active'} Alert{(showDismissed ? dismissedAlerts.length : activeAlerts.length) !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: theme.surface, borderColor: theme.border },
              showDismissed && { backgroundColor: theme.primary }
            ]}
            onPress={() => setShowDismissed(!showDismissed)}
          >
            <Text style={[
              styles.filterButtonText,
              { color: showDismissed ? '#fff' : theme.text }
            ]}>
              {showDismissed ? 'Show Active' : 'Show Dismissed'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {((showDismissed && dismissedAlerts.length === 0) || 
        (!showDismissed && activeAlerts.length === 0)) ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons 
            name="bell-check" 
            size={48} 
            color={theme.textSecondary} 
          />
          <Text style={[styles.emptyText, { color: theme.text }]}>
            {showDismissed ? 'No dismissed alerts' : 'No active alerts'}
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
            {showDismissed 
              ? 'Dismissed alerts will appear here' 
              : 'You\'re all caught up!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          renderItem={({ item }) => {
            if (item.dismissed !== showDismissed) return null;

            return (
              <Swipeable
                renderRightActions={() => renderRightActions(item.id, item.dismissed)}
              >
                <View style={[
                  styles.alertCard,
                  { 
                    backgroundColor: theme.surface,
                    borderLeftColor: getAlertColor(item.alertName),
                    borderColor: theme.border
                  },
                  item.dismissed && { opacity: 0.7 }
                ]}>
                  <View style={styles.alertIconContainer}>
                    <MaterialCommunityIcons 
                      name={getAlertIcon(item.alertName)} 
                      size={24} 
                      color={getAlertColor(item.alertName)} 
                    />
                  </View>
                  <View style={styles.alertContent}>
                    <Text style={[styles.alertName, { color: theme.text }]}>{item.alertName}</Text>
                    <Text style={[styles.alertTime, { color: theme.textSecondary }]}>{formatDate(item.alertAt)}</Text>
                    <Text style={[styles.alertId, { color: theme.textSecondary }]}>Alert ID: {item.alertId}</Text>
                  </View>
                </View>
              </Swipeable>
            );
          }}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertCount: {
    fontSize: 18,
    fontWeight: '600',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  alertCard: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  alertIconContainer: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContent: {
    flex: 1,
    padding: 16,
    paddingLeft: 8,
  },
  alertName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 14,
    marginBottom: 4,
  },
  alertId: {
    fontSize: 12,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    paddingHorizontal: 16,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default MaintenanceScreen;
