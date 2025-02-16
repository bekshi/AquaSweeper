import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { MaterialIcons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import DevicePairingScreen from '../screens/DevicePairingScreen';
import DeviceDetailsScreen from '../screens/DeviceDetailsScreen';
import InformationScreen from '../screens/InformationScreen';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import SignInScreen from '../screens/SignInScreen';
import UserProfileSetupScreen from '../screens/UserProfileSetupScreen';
import { useAuth } from '../services/AuthContext';
import { useTheme } from '../theme/ThemeContext';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const DrawerNavigator = () => {
  const { theme } = useTheme();
  
  return (
    <Drawer.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTintColor: theme.text,
        drawerStyle: {
          backgroundColor: theme.background,
        },
        drawerActiveTintColor: theme.primary,
        drawerInactiveTintColor: theme.text,
      }}
    >
      <Drawer.Screen 
        name="DrawerHome" 
        component={HomeScreen}
        options={{
          title: 'Home',
          drawerIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen 
        name="DrawerInformation" 
        component={InformationScreen}
        options={{
          title: 'Information',
          drawerIcon: ({ color, size }) => (
            <MaterialIcons name="info" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen 
        name="DrawerMaintenance" 
        component={MaintenanceScreen}
        options={{
          title: 'Maintenance',
          drawerIcon: ({ color, size }) => (
            <MaterialIcons name="build" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen 
        name="DrawerSettings" 
        component={SettingsScreen}
        options={{
          title: 'Settings',
          drawerIcon: ({ color, size }) => (
            <MaterialIcons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
};

const MainStack = () => {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTintColor: theme.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen 
        name="MainHome"
        component={DrawerNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="DevicePairing" 
        component={DevicePairingScreen}
        options={{
          title: 'Add Device',
        }}
      />
      <Stack.Screen 
        name="DeviceDetails" 
        component={DeviceDetailsScreen}
        options={{
          title: 'Device Details',
        }}
      />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const { user, profileCompleted } = useAuth();

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="SignIn" component={SignInScreen} />
      </Stack.Navigator>
    );
  }

  if (!profileCompleted) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen 
          name="UserProfileSetup" 
          component={UserProfileSetupScreen}
          options={{
            headerShown: false,
            gestureEnabled: false
          }}
        />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Main" component={MainStack} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
