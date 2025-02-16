import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import deviceConnectionService from '../services/DeviceConnectionService';

const StatusIndicator = ({ status }) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const pulse = Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 0.7,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ]);

    Animated.loop(pulse).start();
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#4CAF50';
      case 'reconnecting':
        return '#FFA000';
      case 'disconnected':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  return (
    <Animated.View
      style={[
        styles.statusIndicator,
        {
          backgroundColor: getStatusColor(),
          opacity: pulseAnim,
        }
      ]}
    />
  );
};

const DeviceInfo = ({ label, value }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.detailItem}>
      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.detailValue, { color: theme.text }]}>
        {value || 'Not available'}
      </Text>
    </View>
  );
};

const DeviceDetailsScreen = ({ route, navigation }) => {
  const { theme } = useTheme();
  const { device, userId } = route.params;
  const [deviceName, setDeviceName] = useState(device.name);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deviceData, setDeviceData] = useState(device);

  useEffect(() => {
    // Start monitoring this device
    deviceConnectionService.startMonitoring(device, userId);

    // Set up real-time listener for device updates
    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        const devices = userData.settings?.devices || [];
        const updatedDevice = devices.find(d => d.macAddress === device.macAddress);
        if (updatedDevice) {
          setDeviceData(updatedDevice);
        }
      }
    });

    // Stop monitoring when leaving the screen
    return () => {
      deviceConnectionService.stopMonitoring(device);
      unsubscribe();
    };
  }, [device, userId]);

  const handleSaveName = async () => {
    if (deviceName.trim() === '') {
      Alert.alert('Error', 'Device name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', userId);
      const deviceData = {
        ...device,
        name: deviceName.trim()
      };

      await updateDoc(userRef, {
        'settings.devices': arrayUnion(deviceData)
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating device name:', error);
      Alert.alert('Error', 'Failed to update device name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveDevice = () => {
    Alert.alert(
      'Remove Device',
      'Are you sure you want to remove this device? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Stop monitoring before removing
              deviceConnectionService.stopMonitoring(device);

              const userRef = doc(db, 'users', userId);
              const userDoc = await getDoc(userRef);
              if (!userDoc.exists()) {
                throw new Error('User document not found');
              }

              const userData = userDoc.data();
              const currentDevices = userData.settings?.devices || [];
              const updatedDevices = currentDevices.filter(d => 
                d.macAddress !== device.macAddress
              );

              await updateDoc(userRef, {
                'settings.devices': updatedDevices
              });

              navigation.goBack();
            } catch (error) {
              console.error('Error removing device:', error);
              Alert.alert('Error', 'Failed to remove device. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleReconfigure = () => {
    navigation.navigate('DevicePairing', { deviceId: device.id });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <View style={styles.statusSection}>
          <StatusIndicator status={deviceData.isConnected ? 'connected' : 'disconnected'} />
          <Text style={[styles.statusText, { color: theme.textSecondary }]}>
            {deviceData.isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>

        {isEditing ? (
          <View style={styles.editNameContainer}>
            <TextInput
              style={[styles.nameInput, { color: theme.text, borderColor: theme.border }]}
              value={deviceName}
              onChangeText={setDeviceName}
              placeholder="Enter device name"
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />
            <View style={styles.editActions}>
              <TouchableOpacity 
                onPress={() => setIsEditing(false)}
                style={[styles.editButton, { borderColor: theme.border }]}
              >
                <MaterialCommunityIcons name="close" size={24} color={theme.error} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSaveName}
                style={[styles.editButton, { borderColor: theme.border }]}
                disabled={isSaving}
              >
                <MaterialCommunityIcons name="check" size={24} color={theme.primary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.nameContainer}>
            <Text style={[styles.deviceName, { color: theme.text }]}>{deviceName}</Text>
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <MaterialCommunityIcons name="pencil" size={24} color={theme.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.detailSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Device Information</Text>
          <DeviceInfo label="MAC Address" value={deviceData.macAddress} />
          <DeviceInfo label="IP Address" value={deviceData.ipAddress} />
          <DeviceInfo 
            label="Last Seen" 
            value={deviceData.lastSeen ? new Date(deviceData.lastSeen).toLocaleString() : 'Never'} 
          />
          <DeviceInfo 
            label="Added On" 
            value={deviceData.dateAdded ? new Date(deviceData.dateAdded).toLocaleString() : 'Unknown'} 
          />
          <DeviceInfo 
            label="Firmware Version" 
            value={deviceData.firmwareVersion} 
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.detailSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>WiFi Information</Text>
          <DeviceInfo 
            label="Connected To" 
            value={deviceData.wifiSSID || 'Not Connected'} 
          />
          <DeviceInfo 
            label="Signal Strength" 
            value={deviceData.wifiStrength ? `${deviceData.wifiStrength} dBm` : 'N/A'} 
          />
          <DeviceInfo 
            label="Uptime" 
            value={formatUptime(deviceData.uptime) || 'N/A'} 
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.actionSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Device Actions</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.primary }]}
            onPress={handleReconfigure}
          >
            <MaterialCommunityIcons name="cog" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Reconfigure Device</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.error }]}
            onPress={handleRemoveDevice}
          >
            <MaterialCommunityIcons name="delete" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Remove Device</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const formatUptime = (seconds) => {
  if (!seconds) return 'N/A';
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) return 'Less than a minute';
  
  return parts.join(' ');
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    marginBottom: 16,
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceName: {
    fontSize: 24,
    fontWeight: '600',
  },
  editNameContainer: {
    gap: 12,
  },
  nameInput: {
    fontSize: 24,
    fontWeight: '600',
    borderBottomWidth: 2,
    paddingVertical: 4,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  card: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  detailSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  detailLabel: {
    fontSize: 16,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionSection: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeviceDetailsScreen;
