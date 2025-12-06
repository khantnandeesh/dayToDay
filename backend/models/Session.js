import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    duration: {
      type: Number,
      required: true,
      default: 24, // hours
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deviceInfo: {
      deviceName: String,
      browser: String,
      os: String,
      ip: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for automatic cleanup of expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Check if session is valid
sessionSchema.methods.isValid = function () {
  return this.isActive && this.expiresAt > Date.now();
};

const Session = mongoose.model('Session', sessionSchema);

export default Session;
