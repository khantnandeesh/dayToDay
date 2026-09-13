import User from '../../models/User.js';
import AuditLog from '../../models/AuditLog.js';
import { logAuditEvent } from '../../services/auditService.js';

export const getTwoFactorChallenges = async (req, res) => {
  try {
    const now = new Date();

    // Find users with 2FA enabled or active code
    const usersWith2FA = await User.find({
      $or: [
        { twoFactorEnabled: true },
        { twoFactorCodeExpires: { $exists: true } },
      ],
    })
      .select('+twoFactorCodeExpires +twoFactorAttempts +twoFactorCreatedAt +twoFactorIp')
      .lean();

    const challenges = usersWith2FA.map((user) => {
      const hasActiveCode =
        user.twoFactorCodeExpires && new Date(user.twoFactorCodeExpires) > now;
      const isExpired =
        user.twoFactorCodeExpires && new Date(user.twoFactorCodeExpires) <= now;

      let status = 'Idle';
      if (hasActiveCode) {
        status = 'Pending Verification';
      } else if (isExpired && user.twoFactorAttempts > 0) {
        status = 'Expired';
      } else if (user.lastSuccessfulVerification) {
        status = 'Verified';
      }

      return {
        userId: user._id,
        email: user.email,
        name: user.name,
        twoFactorEnabled: user.twoFactorEnabled,
        hasPendingChallenge: hasActiveCode,
        codeCreatedAt: user.twoFactorCreatedAt || null,
        expiresAt: user.twoFactorCodeExpires || null,
        attempts: user.twoFactorAttempts || 0,
        status,
        createdFromIp: user.twoFactorIp || 'N/A',
        lastSuccessfulVerification: user.lastSuccessfulVerification || null,
      };
    });

    res.json({
      success: true,
      challenges,
    });
  } catch (error) {
    console.error('Error in getTwoFactorChallenges:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch 2FA challenges' });
  }
};

export const invalidateChallenge = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.invalidate2FA();
    await user.save();

    await logAuditEvent({
      level: 'INFO',
      event: '2FA_CHALLENGE_INVALIDATED',
      user: user.email,
      userId: user._id,
      adminUser: req.user.email,
      adminId: req.user._id,
      target: String(user._id),
      message: `Administrator revoked active 2FA challenge for ${user.email}`,
      req,
    });

    res.json({
      success: true,
      message: `2FA challenge for ${user.email} was invalidated successfully`,
    });
  } catch (error) {
    console.error('Error in invalidateChallenge:', error);
    res.status(500).json({ success: false, message: 'Failed to invalidate 2FA challenge' });
  }
};
