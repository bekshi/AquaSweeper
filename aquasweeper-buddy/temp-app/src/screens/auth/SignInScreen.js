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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useTheme } from '../../services/ThemeContext';

const SignInScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    if (loading) return;
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Sign in error:', error);
      switch (error.code) {
        case 'auth/invalid-credential':
          setError('Invalid email or password. Please try again.');
          break;
        case 'auth/user-disabled':
          setError('This account has been disabled. Please contact support.');
          break;
        case 'auth/user-not-found':
          setError('No account found with this email. Please sign up first.');
          break;
        case 'auth/wrong-password':
          setError('Invalid email or password. Please try again.');
          break;
        default:
          setError('An error occurred during sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Sign In</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Hi there! Nice to see you again.
        </Text>
        
        <TextInput
          style={[styles.input, { 
            borderColor: theme.border,
            backgroundColor: theme.surface,
            color: theme.text,
          }]}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={setEmail}
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
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        {error ? (
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
        ) : null}
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => navigation.navigate('ForgotPassword')}
          style={styles.link}
        >
          <Text style={[styles.linkText, { color: theme.textSecondary }]}>Forgot Password?</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => navigation.navigate('SignUp')}
          style={styles.link}
        >
          <Text style={[styles.linkText, { color: theme.textSecondary }]}>Sign Up</Text>
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
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    padding: 15,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    marginTop: -8,
    marginBottom: 8,
    fontSize: 14,
  },
  link: {
    padding: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 16,
  },
});

export default SignInScreen;
