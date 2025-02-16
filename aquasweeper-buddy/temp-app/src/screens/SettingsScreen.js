import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../services/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Animated } from 'react-native';
import deviceConnectionService from '../services/DeviceConnectionService';

const DeviceStatusIndicator = ({ isConnected }) => {
  const { theme } = useTheme();
  return (
    <View style={[
      styles.statusIndicator,
      { backgroundColor: isConnected ? '#4CAF50' : '#FF3B30' }
    ]} />
  );
};

const BatteryIndicator = ({ percentage }) => {
  const { theme } = useTheme();
  const getBatteryColor = (level) => {
    if (level > 50) return '#4CAF50';
    if (level > 20) return '#FFA500';
    return '#FF3B30';
  };

  return (
    <View style={styles.batteryContainer}>
      <MaterialCommunityIcons 
        name="battery" 
        size={20} 
        color={getBatteryColor(percentage)} 
      />
      <Text style={[styles.batteryText, { color: theme.textSecondary }]}>
        {percentage}%
      </Text>
    </View>
  );
};

const getBatteryIcon = (level) => {
  if (level >= 90) return 'full';
  if (level >= 60) return 'three-quarters';
  if (level >= 40) return 'half';
  if (level >= 20) return 'quarter';
  return 'empty';
};

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
        return '#4CAF50'; // Green
      case 'reconnecting':
        return '#FFA000'; // Amber
      case 'disconnected':
        return '#F44336'; // Red
      default:
        return '#757575'; // Grey
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

