import AuditLog from '../models/AuditLog.js';
import { parseDeviceInfo } from '../utils/deviceParser.js';

export function getClientIp(req) {
  if (!req) return '127.0.0.1';
  return (
    req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers?.['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.ip ||
    '127.0.0.1'
  );
}

export function getDeviceSummary(req) {
  if (!req) return 'Unknown Device';
  try {
    const info = parseDeviceInfo(req);
    const parts = [
      info.browserName ? `${info.browserName} ${info.browserVersion || ''}`.trim() : '',
      info.osName ? `${info.osName} ${info.osVersion || ''}`.trim() : '',
      info.deviceType && info.deviceType !== 'desktop' ? `(${info.deviceType})` : '',
    ].filter(Boolean);
    return parts.join(' / ') || info.deviceName || 'Web Client';
  } catch {
    return 'Web Client';
  }
}

/**
 * Log an administrative or security audit event.
 * Never stores passwords, token hashes, or secrets.
 */
export async function logAuditEvent({
  level = 'INFO',
  event,
  user = 'Anonymous',
  userId = null,
  adminUser = null,
  adminId = null,
  ip = '127.0.0.1',
  device = 'Unknown',
  result = 'Success',
  target = null,
  message = '',
  metadata = null,
  req = null,
}) {
  try {
    const clientIp = req ? getClientIp(req) : ip;
    const clientDevice = req ? getDeviceSummary(req) : device;

    // Sanitize metadata to avoid saving sensitive fields
    let cleanMetadata = null;
    if (metadata && typeof metadata === 'object') {
      cleanMetadata = { ...metadata };
      delete cleanMetadata.password;
      delete cleanMetadata.token;
      delete cleanMetadata.secret;
      delete cleanMetadata.code;
      delete cleanMetadata.twoFactorCode;
      delete cleanMetadata.clientSecret;
    }

    const logEntry = await AuditLog.create({
      timestamp: new Date(),
      level: ['INFO', 'WARN', 'ERROR'].includes(level) ? level : 'INFO',
      event: String(event || 'UNKNOWN_EVENT').toUpperCase(),
      user: String(user || 'Anonymous'),
      userId,
      adminUser: adminUser ? String(adminUser) : undefined,
      adminId,
      ip: clientIp || '127.0.0.1',
      device: clientDevice || 'Unknown',
      result: String(result || 'Success'),
      target: target ? String(target) : undefined,
      message: message ? String(message).slice(0, 500) : '',
      metadata: cleanMetadata,
    });

    return logEntry;
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
    return null;
  }
}
