import multer from 'multer';
import { parsePdf, reconstructAndEditPdf, createSamplePdf } from '../services/pdfEditorService.js';
import DriveFile from '../models/DriveFile.js';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET_NAME = process.env.R2_BUCKET;

// Memory storage for multer - no files written to disk, 100% Heroku dyno compliant
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 }, // 40MB limit
});

export const uploadMiddleware = upload.single('pdf');

/**
 * Parses an uploaded PDF and returns its structural text blocks,
 * dimensions, and page count for interactive editing.
 */
export async function parsePdfController(req, res) {
  try {
    let pdfBuffer;

    if (req.file && req.file.buffer) {
      pdfBuffer = req.file.buffer;
    } else if (req.body && req.body.pdfBase64) {
      const base64Data = req.body.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      pdfBuffer = Buffer.from(base64Data, 'base64');
    } else {
      return res.status(400).json({
        success: false,
        message: 'No PDF file or base64 data provided',
      });
    }

    const parsedData = await parsePdf(pdfBuffer);

    res.status(200).json({
      success: true,
      data: parsedData,
    });
  } catch (error) {
    console.error('Error in parsePdfController:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to parse PDF document: ' + error.message,
    });
  }
}

/**
 * Reconstructs a PDF by stripping target text operators from the content stream
 * and rendering replacement / new text using embedded standard fonts.
 */
export async function editPdfController(req, res) {
  try {
    let pdfBuffer;
    let edits = {};

    if (req.file && req.file.buffer) {
      pdfBuffer = req.file.buffer;
      if (req.body.edits) {
        try {
          edits = typeof req.body.edits === 'string' ? JSON.parse(req.body.edits) : req.body.edits;
        } catch {
          edits = {};
        }
      }
    } else if (req.body && req.body.pdfBase64) {
      const base64Data = req.body.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      pdfBuffer = Buffer.from(base64Data, 'base64');
      edits = req.body.edits || {};
    } else {
      return res.status(400).json({
        success: false,
        message: 'No PDF provided for editing',
      });
    }

    const modifiedPdfBuffer = await reconstructAndEditPdf(pdfBuffer, edits);

    const filename = req.body.filename || req.file?.originalname || 'edited-document.pdf';
    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

    if (req.query.format === 'json') {
      return res.status(200).json({
        success: true,
        filename: safeFilename,
        pdfBase64: `data:application/pdf;base64,${modifiedPdfBuffer.toString('base64')}`,
        size: modifiedPdfBuffer.length,
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', modifiedPdfBuffer.length);
    res.send(modifiedPdfBuffer);
  } catch (error) {
    console.error('Error in editPdfController:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reconstruct PDF: ' + error.message,
    });
  }
}

/**
 * Returns a pre-built sample invoice PDF to allow testing without user uploads
 */
export async function samplePdfController(req, res) {
  try {
    const type = req.params.type || 'invoice';
    const sampleBuffer = await createSamplePdf(type);

    if (req.query.format === 'json') {
      const parsed = await parsePdf(sampleBuffer);
      return res.status(200).json({
        success: true,
        filename: `sample-${type}.pdf`,
        pdfBase64: `data:application/pdf;base64,${sampleBuffer.toString('base64')}`,
        parsed,
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="sample-${type}.pdf"`);
    res.send(sampleBuffer);
  } catch (error) {
    console.error('Error in samplePdfController:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sample PDF: ' + error.message,
    });
  }
}

/**
 * Saves edited PDF directly into the user's DayToDay Secure Drive
 */
export async function saveToDriveController(req, res) {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Authentication required to save to Drive' });
    }

    const { pdfBase64, filename, folderId } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ success: false, message: 'Missing pdfBase64 data' });
    }

    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const safeFilename = filename || `Edited_Document_${Date.now()}.pdf`;

    const r2Key = `users/${req.user._id || req.user.id}/${crypto.randomUUID()}-${safeFilename}`;

    if (BUCKET_NAME) {
      try {
        await r2.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: r2Key,
            Body: buffer,
            ContentType: 'application/pdf',
          })
        );
      } catch (uploadErr) {
        console.warn('Storage upload note:', uploadErr.message);
      }
    }

    const fileDoc = await DriveFile.create({
      user: req.user._id || req.user.id,
      name: safeFilename,
      r2Key,
      mimeType: 'application/pdf',
      size: buffer.length,
      folder: folderId || null,
    });

    res.status(200).json({
      success: true,
      message: 'PDF saved successfully to Secure Drive',
      file: fileDoc,
    });
  } catch (error) {
    console.error('Error saving to drive:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save PDF to Secure Drive: ' + error.message,
    });
  }
}
