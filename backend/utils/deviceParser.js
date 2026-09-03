import UAParser from 'ua-parser-js';
import crypto from 'crypto';

/**
 * Extracts and cleans the client IP address from proxy headers
 */
export const getClientIp = (req) => {
  if (!req) return 'Unknown';

  const forwarded = req.headers?.['x-forwarded-for'];
  let ip = '';
  if (forwarded) {
    ip = String(forwarded).split(',')[0].trim();
  } else {
    ip =
      req.headers?.['cf-connecting-ip'] ||
      req.headers?.['x-real-ip'] ||
      req.ip ||
      req.connection?.remoteAddress ||
      '';
  }

  // Strip IPv6-mapped IPv4 prefix (e.g. ::ffff:10.1.16.224 -> 10.1.16.224)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  if (ip === '::1' || ip === '127.0.0.1') {
    return '127.0.0.1';
  }

  return ip || 'Unknown';
};

/**
 * Parses request device information into a standardized representation
 */
export const parseDeviceInfo = (req) => {
  const userAgent = req.headers?.['user-agent'] || '';
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  // 1. IP extraction
  const ip = getClientIp(req);

  // 2. Client-provided device identity (from persistent localStorage or body)
  const clientProvidedId =
    req.headers?.['x-device-id'] ||
    req.body?.deviceId ||
    req.query?.deviceId;

  const clientProvidedName = req.headers?.['x-device-name'];

  // 3. Standardize Operating System
  const rawOsName = result.os.name || '';
  const rawOsVersion = result.os.version || '';
  let osName = rawOsName;
  let osDisplay = '';
  let brand = 'generic';

  if (/mac\s*os|darwin|macos/i.test(rawOsName) || /macintosh|mac os x/i.test(userAgent)) {
    osName = 'macOS';
    brand = 'apple';
    // Mac OS 10.15.7 is the standard frozen UA reported by modern Chromium/Safari
    osDisplay = rawOsVersion ? `macOS ${rawOsVersion}` : 'macOS';
  } else if (/windows/i.test(rawOsName)) {
    osName = 'Windows';
    brand = 'microsoft';
    osDisplay = rawOsVersion ? `Windows ${rawOsVersion}` : 'Windows';
  } else if (/ios/i.test(rawOsName) || /iphone|ipad/i.test(userAgent)) {
    osName = 'iOS';
    brand = 'apple';
    osDisplay = rawOsVersion ? `iOS ${rawOsVersion}` : 'iOS';
  } else if (/android/i.test(rawOsName)) {
    osName = 'Android';
    brand = 'android';
    osDisplay = rawOsVersion ? `Android ${rawOsVersion}` : 'Android';
  } else if (/linux/i.test(rawOsName)) {
    osName = 'Linux';
    brand = 'linux';
    osDisplay = rawOsVersion ? `Linux (${rawOsVersion})` : 'Linux';
  } else {
    osDisplay = `${rawOsName} ${rawOsVersion}`.trim() || 'Unknown OS';
  }

  // 4. Standardize Browser
  const rawBrowserName = result.browser.name || '';
  const rawBrowserVersion = result.browser.version || '';
  let browserName = rawBrowserName;

  if (/chrome/i.test(rawBrowserName)) {
    browserName = 'Chrome';
  } else if (/safari/i.test(rawBrowserName) && !/chrome/i.test(userAgent)) {
    browserName = 'Safari';
  } else if (/firefox/i.test(rawBrowserName)) {
    browserName = 'Firefox';
  } else if (/edge/i.test(rawBrowserName)) {
    browserName = 'Edge';
  } else if (/brave/i.test(userAgent)) {
    browserName = 'Brave';
  } else if (/opera/i.test(rawBrowserName)) {
    browserName = 'Opera';
  }

  const majorBrowserVersion = rawBrowserVersion ? rawBrowserVersion.split('.')[0] : '';
  const browserDisplay = browserName
    ? majorBrowserVersion
      ? `${browserName} ${majorBrowserVersion}`
      : browserName
    : 'Web Browser';

  // 5. Device Type
  const deviceType =
    result.device.type ||
    (/mobile|iphone|android.*mobile/i.test(userAgent)
      ? 'mobile'
      : /tablet|ipad/i.test(userAgent)
      ? 'tablet'
      : 'desktop');

  // 6. Human-readable device name
  let deviceName = clientProvidedName;
  if (!deviceName) {
    if (brand === 'apple') {
      if (deviceType === 'mobile') deviceName = 'Apple iPhone';
      else if (deviceType === 'tablet') deviceName = 'Apple iPad';
      else deviceName = 'Apple Mac';
    } else if (brand === 'microsoft') {
      deviceName = 'Windows PC';
    } else if (brand === 'android') {
      deviceName = result.device.model ? `Android (${result.device.model})` : 'Android Device';
    } else if (brand === 'linux') {
      deviceName = 'Linux Workstation';
    } else {
      deviceName = `${osName || 'Desktop'} Device`;
    }
  }

  // 7. Stable Device ID (SSO Standard)
  // If client provided a persistent device ID, use it directly.
  // Otherwise, hash stable client attributes (User-Agent + OS + browser + deviceType)
  // CRITICAL: Notice we do NOT include transient proxy IP in the deviceId hash
  // so the same computer isn't treated as a new device on every network hop!
  const deviceId =
    clientProvidedId ||
    crypto
      .createHash('sha256')
      .update(`${userAgent}|${osName}|${browserName}|${deviceType}`)
      .digest('hex')
      .substring(0, 32);

  return {
    deviceId,
    deviceName,
    browser: browserDisplay,
    browserName,
    browserVersion: rawBrowserVersion,
    os: osDisplay,
    osName,
    osVersion: rawOsVersion,
    deviceType,
    brand,
    ip,
  };
};
