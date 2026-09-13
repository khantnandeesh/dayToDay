import User from '../../models/User.js';
import Session from '../../models/Session.js';
import AuditLog from '../../models/AuditLog.js';
import { logAuditEvent } from '../../services/auditService.js';

export const getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit) || 15));
    const skip = (page - 1) * limit;

    const { search, role, status, sortBy = 'createdAt', sortDir = 'desc' } = req.query;

    const filter = {};

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }

    if (role && ['admin', 'user'].includes(role)) {
      filter.role = role;
    }

    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'disabled') {
      filter.isActive = false;
    }

    const sortOrder = sortDir === 'asc' ? 1 : -1;
    const sortField = ['name', 'email', 'createdAt', 'lastLogin', 'role'].includes(sortBy)
      ? sortBy
      : 'createdAt';

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .select('name email role isActive twoFactorEnabled createdAt updatedAt lastLogin failedLoginAttempts')
        .lean(),
      User.countDocuments(filter),
    ]);

    // Attach active session counts for each user
    const userIds = users.map((u) => u._id);
    const now = new Date();
    const activeSessions = await Session.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          isActive: true,
          expiresAt: { $gt: now },
        },
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
        },
      },
    ]);

    const sessionCountMap = {};
    activeSessions.forEach((s) => {
      sessionCountMap[String(s._id)] = s.count;
    });

    const enrichedUsers = users.map((u) => ({
      ...u,
      activeSessionsCount: sessionCountMap[String(u._id)] || 0,
    }));

    res.json({
      success: true,
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error in getUsers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users list' });
  }
};

export const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .select('+failedLoginAttempts')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Fetch active and recent sessions (exclude raw tokens)
    const now = new Date();
    const sessions = await Session.find({ userId: id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-token')
      .lean();

    // Fetch recent authentication activity for this user
    const loginHistory = await AuditLog.find({
      $or: [{ userId: id }, { user: user.email }],
    })
      .sort({ timestamp: -1 })
      .limit(20)
      .select('timestamp event ip device result message')
      .lean();

    // Check if 2FA code is currently pending
    const hasPending2fa = Boolean(
      user.twoFactorCodeExpires && new Date(user.twoFactorCodeExpires) > now
    );

    // Sanitize user object: never return password or 2FA hashes
    delete user.password;
    delete user.twoFactorCode;

    res.json({
      success: true,
      user: {
        ...user,
        hasPending2fa,
      },
      sessions,
      loginHistory,
    });
  } catch (error) {
    console.error('Error in getUserDetails:', error);
    res.status(500).json({ success: false, message: 'Failed to load user details' });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role = 'user', twoFactorEnabled = false } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists',
      });
    }

    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role === 'admin' ? 'admin' : 'user',
      twoFactorEnabled: Boolean(twoFactorEnabled),
      isActive: true,
    });

    await logAuditEvent({
      level: 'INFO',
      event: 'USER_CREATED',
      user: newUser.email,
      userId: newUser._id,
      adminUser: req.user.email,
      adminId: req.user._id,
      target: String(newUser._id),
      message: `Created new ${newUser.role} account`,
      req,
    });

    res.status(201).json({
      success: true,
      message: `User ${newUser.email} created successfully`,
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error('Error in createUser:', error);
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent admin from disabling their own account
    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot disable your own administrator account',
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    // If account was disabled, terminate all active sessions immediately
    if (!user.isActive) {
      await Session.updateMany({ userId: user._id, isActive: true }, { isActive: false });
    }

    const action = user.isActive ? 'USER_ENABLED' : 'USER_DISABLED';
    await logAuditEvent({
      level: 'WARN',
      event: action,
      user: user.email,
      userId: user._id,
      adminUser: req.user.email,
      adminId: req.user._id,
      target: String(user._id),
      message: `Account status toggled to ${user.isActive ? 'Active' : 'Disabled'}`,
      req,
    });

    res.json({
      success: true,
      message: `User account is now ${user.isActive ? 'Active' : 'Disabled'}`,
      isActive: user.isActive,
    });
  } catch (error) {
    console.error('Error in toggleUserStatus:', error);
    res.status(500).json({ success: false, message: 'Failed to update user status' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (String(id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own administrator account',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userEmail = user.email;

    // Terminate all sessions
    await Session.deleteMany({ userId: id });

    // Remove user
    await User.findByIdAndDelete(id);

    await logAuditEvent({
      level: 'WARN',
      event: 'USER_DELETED',
      user: userEmail,
      adminUser: req.user.email,
      adminId: req.user._id,
      target: id,
      message: `User ${userEmail} was permanently deleted`,
      req,
    });

    res.json({
      success: true,
      message: `User ${userEmail} has been deleted successfully`,
    });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

export const logoutUserSessions = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const result = await Session.updateMany(
      { userId: id, isActive: true },
      { isActive: false }
    );

    await logAuditEvent({
      level: 'INFO',
      event: 'USER_SESSIONS_TERMINATED',
      user: user.email,
      userId: user._id,
      adminUser: req.user.email,
      adminId: req.user._id,
      target: String(user._id),
      message: `Terminated ${result.modifiedCount} active sessions for ${user.email}`,
      req,
    });

    res.json({
      success: true,
      message: `Terminated ${result.modifiedCount} active session(s) for ${user.email}`,
      terminatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error in logoutUserSessions:', error);
    res.status(500).json({ success: false, message: 'Failed to terminate user sessions' });
  }
};

export const resetUser2fa = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.invalidate2FA();
    user.failedLoginAttempts = 0;
    await user.save();

    await logAuditEvent({
      level: 'INFO',
      event: '2FA_CHALLENGE_INVALIDATED',
      user: user.email,
      userId: user._id,
      adminUser: req.user.email,
      adminId: req.user._id,
      target: String(user._id),
      message: `Invalidated outstanding 2FA challenge and reset failed attempts for ${user.email}`,
      req,
    });

    res.json({
      success: true,
      message: `2FA challenge and failed attempts reset for ${user.email}`,
    });
  } catch (error) {
    console.error('Error in resetUser2fa:', error);
    res.status(500).json({ success: false, message: 'Failed to reset 2FA' });
  }
};
