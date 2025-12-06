import mongoose from 'mongoose';

const vaultSettingsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  // Salt used for PBKDF2/Argon2 key derivation
  salt: {
    type: String,
    required: true,
  },
  // Encrypted string to verify the master password is correct
  // Content should be a known constant (e.g. "VALID") encrypted with the derived key
  verifier: {
    type: String,
    required: true,
  },
  verifierIv: {
    type: String,
    required: true,
  },
  customTemplates: [{
    id: String,
    label: String,
    icon: String,
    fields: [{
      label: String,
      type: { type: String },
      value: String // Default value usually empty
    }]
  }]
}, { timestamps: true });

export default mongoose.model('VaultSettings', vaultSettingsSchema);
