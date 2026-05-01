import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

/**
 * Requests only the essential wellness permissions after the user is authenticated.
 * This avoids prompting anonymous users and keeps the permission set intentionally small.
 */
const PERMISSION_BOOTSTRAP_PREFIX = 'mindsentry_permissions_bootstrapped_v1';

const buildPermissionKey = (userId) => `${PERMISSION_BOOTSTRAP_PREFIX}_${userId}`;

export const hasCompletedEssentialPermissionBootstrap = async (userId) => {
  if (!userId) return false;
  try {
    const value = await SecureStore.getItemAsync(buildPermissionKey(userId));
    return value === 'done';
  } catch (error) {
    console.warn('[Permissions] Failed to read bootstrap state:', error?.message || error);
    return false;
  }
};

const markEssentialPermissionBootstrapDone = async (userId) => {
  if (!userId) return;
  try {
    await SecureStore.setItemAsync(buildPermissionKey(userId), 'done');
  } catch (error) {
    console.warn('[Permissions] Failed to store bootstrap state:', error?.message || error);
  }
};

export const requestEssentialPermissionsForUser = async (userId) => {
  const result = {
    location: 'unknown',
    camera: 'unknown',
    microphone: 'unknown',
  };

  if (!userId) {
    return result;
  }

  const alreadyBootstrapped = await hasCompletedEssentialPermissionBootstrap(userId);
  if (alreadyBootstrapped) {
    return { ...result, skipped: true };
  }

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

  await markEssentialPermissionBootstrapDone(userId);
  console.log('[Permissions] Essential permission results:', result);
  return result;
};