const DeviceItem = ({ device, onPress }) => {
  const { theme } = useTheme();
  
  const getDeviceName = () => {
    if (device.name) return device.name;
    if (device.macAddress) return `AquaSweeper-${device.macAddress.slice(-4)}`;
    return "Unknown Device";
  };
  
  return (
    <TouchableOpacity
      style={[styles.deviceItem, { backgroundColor: theme.surface }]}
      onPress={onPress}
    >
      <View style={styles.deviceInfo}>
        <StatusIndicator status={device.isConnected ? 'connected' : 'disconnected'} />
        <View style={styles.deviceTextContainer}>
          <Text style={[styles.deviceName, { color: theme.text }]}>
            {getDeviceName()}
          </Text>
          <Text style={[styles.deviceStatus, { color: theme.textSecondary }]}>
            {device.isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>
      <MaterialCommunityIcons 
        name="chevron-right" 
        size={24} 
        color={theme.textSecondary} 
      />
    </TouchableOpacity>
  );
};

const SettingsScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const { isDarkMode, setIsDarkMode, theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userSettings, setUserSettings] = useState(null);
  const [devices, setDevices] = useState([]);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    if (!user) return;

    // Set up real-time listener for devices
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        const updatedDevices = userData.settings?.devices || [];
        setDevices(updatedDevices);
        
        // Start monitoring all devices
        updatedDevices.forEach(device => {
          deviceConnectionService.startMonitoring(device, user.uid);
        });
      }
    }, (error) => {
      console.error('Error listening to devices:', error);
    });

    // Cleanup subscription and stop monitoring on unmount
    return () => {
      unsubscribe();
      deviceConnectionService.stopMonitoringAll();
    };
  }, [user]);

  const handleAddDevice = () => {
    navigation.navigate('DevicePairing');
  };

  const handleRemoveDevice = async (deviceId) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const devices = userData.settings.devices.filter((device) => device.id !== deviceId);
      await updateDoc(userRef, {
        'settings.devices': devices,
      });
      setDevices(devices);
    } catch (error) {
      console.error('Error removing device:', error);
      Alert.alert('Error', 'Failed to remove device');
    }
  };

  // Validate authentication state
  useEffect(() => {
    let isMounted = true;
    
    const validateAuth = async () => {
      if (!isMounted) return;
      
      setLoading(true);
      setError(null);
      
      if (!user) {
        setError('No authenticated user found');
        navigation.replace('SignIn');
        return;
      }

      if (!user.uid) {
        setError('Invalid user state');
        await signOut();
        return;
      }

      // User is properly authenticated, proceed with data fetching
      await fetchUserProfile();
    };

    validateAuth().catch(error => {
      if (isMounted) {
        console.error('Authentication validation error:', error);
        setError('Failed to validate authentication');
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user, navigation]);

  const fetchUserProfile = async () => {
    const abortController = new AbortController();
    
    try {
      if (!user?.uid) {
        throw new Error('No user ID available');
      }

      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (abortController.signal.aborted) return;

      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data();
      setUserProfile(userData);
      setUserSettings(userData.settings || {});
    } catch (error) {
      if (error.code === 'permission-denied') {
        setError('Access denied. Please check your permissions.');
      } else if (error.code === 'unavailable') {
        setError('Service temporarily unavailable. Please try again later.');
      } else {
        console.error('Error fetching user profile:', error);
        setError(error.message);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }

    return () => {
      abortController.abort();
    };
  };

  const handleResetPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      Alert.alert('Success', 'Password reset email sent. Please check your inbox.');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Navigation will be handled automatically by AppNavigator
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleToggleAlerts = async (value) => {
    if (!user?.uid) {
      setError('No authenticated user found');
      return;
    }

    try {
      setLoading(true);
      const userRef = doc(db, 'users', user.uid);
      
      await updateDoc(userRef, {
        'settings.notifications': value
      });

      setUserSettings((prevSettings) => ({ ...prevSettings, notifications: value }));
    } catch (error) {
      console.error('Error updating alerts setting:', error);
      setError('Failed to update notification settings');
      // Revert the toggle if update fails
      setUserSettings((prevSettings) => ({ ...prevSettings, notifications: !value }));
    } finally {
      setLoading(false);
    }
  };

  const handleSupport = () => {
    Linking.openURL('mailto:support@aquasweeper.com');
  };

  const handleManual = () => {
    Linking.openURL('https://aquasweeper.com/manual');
  };

  const renderDeviceSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Connected Devices</Text>
        <TouchableOpacity onPress={handleAddDevice}>
          <MaterialCommunityIcons name="plus" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        {devices.length > 0 ? (
          devices.map((device) => (
            <DeviceItem
              key={device.macAddress} // Using MAC address as a unique key
              device={device}
              onPress={() => navigation.navigate('DeviceDetails', { device, userId: user.uid })}
            />
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No devices connected
          </Text>
        )}
      </View>
    </View>
  );

  const renderProfileSection = () => (
    <View style={styles.section}>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.profileHeader}>
          <View style={styles.profileMain}>
            <MaterialCommunityIcons name="account-circle" size={60} color={theme.textSecondary} />
            <View style={styles.profileInfo}>
              {userProfile && (
                <Text style={[styles.userName, { color: theme.text }]}>
                  {userProfile.firstName} {userProfile.lastName}
                </Text>
              )}
              <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                Member since {new Date(user?.metadata?.creationTime).toLocaleDateString()}
              </Text>
              <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                {user?.email}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleSignOut}
            style={styles.signOutIcon}
          >
            <MaterialCommunityIcons name="logout" size={24} color={theme.error} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileActions}>
          <TouchableOpacity 
            style={styles.resetPasswordButton} 
            onPress={handleResetPassword}
          >
            <MaterialCommunityIcons name="lock-reset" size={20} color={theme.primary} />
            <Text style={[styles.resetPasswordText, { color: theme.text }]}>
              Reset Password
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderPreferenceItem = (label, value, onValueChange) => (
    <View style={styles.preferenceItem}>
      <Text style={[styles.preferenceText, { color: theme.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#767577', true: theme.primary }}
        thumbColor="#ffffff"
        ios_backgroundColor="#3e3e3e"
      />
    </View>
  );

  const renderSupportItem = (title, onPress) => (
    <TouchableOpacity 
      style={styles.supportItem} 
      onPress={onPress}
    >
      <View style={styles.supportInfo}>
        <MaterialCommunityIcons 
          name={title === 'User Manual' ? 'book-open-page-variant' : 'help-circle'} 
          size={24} 
          color={theme.primary} 
        />
        <Text style={[styles.supportText, { color: theme.text }]}>{title}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textSecondary} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.error }]}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        {renderProfileSection()}
        {renderDeviceSection()}
        
        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Preferences</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            {renderPreferenceItem('Dark Mode', isDarkMode, toggleTheme)}
            {renderPreferenceItem('Notifications', userSettings?.notifications ?? true, handleToggleAlerts)}
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Support</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            {renderSupportItem('User Manual', handleManual)}
            {renderSupportItem('Contact Support', handleSupport)}
          </View>
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
    padding: 16,
  },
  section: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  profileMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  signOutIcon: {
    padding: 8,
  },
  profileActions: {
    marginTop: 16,
  },
  resetPasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  resetPasswordText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  deviceCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceCountText: {
    fontSize: 16,
    fontWeight: '500',
  },
  addDeviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  addDeviceText: {
    marginLeft: 4,
    fontSize: 16,
    fontWeight: '500',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  deviceStatus: {
    fontSize: 14,
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
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  preferenceText: {
    fontSize: 16,
  },
  supportItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  supportInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  supportText: {
    fontSize: 16,
    marginLeft: 12,
  },
  accountActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  accountActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountActionText: {
    fontSize: 16,
    marginLeft: 12,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    padding: 16,
  },
  emptyDevices: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  deviceActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  deviceAction: {
    padding: 8,
  },
});

export default SettingsScreen;