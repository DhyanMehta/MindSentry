import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';

import HomeScreen from './src/screens/HomeScreen';
import ModuleTextScreen from './src/screens/ModuleTextScreen';
import ModuleVoiceScreen from './src/screens/ModuleVoiceScreen';
import DashboardScreen from './src/screens/DashboardScreen';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0b1020',
    card: '#0f162c',
    primary: '#7aa2ff',
    text: '#ffffff',
    border: '#1c2540',
  },
};

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: '#0f162c' },
          headerTintColor: '#ffffff',
          tabBarStyle: { backgroundColor: '#0f162c', borderTopColor: '#1c2540' },
          tabBarActiveTintColor: '#7aa2ff',
          tabBarInactiveTintColor: '#8ea2d9',
          tabBarIcon: ({ color, size }) => {
            const icons = {
              Home: 'home',
              Text: 'chatbubble-ellipses',
              Voice: 'mic',
              Dashboard: 'stats-chart',
            };
            return <Ionicons name={icons[route.name]} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Text" component={ModuleTextScreen} />
        <Tab.Screen name="Voice" component={ModuleVoiceScreen} />
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
