import express from 'express';
import {
  getVaultStatus,
  initializeVault,
  getVaultData,
  syncItem,
  deleteItem,
  createTemplate,
  authorizeMcpVaultSession,
  createMcpOneTimeTokenController,
  getMcpVaultSessionStatus,
  revokeMcpVaultSessionController,
} from '../controllers/vaultController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/status', protect, getVaultStatus);
router.post('/init', protect, initializeVault);
router.get('/sync', protect, getVaultData);
router.post('/items', protect, syncItem);
router.delete('/items/:id', protect, deleteItem);
router.post('/templates', protect, createTemplate);

// Secure MCP AI Vault Session & Token routes
router.post('/mcp/authorize', protect, authorizeMcpVaultSession);
router.post('/mcp/token', protect, createMcpOneTimeTokenController);
router.get('/mcp/session', protect, getMcpVaultSessionStatus);
router.post('/mcp/revoke', protect, revokeMcpVaultSessionController);

export default router;
