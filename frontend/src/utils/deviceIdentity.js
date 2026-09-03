/**
 * Device Identity Utility for Consistent SSO & Device Recognition
 * Generates and persists a stable, unique client device identifier in localStorage.
 */

const STORAGE_KEY = 'd2d_client_device_id';

/**
 * Generates a standard cryptographically random UUID v4
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieves or creates a persistent client device identifier.
 */
export function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return 'server-rendered-device';

  try {
    let deviceId = localStorage.getItem(STORAGE_KEY);
    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length < 8) {
      deviceId = `d2d_${generateUUID()}`;
      localStorage.setItem(STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return 'ephemeral-browser-session';
  }
}

/**
 * Returns human-readable device display name based on client platform
 */
export function getClientDeviceDisplayName() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'Personal Device';

  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';

  if (/iPhone/i.test(ua)) return 'Apple iPhone';
  if (/iPad/i.test(ua)) return 'Apple iPad';
  if (/Macintosh|MacIntel|MacPPC|Mac68K/i.test(platform) || /Mac OS X/i.test(ua)) {
    return 'Apple Mac';
  }
  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    return 'Windows PC';
  }
  if (/Android/i.test(ua)) {
    return 'Android Device';
  }
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) {
    return 'Linux Workstation';
  }

  return 'Personal Computer';
}

/**
 * Gets HTTP headers to identify the device
 */
export function getDeviceHeaders() {
  return {
    'X-Device-Id': getOrCreateDeviceId(),
    'X-Device-Name': getClientDeviceDisplayName(),
  };
}

export default {
  getOrCreateDeviceId,
  getClientDeviceDisplayName,
  getDeviceHeaders,
};
