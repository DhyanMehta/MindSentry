import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { DashboardScreen } from '../screens/DashboardScreen';
import { CheckInScreen } from '../screens/CheckInScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { SupportScreen } from '../screens/SupportScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.divider,
    primary: colors.primary,
  },
};

const screenOptions = ({ route }) => ({
  headerShown: false,
  tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.divider },
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textSecondary,
  tabBarIcon: ({ color, size }) => {
    const icons = {
      Dashboard: 'speedometer-outline',
      CheckIn: 'chatbubbles-outline',
      Insights: 'analytics-outline',
      Support: 'heart-outline',
    };
    return <Ionicons name={icons[route.name]} size={size} color={color} />;
  },
});

export const AppNavigator = () => {
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="CheckIn" component={CheckInScreen} options={{ title: 'Check-in' }} />
        <Tab.Screen name="Insights" component={InsightsScreen} />
        <Tab.Screen name="Support" component={SupportScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
