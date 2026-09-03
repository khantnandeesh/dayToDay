import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { send2FACode, sendWelcomeEmail, sendLoginAlert, checkEmailProviders } from '../config/email.js';
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

        const emailResult = await send2FACode(email, code, user.name);

        return res.status(200).json({
            success: true,
            message: '2FA code sent to your email',
            userId: user._id,
            requires2FA: true,
            emailDelivery: {
              provider: emailResult.provider || 'simulated',
              fallback: Boolean(emailResult.fallback),
            },
        });
    }

    // 2FA Disabled: Create session directly
    
    // Parse device info
    const deviceInfo = parseDeviceInfo(req);

    // Add device to user
    user.addDevice(deviceInfo);
    await user.save();

    // Send Login Alert
    await sendLoginAlert(email, user.name, deviceInfo);

    // Generate token
    const token = generateToken(user._id);

    // Default duration (24h) if not specified
    const duration = 24;
    const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000);

    // Invalidate previous active sessions for this specific device
    await Session.updateMany(
      { userId: user._id, deviceId: deviceInfo.deviceId, isActive: true },
      { isActive: false }
    ).catch(() => {});

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

    // Send Login Alert
    await sendLoginAlert(user.email, user.name, deviceInfo);

    // Generate token
    const token = generateToken(user._id);

    // Calculate expiration
    const duration = Math.min(
      parseInt(sessionDuration) || 24,
      parseInt(process.env.MAX_SESSION_DURATION) || 720
    );
    const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000);

    // Invalidate previous active sessions for this specific device
    await Session.updateMany(
      { userId: user._id, deviceId: deviceInfo.deviceId, isActive: true },
      { isActive: false }
    ).catch(() => {});

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

    const emailResult = await send2FACode(user.email, code, user.name);

    res.status(200).json({
      success: true,
      message: 'New verification code sent to your email',
      emailDelivery: {
        provider: emailResult.provider || 'simulated',
        fallback: Boolean(emailResult.fallback),
      },
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
    }).sort({ updatedAt: -1, createdAt: -1 });

    // Deduplicate sessions representing the same physical device/browser
    const seenDeviceKeys = new Set();
    const uniqueSessions = [];
    const duplicateSessionIds = [];

    // Prioritize current session if present in the list
    const currentSession = sessions.find((s) => s.token === req.token);
    if (currentSession) {
      const devKey =
        currentSession.deviceId ||
        `${currentSession.deviceInfo?.os}_${currentSession.deviceInfo?.browser}`;
      seenDeviceKeys.add(devKey);
      uniqueSessions.push(currentSession);
    }

    for (const s of sessions) {
      if (currentSession && s._id.toString() === currentSession._id.toString()) {
        continue;
      }

      // Group by explicit deviceId or by OS + Browser combination
      const devKey =
        s.deviceId ||
        `${s.deviceInfo?.os}_${s.deviceInfo?.browser}`;

      if (seenDeviceKeys.has(devKey)) {
        duplicateSessionIds.push(s._id);
      } else {
        seenDeviceKeys.add(devKey);
        uniqueSessions.push(s);
      }
    }

    // Clean up stale duplicate sessions in the background
    if (duplicateSessionIds.length > 0) {
      Session.updateMany(
        { _id: { $in: duplicateSessionIds } },
        { isActive: false }
      ).catch(() => {});
    }

    const devices = uniqueSessions.map((session) => {
      const info = session.deviceInfo || {};
      const rawIp = info.ip || '';
      const cleanIp = rawIp.replace(/^::ffff:/, '');
      const isCurrent = session.token === req.token;

      // Extract or infer OS
      const os = info.os || 'Unknown OS';
      const osName =
        info.osName ||
        (/mac/i.test(os) ? 'macOS' : /win/i.test(os) ? 'Windows' : /linux/i.test(os) ? 'Linux' : /ios/i.test(os) ? 'iOS' : /android/i.test(os) ? 'Android' : 'OS');

      // Extract or infer Browser
      const browser = info.browser || 'Web Browser';
      const browserName =
        info.browserName ||
        (/chrome/i.test(browser) ? 'Chrome' : /safari/i.test(browser) ? 'Safari' : /firefox/i.test(browser) ? 'Firefox' : /edge/i.test(browser) ? 'Edge' : 'Browser');

      // Infer device type and brand
      const brand =
        info.brand ||
        (/mac|ios|apple/i.test(os) ? 'apple' : /win/i.test(os) ? 'microsoft' : /android/i.test(os) ? 'android' : /linux/i.test(os) ? 'linux' : 'generic');

      const deviceType = info.deviceType || (/mobile/i.test(os) ? 'mobile' : 'desktop');

      const deviceName =
        info.deviceName ||
        (brand === 'apple' ? (deviceType === 'mobile' ? 'Apple iPhone' : 'Apple Mac') : `${osName} Device`);

      return {
        id: session._id,
        deviceId: session.deviceId,
        deviceName,
        browser,
        browserName,
        browserVersion: info.browserVersion || '',
        os,
        osName,
        osVersion: info.osVersion || '',
        deviceType,
        brand,
        ip: cleanIp === '::1' || cleanIp === '127.0.0.1' ? '127.0.0.1' : (cleanIp || 'Direct Network'),
        lastActive: session.updatedAt || session.createdAt,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        isCurrent,
      };
    });

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

// @desc    Check email provider health status
// @route   GET /api/auth/email-status
// @access  Public
export const getEmailStatus = async (req, res) => {
  try {
    const status = await checkEmailProviders();
    res.status(200).json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Send test email to verify configuration
// @route   POST /api/auth/test-email
// @access  Public
export const sendTestVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide recipient email address',
      });
    }

    const testCode = '123456';
    const result = await send2FACode(email, testCode, 'Tester');

    res.status(200).json({
      success: true,
      message: `Test email dispatched to ${email}`,
      result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

