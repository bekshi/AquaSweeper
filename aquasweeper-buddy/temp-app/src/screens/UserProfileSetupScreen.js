import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { auth, db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../services/AuthContext';

const UserProfileSetupScreen = () => {
  const { theme } = useTheme();
  const { checkProfileCompletion } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'Please enter your first and last name');
      return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Update user document with profile information
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim() || '',
        settings: {
          notifications: true,
          darkMode: false,
          cleaningSchedule: 'weekly',
        },
        profileCompleted: true,
      }, { merge: true });

      // Trigger profile completion check which will auto-navigate
      await checkProfileCompletion(user);
      
      console.log('Profile setup completed successfully');
    } catch (error) {
      console.error('Error completing profile:', error);
      Alert.alert(
        'Error',
        'Failed to complete profile setup. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <Text style={[styles.title, { color: theme.text }]}>Complete Your Profile</Text>

        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
          placeholder="First Name"
          placeholderTextColor={theme.textSecondary}
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
        />

        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
          placeholder="Last Name"
          placeholderTextColor={theme.textSecondary}
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
        />

        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text }]}
          placeholder="Phone Number"
          placeholderTextColor={theme.textSecondary}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
        />

        <TouchableOpacity
          style={[styles.button, { 
            backgroundColor: theme.primary,
            opacity: loading ? 0.7 : 1
          }]}
          onPress={handleComplete}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Completing Setup...' : 'Complete Setup'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 20 : 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default UserProfileSetupScreen;
