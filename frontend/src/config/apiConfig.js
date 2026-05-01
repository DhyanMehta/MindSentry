/**
 * Centralized API configuration for React Native / Expo.
 * Root cause: localhost resolves differently across environments.
 * - Android emulator cannot use localhost for host machine services.
 * - iOS simulator can use localhost.
 * - Physical devices require LAN IP or a tunneled/public URL.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';


const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const extractHostFromExpo = () => {
    const hostUri =
        Constants.expoConfig?.hostUri ||
        Constants.manifest?.debuggerHost ||
        Constants.manifest2?.extra?.expoGo?.debuggerHost ||
        '';

    if (!hostUri || typeof hostUri !== 'string') return null;

    const host = hostUri.split(':')[0]?.trim();
    if (!host) return null;
    return host;
};

const getConfiguredOverride = () => {
    const envUrl = process.env.EXPO_PUBLIC_API_URL || process.env.REACT_APP_API_URL;
    const appJsonUrl = Constants.expoConfig?.extra?.apiUrl;

    // const raw = envUrl || appJsonUrl || (DEV_LAN_IP ? `http://${DEV_LAN_IP}:8000` : '');
    const raw = envUrl || appJsonUrl;
    if (!raw || typeof raw !== 'string') return null;

    return trimTrailingSlash(raw.trim());
};

const getDefaultDevBaseUrl = () => {
    // If Expo provides a non-local host, prefer it. This handles physical devices
    // (and some emulator setups) where localhost/10.0.2.2 is not valid.
    const expoHost = extractHostFromExpo();
    if (expoHost && expoHost !== 'localhost' && expoHost !== '127.0.0.1') {
        return `http://${expoHost}:8000`;
    }

    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:8000';
    }

    if (Platform.OS === 'ios') {
        return 'http://localhost:8000';
    }

    return 'http://localhost:8000';
};

export const getApiBaseUrl = () => {
    const override = getConfiguredOverride();
    if (override) return override;

    if (__DEV__) {
        return getDefaultDevBaseUrl();
    }

    // Production fallback should be overridden by EXPO_PUBLIC_API_URL/app.json extra.apiUrl.
    return 'https://api.mindsentry.com';
};

export const API_BASE_URL = getApiBaseUrl();

export const buildApiUrl = (path) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
};

export const API_CONFIG = {
    BASE_URL: API_BASE_URL,
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 0,
};

if (__DEV__) {
    console.log('[API Config] Platform:', Platform.OS);
    console.log('[API Config] Expo Host:', extractHostFromExpo());
    console.log('[API Config] Base URL:', API_BASE_URL);
}
