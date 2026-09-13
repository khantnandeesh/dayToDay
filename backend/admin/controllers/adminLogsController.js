import AuditLog from '../../models/AuditLog.js';
import { logAuditEvent } from '../../services/auditService.js';

export const getLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 25));
    const skip = (page - 1) * limit;

    const { search, level, event, user, from, to } = req.query;

    const filter = {};

    if (level && level !== 'all') {
      filter.level = level.toUpperCase();
    }

    if (event && event !== 'all') {
      filter.event = { $regex: event.trim(), $options: 'i' };
    }

    if (user && user.trim()) {
      filter.user = { $regex: user.trim(), $options: 'i' };
    }

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { message: { $regex: q, $options: 'i' } },
        { user: { $regex: q, $options: 'i' } },
        { ip: { $regex: q, $options: 'i' } },
        { event: { $regex: q, $options: 'i' } },
        { target: { $regex: q, $options: 'i' } },
      ];
    }

    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .select('timestamp level event user ip device result target message')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error in getLogs:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve logs' });
  }
};

export const clearLogs = async (req, res) => {
  try {
    const { retentionDays = 0 } = req.body;

    let filter = {};
    if (retentionDays > 0) {
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      filter = { timestamp: { $lt: cutoff } };
    }

    const result = await AuditLog.deleteMany(filter);

    await logAuditEvent({
      level: 'WARN',
      event: 'LOGS_CLEARED',
      adminUser: req.user.email,
      adminId: req.user._id,
      message: `Cleared ${result.deletedCount} log entries (Retention: ${retentionDays} days)`,
      req,
    });

    res.json({
      success: true,
      message: `Purged ${result.deletedCount} log records`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Error in clearLogs:', error);
    res.status(500).json({ success: false, message: 'Failed to clear logs' });
  }
};
