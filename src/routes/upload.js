const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { nanoid } = require('nanoid');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { insertFile } = require('../db');
const { uploadLimiter } = require('../middleware/rateLimiter');

// Configure multer storage
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${nanoid(12)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const maxSize = (parseInt(process.env.MAX_FILE_SIZE_MB) || 100) * 1024 * 1024;

const upload = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter: (req, file, cb) => {
    // Block dangerous executable types
    const blocked = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blocked.includes(ext)) {
      return cb(new Error('This file type is not allowed.'));
    }
    cb(null, true);
  },
});

// POST /api/upload
router.post('/', uploadLimiter, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: `File too large. Max size is ${process.env.MAX_FILE_SIZE_MB || 100}MB.` });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
      const shareId = nanoid(10);
      const expiryHours = parseInt(req.body.expiry) || 1;
      const allowedExpiry = [1, 24, 72, 168];
      const hours = allowedExpiry.includes(expiryHours) ? expiryHours : 1;

      // Calculate expiry date
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

      // Hash password if provided
      let passwordHash = null;
      if (req.body.password && req.body.password.trim()) {
        passwordHash = await bcrypt.hash(req.body.password.trim(), 10);
      }

      // Max downloads (optional)
      const maxDownloads = req.body.maxDownloads ? parseInt(req.body.maxDownloads) : null;

      // Insert into DB
      insertFile({
        originalName: req.file.originalname,
        storedName: req.file.filename,
        size: req.file.size,
        mimeType: req.file.mimetype,
        shareId,
        passwordHash,
        expiresAt,
        maxDownloads,
      });

      // Generate share URL
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const shareUrl = `${baseUrl}/s/${shareId}`;

      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(shareUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#0a0d14', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });

      res.json({
        success: true,
        shareId,
        shareUrl,
        qrCode: qrDataUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        expiresAt,
        expiryHours: hours,
        hasPassword: !!passwordHash,
      });
    } catch (error) {
      console.error('Upload processing error:', error);
      res.status(500).json({ error: 'Failed to process upload.' });
    }
  });
});

module.exports = router;
