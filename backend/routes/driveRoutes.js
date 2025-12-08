import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getUploadUrl,
  saveFileMetadata,
  getDriveContent,
  createFolder,
  getFileUrl,
  deleteItem,
  shareItem,
  getPublicFile,
  restoreItem,
  renameItem,
  deletePermanent,
  revokeShare
} from '../controllers/driveController.js';

const router = express.Router();

router.get('/public/:token', getPublicFile); // Public route

router.use(protect); // All routes protected

router.get('/content', getDriveContent);
router.post('/upload-url', getUploadUrl);
router.post('/finalize', saveFileMetadata);
router.post('/folder', createFolder);
router.get('/file/:fileId/url', getFileUrl);
router.post('/delete', deleteItem);
router.post('/share', shareItem);
router.post('/restore', restoreItem);
router.post('/rename', renameItem);
router.post('/delete-permanent', deletePermanent);
router.post('/revoke-share', revokeShare);

export default router;
