import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/services/AuthContext';
import { ThemeProvider } from './src/theme/ThemeContext';
import { DeviceProvider } from './src/services/DeviceContext';
import AppNavigator from './src/navigation/AppNavigator';
import AppInitializer from './src/services/AppInitializer';

export default function App() {
  useEffect(() => {
    AppInitializer.initialize();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthProvider>
          <ThemeProvider>
            <DeviceProvider>
              <AppNavigator />
            </DeviceProvider>
          </ThemeProvider>
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
