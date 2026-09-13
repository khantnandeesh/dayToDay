import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Session from '../models/Session.js';

export const getJwtSecret = () => {
  return process.env.JWT_SECRET || 'nandeesh-admin-daytoday-secret-jwt-key-2026';
};

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret());

      const session = await Session.findOne({
        token,
        userId: decoded.id,
        isActive: true,
      });

      if (!session || !session.isValid()) {
        return res.status(401).json({
          success: false,
          message: 'Session expired or invalid',
        });
      }

      const user = await User.findById(decoded.id).select('-password');

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive',
        });
      }

      req.user = user;
      req.session = session;
      req.token = token;

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

export const adminProtect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in as an administrator.',
      });
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret());

      const session = await Session.findOne({
        token,
        userId: decoded.id,
        isActive: true,
      });

      if (!session || !session.isValid()) {
        return res.status(401).json({
          success: false,
          message: 'Admin session has expired. Please log in again.',
        });
      }

      const user = await User.findById(decoded.id).select('-password');

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or account is disabled',
        });
      }

      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Administrator privileges required',
        });
      }

      req.user = user;
      req.session = session;
      req.token = token;

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired administrative session',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error verifying admin credentials',
    });
  }
};

export const optionalProtect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret());
      const session = await Session.findOne({
        token,
        userId: decoded.id,
        isActive: true,
      });

      if (session && session.isValid()) {
        const user = await User.findById(decoded.id).select('-password');
        if (user && user.isActive) {
          req.user = user;
          req.session = session;
          req.token = token;
        }
      }
    } catch {
      // Non-fatal for optional auth
    }
    next();
  } catch {
    next();
  }
};
