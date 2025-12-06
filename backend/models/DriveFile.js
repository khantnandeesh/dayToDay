import mongoose from 'mongoose';

const driveFileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  folder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DriveFolder',
    default: null
  },
  name: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  r2Key: {
    type: String,
    required: true
  },
  isTrash: {
    type: Boolean,
    default: false
  },
  trashDate: {
    type: Date,
    default: null
  },
  // Sharing
  isPublic: {
    type: Boolean,
    default: false
  },
  shareToken: {
    type: String, // Random token for public link
    default: null
  },
  shareExpires: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Indexes for performance
driveFileSchema.index({ user: 1, folder: 1, isTrash: 1 });
driveFileSchema.index({ shareToken: 1 });

export default mongoose.model('DriveFile', driveFileSchema);
