/**
 * API Configuration for MindSentry
 * Automatically detects the correct API URL for development environment
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Get the appropriate API base URL based on the environment
 * 
 * Priority:
 * 1. Environment variable (if set)
 * 2. manifest.extra.apiUrl (from app.json)
 * 3. Auto-detect based on platform:
 *    - Android Emulator: 10.0.2.2:8000
 *    - iOS Simulator: localhost:8000
 *    - Expo Go on device: Uses debuggerHost IP
 */
const getApiUrl = () => {
  // 1. Check for environment variable (production/staging)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // 2. Check app.json extra config
  if (Constants.expoConfig?.extra?.apiUrl) {
    return Constants.expoConfig.extra.apiUrl;
  }

  // 3. Auto-detect for development
  if (__DEV__) {
    // For Expo Go on physical device, use the debugger host IP
    // Try multiple manifest APIs (newer SDK versions use expoConfig)
    const debuggerHost = 
      Constants.expoConfig?.hostUri?.split(':')[0] ||
      Constants.manifest?.debuggerHost?.split(':')[0] ||
      Constants.manifest2?.extra?.expoGo?.debuggerHost?.split(':')[0];
    
    if (debuggerHost) {
      // If we have a debugger host, we're likely in Expo Go on a physical device
      // Check if it's not localhost (which would indicate simulator)
      if (debuggerHost !== 'localhost' && debuggerHost !== '127.0.0.1') {
        return `http://${debuggerHost}:8000`;
      }
    }

    // For Android Emulator (only if no debugger host found)
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8000';
    }

    // For iOS Simulator and web
    return 'http://localhost:8000';
  }

  // Production fallback (update with your production API URL)
  return 'https://api.mindsentry.com';
};

export const API_CONFIG = {
  BASE_URL: getApiUrl(),
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
};

// Log the API URL in development for debugging
if (__DEV__) {
  console.log('🔗 API Base URL:', API_CONFIG.BASE_URL);
  console.log('📱 Platform:', Platform.OS);
  
  const debuggerHost = 
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost;
  
  if (debuggerHost) {
    console.log('🔍 Debugger Host:', debuggerHost);
  }
  console.log('📦 App Ownership:', Constants.appOwnership);
}
