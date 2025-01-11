import React, { useState, useEffect } from 'react';
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
import { useAuth } from '../services/AuthContext';
import { useTheme } from '../services/ThemeContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase';

const SettingsScreen = () => {
  const { user, signOut } = useAuth();
  const { isDarkMode, toggleTheme, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [userSettings, setUserSettings] = useState(null);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [mockDevice] = useState({
    id: 'AS-001',
    name: 'Backyard Pool Skimmer',
    status: 'Connected',
    lastSync: new Date(),
  });

  useEffect(() => {
    fetchUserSettings();
  }, []);

  const fetchUserSettings = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserSettings(data);
        setAlertsEnabled(data.alertsEnabled);
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      Alert.alert('Error', 'Failed to load user settings');
    } finally {
      setLoading(false);
    }
  };

  const handleAlertsToggle = async () => {
    try {
      const newAlertsEnabled = !alertsEnabled;
      await updateDoc(doc(db, 'users', user.uid), {
        alertsEnabled: newAlertsEnabled,
      });
      setAlertsEnabled(newAlertsEnabled);
    } catch (error) {
      console.error('Error updating alerts setting:', error);
      Alert.alert('Error', 'Failed to update alerts preference');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          onPress: signOut,
          style: 'destructive',
        },
      ]
    );
  };

  const handleSupport = () => {
    Linking.openURL('mailto:support@aquasweeper.com');
  };

  const handleManual = () => {
    Linking.openURL('https://aquasweeper.com/manual');
  };

  const handlePasswordReset = async () => {
    try {
      await sendPasswordResetEmail(auth, user.email);
      Alert.alert(
        'Password Reset Email Sent',
        'Check your email for instructions to reset your password.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to send password reset email. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleAutoUpdateToggle = async () => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        autoUpdate: !userSettings.autoUpdate,
      });
      setUserSettings({ ...userSettings, autoUpdate: !userSettings.autoUpdate });
    } catch (error) {
      console.error('Error updating auto-update setting:', error);
      Alert.alert('Error', 'Failed to update auto-update preference');
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* User Profile Section */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.profileHeader}>
            {userSettings?.profilePicture ? (
              <Image
                source={{ uri: userSettings.profilePicture }}
                style={styles.profileImage}
              />
            ) : (
              <MaterialCommunityIcons name="account-circle" size={60} color={theme.textSecondary} />
            )}
            <View style={styles.profileInfo}>
              <Text style={[styles.userName, { color: theme.text }]}>{userSettings?.name || 'User'}</Text>
              <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{user.email}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.settingItem} 
            onPress={handlePasswordReset}
          >
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="lock-reset" size={24} color={theme.primary} />
              <Text style={[styles.settingText, { color: theme.text }]}>Reset Password</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Connected Devices Section */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="devices" size={24} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Connected Devices</Text>
          </View>
          <View style={styles.deviceItem}>
            <View style={styles.deviceInfo}>
              <Text style={[styles.deviceName, { color: theme.text }]}>{mockDevice.name}</Text>
              <Text style={[styles.deviceId, { color: theme.textSecondary }]}>ID: {mockDevice.id}</Text>
              <View style={styles.deviceStatus}>
                <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
                <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                  {mockDevice.status} • Last synced {formatDate(mockDevice.lastSync)}
                </Text>
              </View>
            </View>
          </View>
          {userSettings?.connectedDevices?.map((device) => (
            <View key={device.deviceId} style={styles.deviceItem}>
              <View style={styles.deviceInfo}>
                <Text style={[styles.deviceName, { color: theme.text }]}>{device.deviceName}</Text>
                <Text style={[styles.deviceId, { color: theme.textSecondary }]}>ID: {device.deviceId}</Text>
                <View style={styles.deviceStatus}>
                  <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
                  <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                    Connected • Last synced {formatDate(device.addedAt)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Preferences Section */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="cog" size={24} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Preferences</Text>
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="theme-light-dark" size={24} color={theme.textSecondary} />
              <Text style={[styles.settingText, { color: theme.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: theme.primary }}
              thumbColor={'#fff'}
              ios_backgroundColor="#767577"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="bell" size={24} color={theme.textSecondary} />
              <Text style={[styles.settingText, { color: theme.text }]}>Notifications</Text>
            </View>
            <Switch
              value={alertsEnabled}
              onValueChange={handleAlertsToggle}
              trackColor={{ false: '#767577', true: theme.primary }}
              thumbColor={'#fff'}
              ios_backgroundColor="#767577"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="update" size={24} color={theme.textSecondary} />
              <Text style={[styles.settingText, { color: theme.text }]}>Auto-Update</Text>
            </View>
            <Switch
              value={userSettings?.autoUpdate}
              onValueChange={handleAutoUpdateToggle}
              trackColor={{ false: '#767577', true: theme.primary }}
              thumbColor={'#fff'}
              ios_backgroundColor="#767577"
            />
          </View>
        </View>

        {/* Support Section */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity style={styles.settingItem} onPress={handleSupport}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="email" size={24} color={theme.primary} />
              <Text style={[styles.settingText, { color: theme.text }]}>Contact Support</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleManual}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="book-open-page-variant" size={24} color={theme.primary} />
              <Text style={[styles.settingText, { color: theme.text }]}>User Manual</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TouchableOpacity 
            style={styles.settingItem} 
            onPress={handleSignOut}
          >
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="logout" size={24} color={theme.error} />
              <Text style={[styles.settingText, { color: theme.error }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* App Info Section */}
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="information" size={24} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>App Info</Text>
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="tag" size={24} color={theme.textSecondary} />
              <Text style={[styles.settingText, { color: theme.text }]}>Version</Text>
            </View>
            <Text style={[styles.settingValue, { color: theme.textSecondary }]}>1.0.0</Text>
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="copyright" size={24} color={theme.textSecondary} />
              <Text style={[styles.settingText, { color: theme.text }]}> 2025 AquaSweeper</Text>
            </View>
          </View>
        </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  lastSection: {
    borderBottomWidth: 0,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  profileHeader: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: 8,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    marginLeft: 12,
  },
  settingValue: {
    fontSize: 16,
  },
  deviceItem: {
    padding: 16,
  },
  deviceInfo: {
    marginLeft: 12,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 14,
    marginBottom: 4,
  },
  deviceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  preferenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preferenceText: {
    fontSize: 16,
    marginLeft: 12,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
  },
});

export default SettingsScreen;
