import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    level: {
      type: String,
      enum: ['INFO', 'WARN', 'ERROR'],
      default: 'INFO',
      index: true,
    },
    event: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: String,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    adminUser: {
      type: String,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    ip: {
      type: String,
      default: '127.0.0.1',
    },
    device: {
      type: String,
      default: 'Unknown Device',
    },
    result: {
      type: String,
      default: 'Success',
      index: true,
    },
    target: {
      type: String,
    },
    message: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast queries & sorting in admin panel
auditLogSchema.index({ timestamp: -1, event: 1 });
auditLogSchema.index({ user: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
