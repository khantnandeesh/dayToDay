import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import Session from '../../models/Session.js';
import AuditLog from '../../models/AuditLog.js';
import { getJwtSecret } from '../../middleware/auth.js';
import { parseDeviceInfo } from '../../utils/deviceParser.js';
import { logAuditEvent, getClientIp } from '../../services/auditService.js';

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail }).select('+password');

    if (!user) {
      await logAuditEvent({
        level: 'WARN',
        event: 'ADMIN_LOGIN_FAILED',
        user: cleanEmail,
        result: 'Failed',
        message: 'Admin login attempted with non-existent email',
        req,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid administrative credentials',
      });
    }

    if (!user.isActive) {
      await logAuditEvent({
        level: 'WARN',
        event: 'ADMIN_LOGIN_FAILED',
        user: user.email,
        userId: user._id,
        result: 'Blocked',
        message: 'Admin login attempted on inactive account',
        req,
      });
      return res.status(403).json({
        success: false,
        message: 'This administrative account is disabled',
      });
    }

    if (user.role !== 'admin') {
      await logAuditEvent({
        level: 'WARN',
        event: 'ADMIN_LOGIN_FAILED',
        user: user.email,
        userId: user._id,
        result: 'Forbidden',
        message: 'Non-admin user attempted admin login',
        req,
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have administrator permissions',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      await user.save();
      await logAuditEvent({
        level: 'WARN',
        event: 'ADMIN_LOGIN_FAILED',
        user: user.email,
        userId: user._id,
        result: 'Failed',
        message: 'Invalid password on admin login attempt',
        req,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid administrative credentials',
      });
    }

    // Reset failed attempts & record login
    user.failedLoginAttempts = 0;
    user.lastLogin = new Date();
    await user.save();

    // Create session
    const deviceInfo = parseDeviceInfo(req);
    const duration = 24; // 24 hours
    const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000);

    const token = jwt.sign({ id: user._id }, getJwtSecret(), { expiresIn: '24h' });

    const session = await Session.create({
      userId: user._id,
      deviceId: deviceInfo.deviceId || 'admin_console',
      token,
      duration,
      expiresAt,
      deviceInfo,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: duration * 60 * 60 * 1000,
    });

    await logAuditEvent({
      level: 'INFO',
      event: 'ADMIN_LOGIN',
      user: user.email,
      userId: user._id,
      adminUser: user.email,
      adminId: user._id,
      result: 'Success',
      message: 'Administrator successfully logged into control panel',
      req,
    });

    res.json({
      success: true,
      message: 'Admin login successful',
      token,
      admin: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error('Error in adminLogin:', error);
    res.status(500).json({ success: false, message: 'Server error during admin authentication' });
  }
};

export const getAdminMe = async (req, res) => {
  try {
    const user = req.user;
    res.json({
      success: true,
      admin: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve profile' });
  }
};

export const adminLogout = async (req, res) => {
  try {
    if (req.session) {
      req.session.isActive = false;
      await req.session.save();
    }

    res.clearCookie('token');

    await logAuditEvent({
      level: 'INFO',
      event: 'ADMIN_LOGOUT',
      user: req.user?.email || 'admin',
      adminUser: req.user?.email,
      adminId: req.user?._id,
      result: 'Success',
      message: 'Administrator signed out of control panel',
      req,
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Error in adminLogout:', error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

export const getAuthEvents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const { event, result, email, ip, from, to } = req.query;

    const filter = {};

    // Auth relevant events
    if (event && event !== 'all') {
      filter.event = event.toUpperCase();
    } else {
      filter.event = {
        $in: [
          'LOGIN',
          'FAILED_LOGIN',
          'ADMIN_LOGIN',
          'ADMIN_LOGIN_FAILED',
          '2FA_REQUEST',
          '2FA_VERIFY',
          '2FA_VERIFY_FAILED',
          'LOGOUT',
          'ADMIN_LOGOUT',
          'DEVICE_LOGOUT',
        ],
      };
    }

    if (result && result !== 'all') {
      filter.result = result;
    }

    if (email && email.trim()) {
      filter.user = { $regex: email.trim(), $options: 'i' };
    }

    if (ip && ip.trim()) {
      filter.ip = { $regex: ip.trim(), $options: 'i' };
    }

    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    const [events, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .select('timestamp event user ip device result message level')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error in getAuthEvents:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve auth events' });
  }
};

export const getAuthStats = async (req, res) => {
  try {
    const [
      successfulLogins,
      failedLogins,
      twoFactorRequests,
      twoFactorSuccess,
      twoFactorFailed,
      suspiciousIps,
    ] = await Promise.all([
      AuditLog.countDocuments({ event: { $in: ['LOGIN', 'ADMIN_LOGIN'] }, result: 'Success' }),
      AuditLog.countDocuments({ event: { $in: ['FAILED_LOGIN', 'ADMIN_LOGIN_FAILED'] } }),
      AuditLog.countDocuments({ event: '2FA_REQUEST' }),
      AuditLog.countDocuments({ event: '2FA_VERIFY', result: 'Success' }),
      AuditLog.countDocuments({ event: '2FA_VERIFY_FAILED' }),
      AuditLog.aggregate([
        {
          $match: {
            event: { $in: ['FAILED_LOGIN', 'ADMIN_LOGIN_FAILED', '2FA_VERIFY_FAILED'] },
          },
        },
        {
          $group: {
            _id: '$ip',
            failures: { $sum: 1 },
            lastAttempt: { $max: '$timestamp' },
            usersTargeted: { $addToSet: '$user' },
          },
        },
        { $sort: { failures: -1 } },
        { $limit: 5 },
      ]),
    ]);

    res.json({
      success: true,
      stats: {
        successfulLogins,
        failedLogins,
        twoFactorRequests,
        twoFactorSuccess,
        twoFactorFailed,
        suspiciousIps: suspiciousIps.map((s) => ({
          ip: s._id,
          failures: s.failures,
          lastAttempt: s.lastAttempt,
          usersCount: s.usersTargeted?.length || 1,
        })),
      },
    });
  } catch (error) {
    console.error('Error in getAuthStats:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve auth statistics' });
  }
};
