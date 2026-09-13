import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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
  browserName: String,
  browserVersion: String,
  os: String,
  osName: String,
  osVersion: String,
  deviceType: String,
  brand: String,
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
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
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
    twoFactorAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    twoFactorCreatedAt: {
      type: Date,
      select: false,
    },
    twoFactorIp: {
      type: String,
      select: false,
    },
    lastLogin: {
      type: Date,
    },
    lastSuccessfulVerification: {
      type: Date,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
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

// Generate 2FA code (hashes the code before saving so plaintext is never stored)
userSchema.methods.generate2FACode = function (ip = '') {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  // Hash the 2FA code using SHA-256
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  this.twoFactorCode = hash;
  this.twoFactorCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  this.twoFactorAttempts = 0;
  this.twoFactorCreatedAt = new Date();
  this.twoFactorIp = ip;
  return code;
};

// Verify 2FA code securely comparing hashes and enforcing attempt limit
userSchema.methods.verify2FACode = function (code) {
  if (!this.twoFactorCode || !this.twoFactorCodeExpires) {
    return false;
  }
  
  if (Date.now() > new Date(this.twoFactorCodeExpires).getTime()) {
    return false;
  }

  // Rate-limit to max 5 failed attempts per challenge
  if ((this.twoFactorAttempts || 0) >= 5) {
    return false;
  }
  
  const cleanCode = String(code || '').trim();
  const candidateHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
  
  try {
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(this.twoFactorCode, 'utf8'),
      Buffer.from(candidateHash, 'utf8')
    );
    if (!isMatch) {
      this.twoFactorAttempts = (this.twoFactorAttempts || 0) + 1;
    }
    return isMatch;
  } catch {
    this.twoFactorAttempts = (this.twoFactorAttempts || 0) + 1;
    return false;
  }
};

// Invalidate pending 2FA challenge
userSchema.methods.invalidate2FA = function () {
  this.twoFactorCode = undefined;
  this.twoFactorCodeExpires = undefined;
  this.twoFactorAttempts = 0;
  this.twoFactorCreatedAt = undefined;
  this.twoFactorIp = undefined;
};

// Add device
userSchema.methods.addDevice = function (deviceInfo) {
  const existingDevice = this.devices.find(
    (d) => d.deviceId === deviceInfo.deviceId
  );
  
  if (existingDevice) {
    existingDevice.lastActive = Date.now();
    existingDevice.ip = deviceInfo.ip;
    if (deviceInfo.deviceName) existingDevice.deviceName = deviceInfo.deviceName;
    if (deviceInfo.browser) existingDevice.browser = deviceInfo.browser;
    if (deviceInfo.browserName) existingDevice.browserName = deviceInfo.browserName;
    if (deviceInfo.browserVersion) existingDevice.browserVersion = deviceInfo.browserVersion;
    if (deviceInfo.os) existingDevice.os = deviceInfo.os;
    if (deviceInfo.osName) existingDevice.osName = deviceInfo.osName;
    if (deviceInfo.osVersion) existingDevice.osVersion = deviceInfo.osVersion;
    if (deviceInfo.deviceType) existingDevice.deviceType = deviceInfo.deviceType;
    if (deviceInfo.brand) existingDevice.brand = deviceInfo.brand;
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
