import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import deviceConnectionService from '../services/DeviceConnectionService';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../services/AuthContext';

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
  const { user } = useAuth();
  const { device } = route.params;
  const [deviceName, setDeviceName] = useState(device.name || device.deviceName || 'Unnamed Device');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deviceData, setDeviceData] = useState(device);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);

  // Setup real-time monitoring when screen is focused
  useFocusEffect(
    useCallback(() => {
      let unsubscribe;

      const setupMonitoring = async () => {
        // Start monitoring this device
        deviceConnectionService.startMonitoring(device);

        // Set up real-time listener for device updates
        if (!user?.uid) {
          console.error('No user ID available for device monitoring');
          return;
        }
        
        const userRef = doc(db, 'users', user.uid);
        unsubscribe = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const userData = doc.data();
            const updatedDevice = userData.connectedDevices?.find(d => d.macAddress === device.macAddress);
            if (updatedDevice) {
              setDeviceData(updatedDevice);
              setDeviceName(updatedDevice.name || updatedDevice.deviceName || 'Unnamed Device');
              setLastUpdated(new Date());
            }
          }
        });
      };

      setupMonitoring();

      // Cleanup when screen loses focus
      return () => {
        if (unsubscribe) unsubscribe();
        deviceConnectionService.stopMonitoring(device);
      };
    }, [device, user])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await deviceConnectionService.checkDeviceHealth(device);
    } catch (error) {
      console.error('Error refreshing device status:', error);
    } finally {
      setRefreshing(false);
    }
  }, [device]);

  const handleSaveName = async () => {
    if (deviceName.trim() === '') {
      Alert.alert('Error', 'Device name cannot be empty');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Error', 'No user ID available');
      return;
    }

    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const devices = userData.connectedDevices || [];
        const updatedDevices = devices.map(d => {
          if (d.macAddress === device.macAddress) {
            return { 
              ...d, 
              name: deviceName.trim(),
              deviceName: deviceName.trim() 
            };
          }
          return d;
        });

        await updateDoc(userRef, {
          connectedDevices: updatedDevices
        });
        
        setDeviceData(prev => ({ 
          ...prev, 
          name: deviceName.trim(),
          deviceName: deviceName.trim() 
        }));
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Error updating device name:', error);
      Alert.alert('Error', 'Failed to update device name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveDevice = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'No user ID available');
      return;
    }

    Alert.alert(
      'Remove Device',
      'Are you sure you want to remove this device? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove device from user's connectedDevices array in Firestore
              const userRef = doc(db, 'users', user.uid);
              
              // Get the current devices
              const userDoc = await getDoc(userRef);
              if (userDoc.exists()) {
                const userData = userDoc.data();
                const devices = userData.connectedDevices || [];
                
                // Filter out the device to remove
                const updatedDevices = devices.filter(d => 
                  d.macAddress !== device.macAddress
                );
                
                // Update with the filtered list
                await updateDoc(userRef, {
                  connectedDevices: updatedDevices
                });
                
                // Stop monitoring this device
                deviceConnectionService.stopMonitoring(device);

                // Navigate back instead of to a specific screen
                navigation.goBack();
              }
            } catch (error) {
              console.error('Error removing device:', error);
              Alert.alert('Error', 'Failed to remove device. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleFactoryReset = async () => {
    Alert.alert(
      'Factory Reset Device',
      'This will reset the device to factory settings and clear all WiFi credentials. The device will restart and you will need to reconfigure it. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              // Send factory reset command to device
              const response = await fetch(`http://${deviceData.ipAddress}/factory-reset`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                }
              });
              
              if (response.ok) {
                // Also remove the device from Firestore
                await handleRemoveDevice();
                
                Alert.alert(
                  'Device Reset',
                  'The device has been reset to factory settings and removed from your account. You will need to reconfigure it.',
                  [
                    {
                      text: 'OK',
                      onPress: () => navigation.goBack()
                    }
                  ]
                );
              } else {
                throw new Error('Failed to reset device');
              }
            } catch (error) {
              console.error('Error resetting device:', error);
              Alert.alert('Error', 'Failed to reset device. Make sure you are connected to the device.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.content}>
        {/* Device Name Section */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <View style={styles.nameContainer}>
            {isEditing ? (
              <View style={styles.editContainer}>
                <TextInput
                  style={[styles.nameInput, { color: theme.text, borderColor: theme.border }]}
                  value={deviceName}
                  onChangeText={setDeviceName}
                  placeholder="Enter device name"
                  placeholderTextColor={theme.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.primary }]}
                  onPress={handleSaveName}
                  disabled={isSaving}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.nameRow}>
                <Text style={[styles.deviceName, { color: theme.text }]}>
                  {deviceName}
                </Text>
                <TouchableOpacity onPress={() => setIsEditing(true)}>
                  <MaterialCommunityIcons name="pencil" size={20} color={theme.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Device Info Section */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <DeviceInfo label="MAC Address" value={deviceData.macAddress} />
          <DeviceInfo label="IP Address" value={deviceData.ipAddress} />
          <DeviceInfo label="Last Updated" value={lastUpdated.toLocaleString()} />
        </View>

        {/* Actions Section */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <TouchableOpacity
            style={[styles.removeButton, { borderColor: theme.error }]}
            onPress={handleRemoveDevice}
          >
            <MaterialCommunityIcons name="delete" size={20} color={theme.error} />
            <Text style={[styles.removeButtonText, { color: theme.error }]}>
              Remove Device
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.removeButton, { borderColor: theme.error }]}
            onPress={handleFactoryReset}
          >
            <MaterialCommunityIcons name="restart" size={20} color={theme.error} />
            <Text style={[styles.removeButtonText, { color: theme.error }]}>
              Factory Reset
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    marginBottom: 8,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  saveButton: {
    width: 80,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 24,
    fontWeight: '600',
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
});

export default DeviceDetailsScreen;
