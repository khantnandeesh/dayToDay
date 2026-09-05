import express from 'express';
import {
  parsePdfController,
  editPdfController,
  samplePdfController,
  saveToDriveController,
  uploadMiddleware,
} from '../controllers/pdfEditorController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public parsing and editing endpoints (supports interactive editing without mandatory auth)
router.post('/parse', uploadMiddleware, parsePdfController);
router.post('/edit', uploadMiddleware, editPdfController);
router.get('/sample/:type?', samplePdfController);

// Authenticated route to persist modified PDF directly into Secure Drive
router.post('/save-to-drive', protect, saveToDriveController);

export default router;
