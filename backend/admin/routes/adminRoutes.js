import express from 'express';
import { adminProtect } from '../middleware/adminAuth.js';
import {
  adminLogin,
  getAdminMe,
  adminLogout,
  getAuthEvents,
  getAuthStats,
} from '../controllers/adminAuthController.js';
import { getDashboardStats } from '../controllers/adminDashboardController.js';
import {
  getUsers,
  getUserDetails,
  createUser,
  toggleUserStatus,
  deleteUser,
  logoutUserSessions,
  resetUser2fa,
} from '../controllers/adminUserController.js';
import {
  getSessions,
  terminateSession,
  terminateUserSessions,
  terminateAllSessions,
} from '../controllers/adminSessionController.js';
import {
  getTwoFactorChallenges,
  invalidateChallenge,
} from '../controllers/adminTwoFactorController.js';
import {
  getDevices,
  revokeDevice,
} from '../controllers/adminDeviceController.js';
import {
  getMcpClients,
  getMcpClientDetails,
  registerMcpClient,
  toggleClientStatus,
  deleteMcpClient,
} from '../controllers/adminMcpController.js';
import { getSystemInfo } from '../controllers/adminSystemController.js';
import { getLogs, clearLogs } from '../controllers/adminLogsController.js';

const router = express.Router();

// 1. Public Authentication Route
router.post('/auth/login', adminLogin);

// 2. All subsequent admin routes require valid admin session
router.use(adminProtect);

// Admin Auth & Profile
router.get('/auth/me', getAdminMe);
router.post('/auth/logout', adminLogout);
router.get('/auth/events', getAuthEvents);
router.get('/auth/stats', getAuthStats);

// Dashboard
router.get('/dashboard', getDashboardStats);

// User Management
router.get('/users', getUsers);
router.post('/users', createUser);
router.get('/users/:id', getUserDetails);
router.patch('/users/:id/status', toggleUserStatus);
router.delete('/users/:id', deleteUser);
router.post('/users/:id/logout-all', logoutUserSessions);
router.post('/users/:id/reset-2fa', resetUser2fa);

// Session Management
router.get('/sessions', getSessions);
router.delete('/sessions/:id', terminateSession);
router.post('/sessions/logout-user/:userId', terminateUserSessions);
router.post('/sessions/logout-all', terminateAllSessions);

// 2FA Management
router.get('/2fa/challenges', getTwoFactorChallenges);
router.post('/2fa/invalidate/:userId', invalidateChallenge);

// Device Management
router.get('/devices', getDevices);
router.delete('/devices/:deviceId', revokeDevice);

// MCP / OAuth Clients
router.get('/mcp/clients', getMcpClients);
router.post('/mcp/clients', registerMcpClient);
router.get('/mcp/clients/:id', getMcpClientDetails);
router.patch('/mcp/clients/:id/status', toggleClientStatus);
router.delete('/mcp/clients/:id', deleteMcpClient);

// System Info
router.get('/system', getSystemInfo);

// Logs
router.get('/logs', getLogs);
router.post('/logs/clear', clearLogs);

export default router;
