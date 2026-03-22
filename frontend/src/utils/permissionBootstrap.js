import { Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

/**
 * Requests core local permissions at app startup.
 * Keeps failures non-blocking so app still opens.
 */
export const requestStartupPermissions = async () => {
    const result = {
        location: 'unknown',
        camera: 'unknown',
        microphone: 'unknown',
        callPhone: Platform.OS === 'android' ? 'unknown' : 'not_applicable',
    };

    try {
        const locationPerm = await Location.requestForegroundPermissionsAsync();
        result.location = locationPerm.status;
    } catch (err) {
        result.location = 'error';
        console.warn('[Permissions] Location request failed:', err?.message || err);
    }

    try {
        const cameraPerm = await Camera.requestCameraPermissionsAsync();
        result.camera = cameraPerm.status;
    } catch (err) {
        result.camera = 'error';
        console.warn('[Permissions] Camera request failed:', err?.message || err);
    }

    try {
        const micPerm = await Audio.requestPermissionsAsync();
        result.microphone = micPerm.status;
    } catch (err) {
        result.microphone = 'error';
        console.warn('[Permissions] Microphone request failed:', err?.message || err);
    }

    if (Platform.OS === 'android') {
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.CALL_PHONE,
                {
                    title: 'Phone Call Permission',
                    message: 'MindSentry uses this to place emergency phone calls when requested by you.',
                    buttonPositive: 'Allow',
                    buttonNegative: 'Deny',
                }
            );
            result.callPhone = granted;
        } catch (err) {
            result.callPhone = 'error';
            console.warn('[Permissions] CALL_PHONE request failed:', err?.message || err);
        }
    }

    console.log('[Permissions] Startup permission results:', result);
    return result;
};
