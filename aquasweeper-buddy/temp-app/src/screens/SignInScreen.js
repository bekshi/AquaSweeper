import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useTheme } from '../theme/ThemeContext';
import { useNavigation } from '@react-navigation/native';

const SignInScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { theme } = useTheme();

  const createUserDocument = async (userUID) => {
    try {
      console.log('Creating user document for:', userUID);
      const userRef = doc(db, 'users', userUID);
      await setDoc(userRef, {
        uid: userUID,
        email: email,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        settings: {
          notifications: true,
          darkMode: false,
          cleaningSchedule: 'weekly',
        },
        skimmers: [],
        stats: {
          totalCleaningSessions: 0,
          totalDebrisCollected: 0,
          averageSessionDuration: 0,
        },
        profileCompleted: false,
      });
      console.log('User document created successfully');
    } catch (error) {
      console.error('Error creating user document:', error);
      throw error;
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      if (isSignUp) {
        console.log('Starting sign up process');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Wait a moment for auth state to fully propagate
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Auth user created, creating document');
        await createUserDocument(userCredential.user.uid);
        
        // No need to navigate - AppNavigator will handle it
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      console.error('Full error object:', error);
      let message = 'An error occurred during authentication';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = 'Invalid email or password';
      } else if (error.code === 'auth/email-already-in-use') {
        message = 'Email is already registered';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters';
      }
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.form}>
        <Text style={[styles.title, { color: theme.text }]}>
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </Text>
        
        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.inputBackground,
            color: theme.inputText,
            borderColor: theme.border,
            borderWidth: 1
          }]}
          placeholder="Email"
          placeholderTextColor={theme.placeholderText}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.inputBackground,
            color: theme.inputText,
            borderColor: theme.border,
            borderWidth: 1
          }]}
          placeholder="Password"
          placeholderTextColor={theme.placeholderText}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setIsSignUp(!isSignUp)}
        >
          <Text style={[styles.switchText, { color: theme.primary }]}>
            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
  },
});

export default SignInScreen;
