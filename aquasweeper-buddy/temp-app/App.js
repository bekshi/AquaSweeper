import 'react-native-gesture-handler';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/services/AuthContext';
import { ThemeProvider } from './src/theme/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthProvider>
          <ThemeProvider>
            <AppNavigator />
          </ThemeProvider>
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
