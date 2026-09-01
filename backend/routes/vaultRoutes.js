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
  authorizeAIVaultSession,
  completeAIVaultSessionAuthorization,
  getAIVaultSessionStatus,
  revokeAIVaultSession,
  createVaultAccessLink,
  accessVaultViaLink,
  revokeVaultAccessLink,
  getVaultAuditLog,
} from '../controllers/vaultController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/status', protect, getVaultStatus);
router.post('/init', protect, initializeVault);
router.get('/sync', protect, getVaultData);
router.post('/items', protect, syncItem);
router.delete('/items/:id', protect, deleteItem);
router.post('/templates', protect, createTemplate);

// Secure MCP AI Vault Session & Token routes (legacy)
router.post('/mcp/authorize', protect, authorizeMcpVaultSession);
router.post('/mcp/token', protect, createMcpOneTimeTokenController);
router.get('/mcp/session', protect, getMcpVaultSessionStatus);
router.post('/mcp/revoke', protect, revokeMcpVaultSessionController);

// Capability-based AI Vault Session routes
router.post('/ai-session/authorize', protect, authorizeAIVaultSession);
router.post('/ai-session/complete', protect, completeAIVaultSessionAuthorization);
router.get('/ai-session/status', protect, getAIVaultSessionStatus);
router.post('/ai-session/revoke/:id', protect, revokeAIVaultSession);

// Secure access link routes
router.post('/access-link/create', protect, createVaultAccessLink);
router.get('/access-link/:token', accessVaultViaLink); // Public - token-gated
router.post('/access-link/revoke/:id', protect, revokeVaultAccessLink);

// Audit log
router.get('/audit-log', protect, getVaultAuditLog);

export default router;
