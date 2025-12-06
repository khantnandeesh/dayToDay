import express from 'express';
import {
  register,
  login,
  verify2FA,
  resend2FA,
  getMe,
  logout,
  getDevices,
  logoutDevice,
  logoutAllDevices,
  toggle2FA,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-2fa', verify2FA);
router.post('/resend-2fa', resend2FA);

// Protected routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);
router.put('/2fa', protect, toggle2FA);
router.get('/devices', protect, getDevices);
router.delete('/devices/:sessionId', protect, logoutDevice);
router.post('/logout-all', protect, logoutAllDevices);

export default router;
