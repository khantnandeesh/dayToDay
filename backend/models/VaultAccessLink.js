import mongoose from 'mongoose';

const vaultAccessLinkSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  vaultItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VaultItem',
    required: true,
  },
  // Item metadata
  itemTitle: {
    type: String,
    default: 'Secure Vault Item',
  },
  itemType: {
    type: String,
    default: 'login',
  },
  // Hashed token (URL contains opaque token, we store hash)
  tokenHash: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  usedAt: {
    type: Date,
  },
  oneTimeUse: {
    type: Boolean,
    default: true,
  },
  // Email verification code & expiry
  accessCode: {
    type: String,
  },
  accessCodeExpiresAt: {
    type: Date,
  },
  // Temporary snapshot of item payload for one-time access
  decryptedSnapshot: {
    type: mongoose.Schema.Types.Mixed,
  },
  // Track which session created this link
  createdBySessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AIVaultSession',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Indexes for efficient queries
vaultAccessLinkSchema.index({ user: 1, expiresAt: 1 });
vaultAccessLinkSchema.index({ tokenHash: 1 });
vaultAccessLinkSchema.index({ vaultItemId: 1 });

export default mongoose.model('VaultAccessLink', vaultAccessLinkSchema);
