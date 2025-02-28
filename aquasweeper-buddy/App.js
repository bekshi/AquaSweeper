import 'react-native-gesture-handler';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/services/AuthContext';
import { DeviceProvider } from './src/services/DeviceContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DeviceProvider>
          <AppNavigator />
        </DeviceProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
