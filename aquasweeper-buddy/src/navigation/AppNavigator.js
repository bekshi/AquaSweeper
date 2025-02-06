import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../services/AuthContext';

// Import screens
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import InformationScreen from '../screens/InformationScreen';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ScanDevicesScreen from '../screens/ScanDevicesScreen';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
};

const DrawerNavigator = () => {
  return (
    <Drawer.Navigator>
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen name="Information" component={InformationScreen} />
      <Drawer.Screen name="Maintenance" component={MaintenanceScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
};

const MainStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="DrawerStack" 
        component={DrawerNavigator} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ScanDevices" 
        component={ScanDevicesScreen}
        options={{
          title: 'Scan Devices',
          headerStyle: {
            backgroundColor: '#4CAF50',
          },
          headerTintColor: '#fff',
        }}
      />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const { user } = useAuth();

  return (
    <NavigationContainer>
      {user ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator;
