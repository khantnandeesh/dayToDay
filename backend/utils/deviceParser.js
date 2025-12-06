import UAParser from 'ua-parser-js';
import crypto from 'crypto';

export const parseDeviceInfo = (req) => {
  const parser = new UAParser(req.headers['user-agent']);
  const result = parser.getResult();

  const deviceId = generateDeviceId(req);

  return {
    deviceId,
    deviceName: getDeviceName(result),
    browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
    os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
    ip: req.ip || req.connection.remoteAddress || 'Unknown',
  };
};

const generateDeviceId = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  
  // Create a unique device identifier
  const deviceString = `${userAgent}-${ip}`;
  return crypto.createHash('sha256').update(deviceString).digest('hex');
};

const getDeviceName = (result) => {
  const device = result.device.type || 'Desktop';
  const browser = result.browser.name || 'Unknown Browser';
  const os = result.os.name || 'Unknown OS';

  if (device === 'mobile') {
    return `📱 ${os} Mobile - ${browser}`;
  } else if (device === 'tablet') {
    return `📱 ${os} Tablet - ${browser}`;
  } else {
    return `💻 ${os} - ${browser}`;
  }
};
