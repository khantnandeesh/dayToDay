import express from 'express';
import { runCode, getLanguages } from '../controllers/codeController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Get list of supported programming languages
router.get('/languages', protect, getLanguages);

// Execute source code via OnlineCompiler.io
router.post('/run', protect, runCode);

export default router;
