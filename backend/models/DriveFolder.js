import mongoose from 'mongoose';

const driveFolderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DriveFolder',
    default: null
  },
  name: {
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
  }
}, { timestamps: true });

// Ensure a user cannot have two folders with same name in same parent
driveFolderSchema.index({ user: 1, parent: 1, name: 1 }, { unique: true, partialFilterExpression: { isTrash: false } });
driveFolderSchema.index({ user: 1, parent: 1, isTrash: 1 });

export default mongoose.model('DriveFolder', driveFolderSchema);
