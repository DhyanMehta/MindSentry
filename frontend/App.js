import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { requestStartupPermissions } from './src/utils/permissionBootstrap';

enableScreens();

export default function App() {
  useEffect(() => {
    requestStartupPermissions().catch((err) => {
      console.warn('[Permissions] Startup permission bootstrap failed:', err?.message || err);
    });
  }, []);

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </SafeAreaProvider>
    </AuthProvider>
  );
}
