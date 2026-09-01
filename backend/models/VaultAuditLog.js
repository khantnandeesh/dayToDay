import mongoose from 'mongoose';

const vaultAuditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Type of action
  action: {
    type: String,
    enum: [
      'session_created',
      'session_revoked',
      'session_expired',
      'link_created',
      'link_used',
      'link_revoked',
      'item_accessed',
      'item_created',
      'item_updated',
      'item_deleted',
      'vault_unlocked',
      'vault_locked',
      'ai_session_created',
      'ai_session_revoked',
      'access_link_created',
      'access_link_used',
      'access_link_revoked',
      'access_link_creds_sent_to_email',
    ],
    required: true,
  },
  details: {
    type: String,
  },
  // Optional reference to affected item
  vaultItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaultItem',
  },
  // Optional reference to session
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AIVaultSession',
  },
  // Optional reference to access link
  accessLinkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaultAccessLink',
  },
  // Additional context
  metadata: {
    source: String, // 'mcp', 'api', 'ui'
    permission: String, // which permission was used
    details: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Index for efficient queries
vaultAuditLogSchema.index({ user: 1, createdAt: -1 });
vaultAuditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model('VaultAuditLog', vaultAuditLogSchema);
