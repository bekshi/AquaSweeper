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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Animated } from 'react-native';
import deviceConnectionService from '../services/DeviceConnectionService';
import { useTheme } from '../theme/ThemeContext';

const PulsingStatusIndicator = ({ status }) => {
  const pulseAnim = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#4CAF50'; // Green
      case 'reconnecting':
        return '#FFA500'; // Amber
      case 'disconnected':
        return '#FF3B30'; // Red
      default:
        return '#808080'; // Gray
    }
  };

  return (
    <Animated.View
      style={[
        styles.statusDot,
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
  const [deviceStatus, setDeviceStatus] = useState('disconnected');
  const [lastPing, setLastPing] = useState(null);

  React.useEffect(() => {
    // Start checking device connection
    const checkConnection = async () => {
      try {
        console.log('Checking connection to device:', device);
        if (!device.ipAddress) {
          console.log('No IP address for device:', device);
          return;
        }
        
        // Simple timeout promise
        const fetchWithTimeout = async (url, options = {}, timeout = 3000) => {
          try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, {
              ...options,
              signal: controller.signal,
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
            
            clearTimeout(id);
            return response;
          } catch (error) {
            if (error.name === 'AbortError') {
              console.log('Fetch request timed out');
            }
            throw error;
          }
        };
        
        try {
          // Try to connect to the device with a longer timeout
          const response = await fetchWithTimeout(
            `http://${device.ipAddress}/discover?nocache=${Date.now()}`, 
            {}, 
            3000
          );
          
          if (response.ok) {
            setDeviceStatus('connected');
            setLastPing(Date.now());
          } else {
            setDeviceStatus(lastPing && Date.now() - lastPing < 10000 ? 'reconnecting' : 'disconnected');
          }
        } catch (error) {
          console.log('Error checking device connection:', error.name, error.message);
          // If we had a successful ping recently, show reconnecting instead of disconnected
          setDeviceStatus(lastPing && Date.now() - lastPing < 10000 ? 'reconnecting' : 'disconnected');
        }
      } catch (error) {
        console.log('Error in connection check outer block:', error);
        setDeviceStatus('disconnected');
      }
    };

    // Check less frequently to reduce network traffic
    const interval = setInterval(checkConnection, 10000);
    checkConnection(); // Initial check

    return () => clearInterval(interval);
  }, [device.ipAddress, lastPing]);

  return (
    <TouchableOpacity
      style={[styles.deviceItem, { backgroundColor: theme.surface }]}
      onPress={onPress}
    >
      <View style={styles.deviceInfo}>
        <PulsingStatusIndicator status={deviceStatus} />
        <Text style={[styles.deviceName, { color: theme.text, marginLeft: 10 }]}>
          {device.name || `AquaSweeper-${device.id || ''}`}
        </Text>
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
  const { isDarkMode, toggleTheme, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [userProfile, setUserProfile] = useState(null);

  // Fetch connected devices
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        
        // Make sure we're getting the devices from the correct field
        const devices = userData.connectedDevices || [];
        console.log('Connected devices from Firestore:', devices);
        
        // Ensure each device has required properties
        const validDevices = devices.map(device => ({
          ...device,
          // Ensure id exists
          id: device.id || device.deviceId || `device-${Date.now()}`,
          // Ensure name is properly formatted
          name: device.name || `AquaSweeper-${device.id || ''}`,
          // Ensure ipAddress exists for connection checks
          ipAddress: device.ipAddress || device.ip || '192.168.0.1'
        }));
        
        setConnectedDevices(validDevices);
        console.log('Processed connected devices:', validDevices);
        setLoading(false);
      }
    }, (error) => {
      console.error('Error getting user data:', error);
      setError('Failed to load devices');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, [user]);

  const handleAddDevice = () => {
    navigation.navigate('DevicePairing');
  };

  const handleRemoveDevice = async (deviceId) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const devices = userData.connectedDevices.filter(device => device.id !== deviceId);
      await updateDoc(userRef, {
        connectedDevices: devices
      });
    } catch (error) {
      console.error('Error removing device:', error);
      Alert.alert('Error', 'Failed to remove device');
    }
  };

  const handleDevicePress = (device) => {
    navigation.navigate('DeviceDetails', { device });
  };

  // Load dark mode preference from AsyncStorage and sync with theme context
  useEffect(() => {
    const loadDarkModePreference = async () => {
      try {
        const darkMode = await AsyncStorage.getItem('darkMode');
        if (darkMode !== null && JSON.parse(darkMode) !== isDarkMode) {
          toggleTheme();
        }
      } catch (error) {
        console.error('Error loading dark mode preference:', error);
      }
    };

    loadDarkModePreference();
  }, []);

  const handleToggleDarkMode = async () => {
    try {
      await AsyncStorage.setItem('darkMode', (!isDarkMode).toString());
      toggleTheme();
    } catch (error) {
      console.error('Error saving dark mode preference:', error);
    }
  };

  const handleResetPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      Alert.alert(
        'Password Reset',
        'Check your email for password reset instructions.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error sending reset email:', error);
      Alert.alert('Error', 'Failed to send password reset email');
    }
  };

  const renderDevices = () => {
    if (loading) {
      return <ActivityIndicator size="large" color={theme.primary} />;
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        </View>
      );
    }

    if (connectedDevices.length === 0) {
      return (
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No devices connected
        </Text>
      );
    }

    return connectedDevices.map((device) => (
      <DeviceItem
        key={device.id}
        device={device}
        onPress={() => handleDevicePress(device)}
      />
    ));
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

      // setUserSettings((prevSettings) => ({ ...prevSettings, notifications: value }));
    } catch (error) {
      console.error('Error updating alerts setting:', error);
      setError('Failed to update notification settings');
      // Revert the toggle if update fails
      // setUserSettings((prevSettings) => ({ ...prevSettings, notifications: !value }));
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

  const renderProfileSection = () => (
    <View style={styles.section}>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.profileHeader}>
          <View style={styles.profileMain}>
            <MaterialCommunityIcons name="account-circle" size={48} color={theme.textSecondary} />
            <View style={styles.profileInfo}>
              <Text style={[styles.userName, { color: theme.text }]}>
                {userProfile?.firstName} {userProfile?.lastName}
              </Text>
              <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                {user?.email}
              </Text>
              <Text style={[styles.userMemberSince, { color: theme.textSecondary }]}>
                Member since {new Date(user?.metadata?.creationTime).toLocaleDateString()}
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

  const renderPreferenceItem = (label, value, onToggle) => (
    <View style={styles.preferenceItem}>
      <Text style={[styles.preferenceText, { color: theme.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#767577', true: theme.primary }}
        thumbColor={value ? theme.surface : '#f4f3f4'}
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
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Paired Devices</Text>
            <TouchableOpacity onPress={handleAddDevice}>
              <MaterialCommunityIcons name="plus" size={24} color={theme.primary} />
            </TouchableOpacity>
          </View>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            {renderDevices()}
          </View>
        </View>
        
        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Preferences</Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            {renderPreferenceItem('Dark Mode', isDarkMode, handleToggleDarkMode)}
            {renderPreferenceItem('Notifications', true, handleToggleAlerts)}
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
    alignItems: 'center',
    padding: 16,
  },
  profileMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  signOutIcon: {
    padding: 8,
    marginLeft: 16,
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
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
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
  noDevices: {
    padding: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorContainer: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addDeviceButtonText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  emptyContainer: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#808080',
    marginBottom: 2,
  },
  userMemberSince: {
    fontSize: 12,
    color: '#808080',
  },
  profileActions: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
  },
  resetPasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  resetPasswordText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
});

export default SettingsScreen;