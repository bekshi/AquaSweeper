import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  auth,
  signInWithGoogle,
  checkRedirectResult,
} from "../../services/firebase";
import { useTheme } from "../../services/ThemeContext";
import GoogleLogo from "../../components/GoogleLogo";

const SignInScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleRedirectSignIn = async () => {
      try {
        const user = await checkRedirectResult();
        if (user) {
          console.log("Successfully signed in with Google:", user.email);
          // Navigate to your main app screen here
          // navigation.navigate('Home');
        }
      } catch (error) {
        console.error("Redirect Sign In Error:", error);
        setError("Failed to complete Google sign in. Please try again.");
      }
    };

    handleRedirectSignIn();
  }, []);

  const handleSignIn = async () => {
    if (loading) return;

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Sign In Error:", error);
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const user = await signInWithGoogle();
      if (user) {
        console.log("Successfully signed in with Google:", user.email);
        // Navigate to your main app screen here
        // navigation.navigate('Home');
      }
    } catch (error) {
      console.error("Google Sign In Error:", error);
      setError("Failed to sign in with Google. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Sign In</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Hi there! Nice to see you again.
        </Text>

        {error ? (
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
        ) : null}

        <TextInput
          style={[
            styles.input,
            {
              borderColor: theme.border,
              backgroundColor: theme.surface,
              color: theme.text,
            },
          ]}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={[
            styles.input,
            {
              borderColor: theme.border,
              backgroundColor: theme.surface,
              color: theme.text,
            },
          ]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.signInButton, { backgroundColor: theme.primary }]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.signInButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
              <GoogleLogo size={20} />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate("ForgotPassword")}
          style={styles.link}
          disabled={loading}
        >
          <Text style={[styles.linkText, { color: theme.primary }]}>
            Forgot Password?
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate("SignUp")}
          style={styles.link}
          disabled={loading}
        >
          <Text style={[styles.linkText, { color: theme.primary }]}>
            Don't have an account? Sign Up
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
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  signInButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  signInButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  googleButtonText: {
    color: "#757575",
    fontSize: 16,
    fontWeight: "500",
    marginRight: 12,
  },
  link: {
    padding: 8,
    marginTop: 16,
  },
  linkText: {
    fontSize: 14,
    textAlign: "center",
  },
  errorText: {
    marginBottom: 16,
    textAlign: "center",
  },
});

export default SignInScreen;
