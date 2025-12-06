import mongoose from 'mongoose';

const vaultItemSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Type of the item (e.g., 'website', 'bank', 'wifi')
  // We can keep this plaintext for basic categorization, or encrypt it inside the blob.
  // For better UX (fetching only 'banks'), we'll keep it visible.
  type: {
    type: String,
    required: true,
    default: 'custom'
  },
  // We store the encrypted blob here. 
  // This blob contains: title, fields[], notes, etc.
  encryptedData: {
    type: String, // Base64 encoded ciphertext
    required: true,
  },
  iv: {
    type: String, // Base64 encoded initialization vector
    required: true,
  },
  // Optional: Tags can be plaintext for server-side filtering, or encrypted.
  // Let's keep a simple plaintext 'favorite' flag, but tags inside encrypted data for privacy.
  isFavorite: {
    type: Boolean,
    default: false,
  },
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
}, { timestamps: true });

export default mongoose.model('VaultItem', vaultItemSchema);
