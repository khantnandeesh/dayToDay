import mongoose from 'mongoose';

const aiVaultSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Hashed session token (never store raw token)
  tokenHash: {
    type: String,
    required: true,
  },
  // Capability-based permissions
  permissions: {
    listItems: { type: Boolean, default: true },
    readMetadata: { type: Boolean, default: true },
    createSecureLink: { type: Boolean, default: true },
    revealSecret: { type: Boolean, default: false },
    createItems: { type: Boolean, default: false },
    updateItems: { type: Boolean, default: false },
    deleteItems: { type: Boolean, default: false },
  },
  // Optional: restrict to specific items only
  allowedItemIds: [{
    type: String,
  }],
  // Session metadata
  expiresAt: {
    type: Date,
    required: true,
  },
  revoked: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

// Index for cleanup and queries
aiVaultSessionSchema.index({ user: 1, expiresAt: 1 });
aiVaultSessionSchema.index({ tokenHash: 1 });

export default mongoose.model('AIVaultSession', aiVaultSessionSchema);
