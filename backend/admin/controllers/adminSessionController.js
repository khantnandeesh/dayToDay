import Session from '../../models/Session.js';
import User from '../../models/User.js';
import { logAuditEvent } from '../../services/auditService.js';

export const getSessions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit) || 15));
    const skip = (page - 1) * limit;

    const { search, status = 'active', sortBy = 'lastActive', sortDir = 'desc' } = req.query;

    const filter = {};
    const now = new Date();

    if (status === 'active') {
      filter.isActive = true;
      filter.expiresAt = { $gt: now };
    } else if (status === 'expired') {
      filter.$or = [{ isActive: false }, { expiresAt: { $lte: now } }];
    }

    if (search && search.trim()) {
      const q = search.trim();
      // Look up matching user IDs
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      }).select('_id');

      const userIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { userId: { $in: userIds } },
        { 'deviceInfo.ip': { $regex: q, $options: 'i' } },
        { 'deviceInfo.browser': { $regex: q, $options: 'i' } },
        { 'deviceInfo.deviceName': { $regex: q, $options: 'i' } },
      ];
    }

    const sortOrder = sortDir === 'asc' ? 1 : -1;
    const sortField = ['createdAt', 'expiresAt', 'lastActive'].includes(sortBy)
      ? sortBy
      : 'createdAt';

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .populate('userId', 'name email role')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .select('-token') // NEVER expose raw JWT token!
        .lean(),
      Session.countDocuments(filter),
    ]);

    const formattedSessions = sessions.map((s) => ({
      _id: s._id,
      user: s.userId
        ? {
            id: s.userId._id,
            name: s.userId.name,
            email: s.userId.email,
            role: s.userId.role,
          }
        : { name: 'Unknown', email: 'deleted@user.local', role: 'user' },
      device: s.deviceInfo?.deviceName || s.deviceId || 'Unknown Device',
      browser: s.deviceInfo?.browser || s.deviceInfo?.browserName || 'Unknown',
      browserVersion: s.deviceInfo?.browserVersion || '',
      os: s.deviceInfo?.os || s.deviceInfo?.osName || 'Unknown OS',
      osVersion: s.deviceInfo?.osVersion || '',
      deviceType: s.deviceInfo?.deviceType || 'desktop',
      ip: s.deviceInfo?.ip || '127.0.0.1',
      createdAt: s.createdAt,
      lastActive: s.lastActive || s.updatedAt || s.createdAt,
      expiresAt: s.expiresAt,
      isActive: s.isActive && new Date(s.expiresAt) > now,
      duration: s.duration,
    }));

    res.json({
      success: true,
      sessions: formattedSessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error in getSessions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
};

export const terminateSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await Session.findById(id).populate('userId', 'email');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    session.isActive = false;
    await session.save();

    await logAuditEvent({
      level: 'INFO',
      event: 'SESSION_TERMINATED',
      user: session.userId?.email || 'Unknown User',
      adminUser: req.user.email,
      adminId: req.user._id,
      target: id,
      message: `Terminated session ID ${id}`,
      req,
    });

    res.json({
      success: true,
      message: 'Session terminated successfully',
    });
  } catch (error) {
    console.error('Error in terminateSession:', error);
    res.status(500).json({ success: false, message: 'Failed to terminate session' });
  }
};

export const terminateUserSessions = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const result = await Session.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );

    await logAuditEvent({
      level: 'INFO',
      event: 'USER_SESSIONS_TERMINATED',
      user: user.email,
      userId: user._id,
      adminUser: req.user.email,
      adminId: req.user._id,
      target: String(userId),
      message: `Admin terminated all active sessions for ${user.email}`,
      req,
    });

    res.json({
      success: true,
      message: `Terminated ${result.modifiedCount} active sessions for ${user.email}`,
      count: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error in terminateUserSessions:', error);
    res.status(500).json({ success: false, message: 'Failed to terminate user sessions' });
  }
};

export const terminateAllSessions = async (req, res) => {
  try {
    const { confirm } = req.body;

    if (confirm !== 'CONFIRM_GLOBAL_TERMINATE') {
      return res.status(400).json({
        success: false,
        message: 'Explicit confirmation string required to terminate all global sessions',
      });
    }

    // Terminate all sessions except the current admin's active session
    const currentSessionId = req.session?._id;
    const filter = { isActive: true };
    if (currentSessionId) {
      filter._id = { $ne: currentSessionId };
    }

    const result = await Session.updateMany(filter, { isActive: false });

    await logAuditEvent({
      level: 'WARN',
      event: 'ALL_SESSIONS_TERMINATED',
      adminUser: req.user.email,
      adminId: req.user._id,
      message: `Global session termination invoked. ${result.modifiedCount} sessions revoked.`,
      req,
    });

    res.json({
      success: true,
      message: `Terminated ${result.modifiedCount} active sessions globally across all users`,
      count: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error in terminateAllSessions:', error);
    res.status(500).json({ success: false, message: 'Failed to terminate all sessions' });
  }
};
