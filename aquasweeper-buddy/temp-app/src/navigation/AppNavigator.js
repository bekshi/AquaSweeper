import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import InformationScreen from '../screens/InformationScreen';
import MaintenanceScreen from '../screens/MaintenanceScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import { useAuth } from '../services/AuthContext';
import { useTheme } from '../services/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="SignIn" component={SignInScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
);

const MainNavigator = ({ theme }) => (
  <Drawer.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: theme.background,
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      headerTintColor: theme.text,
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      drawerStyle: {
        backgroundColor: theme.background,
      },
      drawerActiveTintColor: theme.primary,
      drawerInactiveTintColor: theme.textSecondary,
      drawerItemStyle: {
        paddingLeft: 0,
        marginLeft: 0,
      },
      drawerLabelStyle: {
        marginLeft: 0,
      },
      drawerIcon: {
        marginRight: 0,
      },
      sceneContainerStyle: {
        backgroundColor: theme.background,
      },
    }}
  >
    <Drawer.Screen
      name="Home"
      component={HomeScreen}
      options={{
        drawerIcon: ({ color }) => (
          <MaterialCommunityIcons name="home" size={24} color={color} />
        ),
      }}
    />
    <Drawer.Screen
      name="Information"
      component={InformationScreen}
      options={{
        drawerIcon: ({ color }) => (
          <MaterialCommunityIcons name="information" size={24} color={color} />
        ),
      }}
    />
    <Drawer.Screen
      name="Maintenance"
      component={MaintenanceScreen}
      options={{
        drawerIcon: ({ color }) => (
          <MaterialCommunityIcons name="tools" size={24} color={color} />
        ),
      }}
    />
    <Drawer.Screen
      name="Settings"
      component={SettingsScreen}
      options={{
        drawerIcon: ({ color }) => (
          <MaterialCommunityIcons name="cog" size={24} color={color} />
        ),
      }}
    />
  </Drawer.Navigator>
);

const AppNavigator = () => {
  const { user } = useAuth();
  const { theme } = useTheme();

  return user ? <MainNavigator theme={theme} /> : <AuthNavigator />;
};

export default AppNavigator;
