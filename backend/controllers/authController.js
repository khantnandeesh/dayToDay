import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { send2FACode, sendWelcomeEmail } from '../config/email.js';
import { parseDeviceInfo } from '../utils/deviceParser.js';

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
    });

    // Send welcome email
    await sendWelcomeEmail(email, name);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please login to continue.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
    });
  }
};

// @desc    Login user (Step 1: Check credentials and 2FA)
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check 2FA preference
    if (user.twoFactorEnabled) {
        // Generate and send 2FA code
        const code = user.generate2FACode();
        await user.save();

        await send2FACode(email, code, user.name);

        return res.status(200).json({
            success: true,
            message: '2FA code sent to your email',
            userId: user._id,
            requires2FA: true,
        });
    }

    // 2FA Disabled: Create session directly
    
    // Parse device info
    const deviceInfo = parseDeviceInfo(req);

    // Add device to user
    user.addDevice(deviceInfo);
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Default duration (24h) if not specified
    const duration = 24;
    const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000);

    // Create session
    const session = await Session.create({
      userId: user._id,
      deviceId: deviceInfo.deviceId,
      token,
      duration,
      expiresAt,
      deviceInfo,
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: duration * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      session: {
        duration,
        expiresAt,
      },
      requires2FA: false
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
};

// @desc    Verify 2FA code and complete login
// @route   POST /api/auth/verify-2fa
// @access  Public
export const verify2FA = async (req, res) => {
  try {
    const { userId, code, sessionDuration = 24 } = req.body;

    // Validation
    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide user ID and verification code',
      });
    }

    // Get user with 2FA fields
    const user = await User.findById(userId).select('+twoFactorCode +twoFactorCodeExpires');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify code
    const isCodeValid = user.verify2FACode(code);
    if (!isCodeValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired verification code',
      });
    }

    // Clear 2FA code
    user.twoFactorCode = undefined;
    user.twoFactorCodeExpires = undefined;

    // Parse device info
    const deviceInfo = parseDeviceInfo(req);

    // Add device to user
    user.addDevice(deviceInfo);
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Calculate expiration
    const duration = Math.min(
      parseInt(sessionDuration) || 24,
      parseInt(process.env.MAX_SESSION_DURATION) || 720
    );
    const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000);

    // Create session
    const session = await Session.create({
      userId: user._id,
      deviceId: deviceInfo.deviceId,
      token,
      duration,
      expiresAt,
      deviceInfo,
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: duration * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      session: {
        duration,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during verification',
    });
  }
};

// @desc    Resend 2FA code
// @route   POST /api/auth/resend-2fa
// @access  Public
export const resend2FA = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide user ID',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Generate new code
    const code = user.generate2FACode();
    await user.save();

    await send2FACode(user.email, code, user.name);

    res.status(200).json({
      success: true,
      message: 'New verification code sent to your email',
    });
  } catch (error) {
    console.error('Resend 2FA error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  try {
    // Deactivate current session
    await Session.findByIdAndUpdate(req.session._id, { isActive: false });

    // Clear cookie
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0),
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Get all active devices/sessions
// @route   GET /api/auth/devices
// @access  Private
export const getDevices = async (req, res) => {
  try {
    const sessions = await Session.find({
      userId: req.user._id,
      isActive: true,
      expiresAt: { $gt: Date.now() },
    }).sort({ createdAt: -1 });

    const devices = sessions.map((session) => ({
      id: session._id,
      deviceId: session.deviceId,
      deviceName: session.deviceInfo.deviceName,
      browser: session.deviceInfo.browser,
      os: session.deviceInfo.os,
      ip: session.deviceInfo.ip,
      lastActive: session.updatedAt,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: session.token === req.token,
    }));

    res.status(200).json({
      success: true,
      count: devices.length,
      devices,
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Logout from specific device
// @route   DELETE /api/auth/devices/:sessionId
// @access  Private
export const logoutDevice = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({
      _id: sessionId,
      userId: req.user._id,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    session.isActive = false;
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Device logged out successfully',
    });
  } catch (error) {
    console.error('Logout device error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Logout from all devices except current
// @route   POST /api/auth/logout-all
// @access  Private
export const logoutAllDevices = async (req, res) => {
  try {
    await Session.updateMany(
      {
        userId: req.user._id,
        _id: { $ne: req.session._id },
        isActive: true,
      },
      { isActive: false }
    );

    res.status(200).json({
      success: true,
      message: 'Logged out from all other devices',
    });
  } catch (error) {
    console.error('Logout all devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Toggle 2FA
// @route   PUT /api/auth/2fa
// @access  Private
export const toggle2FA = async (req, res) => {
  try {
    const { enabled } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (enabled !== undefined) {
        user.twoFactorEnabled = enabled;
    } else {
        user.twoFactorEnabled = !user.twoFactorEnabled;
    }
    
    await user.save();

    res.status(200).json({
      success: true,
      message: `Two-factor authentication ${user.twoFactorEnabled ? 'enabled' : 'disabled'}`,
      twoFactorEnabled: user.twoFactorEnabled,
    });
  } catch (error) {
    console.error('Toggle 2FA error:', error);
    res.status(500).json({
        success: false,
        message: 'Server error'
    });
  }
};
