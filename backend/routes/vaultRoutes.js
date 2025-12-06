import express from 'express';
import {
  getVaultStatus,
  initializeVault,
  getVaultData,
  syncItem,
  deleteItem,
  createTemplate
} from '../controllers/vaultController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/status', protect, getVaultStatus);
router.post('/init', protect, initializeVault);
router.get('/sync', protect, getVaultData);
router.post('/items', protect, syncItem);
router.delete('/items/:id', protect, deleteItem);
router.post('/templates', protect, createTemplate);

export default router;
