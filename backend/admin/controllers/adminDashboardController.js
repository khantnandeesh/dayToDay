import User from '../../models/User.js';
import Session from '../../models/Session.js';
import McpOAuthClient from '../../models/McpOAuthClient.js';
import AuditLog from '../../models/AuditLog.js';

export const getDashboardStats = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit) || 15));
    const skip = (page - 1) * limit;

    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours

    const [
      usersCount,
      activeSessionsCount,
      expiringSessionsCount,
      mcpClientsCount,
      failedLoginsCount,
      active2faChallengesCount,
      recentActivity,
      totalActivityCount,
    ] = await Promise.all([
      User.countDocuments(),
      Session.countDocuments({ isActive: true, expiresAt: { $gt: now } }),
      Session.countDocuments({
        isActive: true,
        expiresAt: { $gt: now, $lte: soonThreshold },
      }),
      McpOAuthClient.countDocuments({ status: 'active' }),
      AuditLog.countDocuments({ event: { $in: ['FAILED_LOGIN', '2FA_VERIFY_FAILED'] } }),
      User.countDocuments({
        twoFactorCodeExpires: { $gt: now },
      }),
      AuditLog.find()
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .select('timestamp event user ip result message level target')
        .lean(),
      AuditLog.countDocuments(),
    ]);

    res.json({
      success: true,
      stats: {
        usersCount,
        activeSessionsCount,
        expiringSessionsCount,
        mcpClientsCount,
        failedLoginsCount,
        active2faChallengesCount,
      },
      activity: {
        data: recentActivity,
        pagination: {
          page,
          limit,
          total: totalActivityCount,
          totalPages: Math.ceil(totalActivityCount / limit) || 1,
        },
      },
    });
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard statistics',
    });
  }
};
