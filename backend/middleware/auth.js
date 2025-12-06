import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Session from '../models/Session.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header or cookies
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
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if session exists and is valid
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

      // Get user
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
