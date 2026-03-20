import React, { useContext } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DashboardScreen } from '../screens/DashboardScreen';
import { CheckInScreen } from '../screens/CheckInScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { SupportScreen } from '../screens/SupportScreen';
import { TrendsScreen } from '../screens/TrendsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { CounselorChatScreen } from '../screens/CounselorChatScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { CaptureScreen } from '../screens/CaptureScreen';
import { colors } from '../theme/colors';
import { AuthContext } from '../context/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
  animationEnabled: false,
  tabBarStyle: {
    backgroundColor: colors.background,
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    height: 70,
    paddingTop: 8,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textSecondary,
  tabBarLabelStyle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  tabBarIcon: ({ color, size }) => {
    const icons = {
      Dashboard: 'speedometer-outline',
      Trends: 'analytics-outline',
      Insights: 'bulb-outline',
      Support: 'heart-outline',
      Profile: 'person-outline',
    };
    return <Ionicons name={icons[route.name]} size={size} color={color} />;
  },
});

/**
 * SplashScreen shown while app is initializing auth state
 */
const SplashScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);

/**
 * Main tab navigator shown to authenticated users
 */
const MainTabNavigator = () => (
  <Tab.Navigator
    screenOptions={screenOptions}
    sceneContainerStyle={{ backgroundColor: colors.background }}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Trends" component={TrendsScreen} />
    <Tab.Screen name="Insights" component={InsightsScreen} />
    <Tab.Screen name="Support" component={SupportScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

/**
 * AppNavigator manages navigation flow based on authentication state
 * - Splash: App is initializing
 * - Auth Stack: User not logged in (Login, Signup, Onboarding)
 * - Main Stack: User is logged in
 */
export const AppNavigator = () => {
  const { isLoading, userToken } = useContext(AuthContext);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: Platform.OS === 'ios' ? 'slide_from_right' : 'none' }}>
        {userToken == null ? (
          // Auth Stack: User is NOT logged in
          <Stack.Group>
            <Stack.Screen
              name="Onboarding"
              component={OnboardingScreen}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
            />
            <Stack.Screen
              name="Signup"
              component={SignupScreen}
              options={{
                cardStyle: { backgroundColor: colors.background },
                gestureEnabled: false,
              }}
            />
          </Stack.Group>
        ) : (
          // Main Stack: User IS logged in
          <Stack.Group>
            <Stack.Screen
              name="MainTabs"
              component={MainTabNavigator}
            />
            <Stack.Screen
              name="CounselorChat"
              component={CounselorChatScreen}
              options={{
                cardStyle: { backgroundColor: colors.background },
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="CaptureScreen"
              component={CaptureScreen}
              options={{
                cardStyle: { backgroundColor: colors.background },
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="CheckInScreen"
              component={CheckInScreen}
              options={{
                cardStyle: { backgroundColor: colors.background },
                gestureEnabled: false,
              }}
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};