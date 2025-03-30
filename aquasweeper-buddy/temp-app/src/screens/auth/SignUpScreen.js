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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useTheme } from '../../services/ThemeContext';

const SignUpScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    if (loading) return;
    
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy');
      return;
    }

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createUserWithEmailAndPassword(auth, email, password);
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
          placeholder="Email"
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
        
        <View style={styles.termsContainer}>
          <TouchableOpacity
            style={[styles.checkbox, { borderColor: theme.primary }]}
            onPress={() => {
              setAcceptedTerms(!acceptedTerms);
              setError('');
            }}
            disabled={loading}
          >
            <View style={[
              styles.checkboxInner,
              acceptedTerms && { backgroundColor: theme.primary }
            ]} />
          </TouchableOpacity>
          <Text style={[styles.termsText, { color: theme.textSecondary }]}>
            I agree to the{' '}
            <Text style={[styles.link, { color: theme.primary }]}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={[styles.link, { color: theme.primary }]}>Privacy Policy</Text>
          </Text>
        </View>

        {error ? (
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
        ) : null}
        
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: theme.primary },
            (!acceptedTerms || loading) && styles.buttonDisabled
          ]}
          onPress={handleSignUp}
          disabled={!acceptedTerms || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>
        
        <View style={styles.signInContainer}>
          <Text style={[styles.signInText, { color: theme.textSecondary }]}>
            Have an Account?{' '}
          </Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('SignIn')}
            disabled={loading}
          >
            <Text style={[styles.signInLink, { color: theme.primary }]}>
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    padding: 15,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 8,
    padding: 2,
  },
  checkboxInner: {
    flex: 1,
    borderRadius: 2,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
  },
  link: {
    fontWeight: '500',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  errorText: {
    marginBottom: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  signInLink: {
    fontWeight: '600',
  },
});

export default SignUpScreen;
