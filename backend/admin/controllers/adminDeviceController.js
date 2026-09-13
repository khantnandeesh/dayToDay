import User from '../../models/User.js';
import Session from '../../models/Session.js';
import { logAuditEvent } from '../../services/auditService.js';

export const getDevices = async (req, res) => {
  try {
    const { search, deviceType, status = 'all' } = req.query;
    const now = new Date();

    const users = await User.find()
      .select('name email devices')
      .lean();

    // Map active session device IDs
    const activeSessions = await Session.find({
      isActive: true,
      expiresAt: { $gt: now },
    })
      .select('deviceId userId lastActive deviceInfo')
      .lean();

    const activeDeviceMap = new Map();
    activeSessions.forEach((s) => {
      activeDeviceMap.set(`${s.userId}_${s.deviceId}`, s);
    });

    let deviceList = [];

    users.forEach((user) => {
      if (Array.isArray(user.devices)) {
        user.devices.forEach((dev) => {
          const session = activeDeviceMap.get(`${user._id}_${dev.deviceId}`);
          const isActive = Boolean(session);

          deviceList.push({
            deviceId: dev.deviceId,
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            deviceName: dev.deviceName || 'Unknown Device',
            browser: dev.browserName || dev.browser || 'Unknown',
            browserVersion: dev.browserVersion || '',
            os: dev.osName || dev.os || 'Unknown OS',
            osVersion: dev.osVersion || '',
            deviceType: dev.deviceType || 'desktop',
            ip: dev.ip || '127.0.0.1',
            firstSeen: dev.createdAt || user.createdAt,
            lastSeen: dev.lastActive || session?.lastActive || user.updatedAt,
            isActive,
            sessionId: session?._id || null,
          });
        });
      }
    });

    // Apply filtering
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      deviceList = deviceList.filter(
        (d) =>
          d.userName.toLowerCase().includes(q) ||
          d.userEmail.toLowerCase().includes(q) ||
          d.browser.toLowerCase().includes(q) ||
          d.os.toLowerCase().includes(q) ||
          d.ip.includes(q)
      );
    }

    if (deviceType && deviceType !== 'all') {
      deviceList = deviceList.filter((d) => d.deviceType === deviceType);
    }

    if (status === 'active') {
      deviceList = deviceList.filter((d) => d.isActive);
    } else if (status === 'inactive') {
      deviceList = deviceList.filter((d) => !d.isActive);
    }

    // Sort by last seen descending
    deviceList.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

    res.json({
      success: true,
      devices: deviceList,
      total: deviceList.length,
    });
  } catch (error) {
    console.error('Error in getDevices:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch devices' });
  }
};

export const revokeDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { userId } = req.body;

    const query = { deviceId, isActive: true };
    if (userId) {
      query.userId = userId;
    }

    const result = await Session.updateMany(query, { isActive: false });

    await logAuditEvent({
      level: 'INFO',
      event: 'DEVICE_REVOKED',
      target: deviceId,
      adminUser: req.user.email,
      adminId: req.user._id,
      message: `Revoked active sessions on device ${deviceId}`,
      req,
    });

    res.json({
      success: true,
      message: `Terminated ${result.modifiedCount} active session(s) on this device`,
    });
  } catch (error) {
    console.error('Error in revokeDevice:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke device' });
  }
};
