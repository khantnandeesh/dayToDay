import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
  },
  deviceName: {
    type: String,
    required: true,
  },
  browser: String,
  os: String,
  ip: String,
  lastActive: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: true,
    },
    twoFactorCode: {
      type: String,
      select: false,
    },
    twoFactorCodeExpires: {
      type: Date,
      select: false,
    },
    devices: [deviceSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate 2FA code
userSchema.methods.generate2FACode = function () {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.twoFactorCode = code;
  this.twoFactorCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return code;
};

// Verify 2FA code
userSchema.methods.verify2FACode = function (code) {
  if (!this.twoFactorCode || !this.twoFactorCodeExpires) {
    return false;
  }
  
  if (Date.now() > this.twoFactorCodeExpires) {
    return false;
  }
  
  return this.twoFactorCode === code;
};

// Add device
userSchema.methods.addDevice = function (deviceInfo) {
  const existingDevice = this.devices.find(
    (d) => d.deviceId === deviceInfo.deviceId
  );
  
  if (existingDevice) {
    existingDevice.lastActive = Date.now();
    existingDevice.ip = deviceInfo.ip;
  } else {
    this.devices.push(deviceInfo);
  }
};

// Remove device
userSchema.methods.removeDevice = function (deviceId) {
  this.devices = this.devices.filter((d) => d.deviceId !== deviceId);
};

const User = mongoose.model('User', userSchema);

export default User;
