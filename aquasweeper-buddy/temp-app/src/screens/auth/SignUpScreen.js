import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { createUser } from '../../services/firebase'; 
import { useTheme } from '../../services/ThemeContext';

const SignUpScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    if (loading) return;
    
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy');
      return;
    }

    if (!email || !password || !name) {
      setError('Please fill in all required fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const now = new Date();
      const userData = {
        email,
        name,
        phoneNumber: phoneNumber || '',
        alertsEnabled: true,
        appTheme: 'dark',
        cleaningPreference: {
          cleaningDuration: 120,
          cleaningFrequency: 'daily',
          startTime: 8
        },
        connectedDevices: [],
        createdAt: now,
        lastLogin: now,
        notificationsToken: '',
        profilePicture: '',
        acceptedTerms
      };

      await createUser(email, password, userData);
      // Navigation will be handled by the auth state listener
    } catch (error) {
      console.error('Sign up error:', error);
      switch (error.code) {
        case 'auth/email-already-in-use':
          setError('This email is already registered. Please sign in instead.');
          break;
        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;
        case 'auth/weak-password':
          setError('Password is too weak. Please use a stronger password.');
          break;
        default:
          setError('An error occurred during sign up. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={styles.content}> 
        <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
        
        <TextInput
          style={[styles.input, { 
            borderColor: theme.border,
            backgroundColor: theme.surface,
            color: theme.text,
          }]}
          placeholder="Full Name *"
          placeholderTextColor={theme.textSecondary}
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError('');
          }}
          editable={!loading}
        />

        <TextInput
          style={[styles.input, { 
            borderColor: theme.border,
            backgroundColor: theme.surface,
            color: theme.text,
          }]}
          placeholder="Email *"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError('');
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
        />

        <TextInput
          style={[styles.input, { 
            borderColor: theme.border,
            backgroundColor: theme.surface,
            color: theme.text,
          }]}
          placeholder="Phone Number (Optional)"
          placeholderTextColor={theme.textSecondary}
          value={phoneNumber}
          onChangeText={(text) => {
            setPhoneNumber(text);
            setError('');
          }}
          keyboardType="phone-pad"
          editable={!loading}
        />

        <TextInput
          style={[styles.input, { 
            borderColor: theme.border,
            backgroundColor: theme.surface,
            color: theme.text,
          }]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError('');
          }}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity 
          style={styles.termsContainer}
          onPress={() => setAcceptedTerms(!acceptedTerms)}
          disabled={loading}
        >
          <View style={[
            styles.checkbox,
            { borderColor: theme.border },
            acceptedTerms && { backgroundColor: theme.primary }
          ]} />
          <Text style={[styles.termsText, { color: theme.text }]}> 
            I accept the Terms of Service and Privacy Policy
          </Text>
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.primary },
            loading && styles.buttonDisabled
          ]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.textPrimary} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.textPrimary }]}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('SignIn')}
          disabled={loading}
        >
          <Text style={[styles.linkText, { color: theme.primary }]}> 
            Already have an account? Sign In
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ff3b30',
    marginTop: 10,
    textAlign: 'center',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 10,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
  },
  linkButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
  },
});

export default SignUpScreen;