import express from 'express';
import { runCode, getLanguages } from '../controllers/codeController.js';
import { optionalProtect } from '../middleware/auth.js';

const router = express.Router();

// Get list of supported programming languages
router.get('/languages', optionalProtect, getLanguages);

// Execute source code via local Python runner or OnlineCompiler
router.post('/run', optionalProtect, runCode);

export default router;
