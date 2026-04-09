const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { getFileByShareId, incrementDownloads } = require('../db');
const { downloadLimiter } = require('../middleware/rateLimiter');

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');

// GET /api/file/:shareId — get file metadata
router.get('/:shareId', downloadLimiter, (req, res) => {
  try {
    const file = getFileByShareId(req.params.shareId);

    if (!file) {
      return res.status(404).json({ error: 'File not found or has been removed.' });
    }

    // Check expiry
    if (new Date(file.expires_at) <= new Date()) {
      return res.status(410).json({ error: 'This file has expired and is no longer available.' });
    }

    // Check max downloads
    if (file.max_downloads && file.downloads >= file.max_downloads) {
      return res.status(410).json({ error: 'This file has reached its maximum download limit.' });
    }

    res.json({
      fileName: file.original_name,
      fileSize: file.size,
      mimeType: file.mime_type,
      hasPassword: !!file.password_hash,
      expiresAt: file.expires_at,
      downloads: file.downloads,
      maxDownloads: file.max_downloads,
      createdAt: file.created_at,
    });
  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({ error: 'Failed to retrieve file information.' });
  }
});

// POST /api/file/:shareId/download — download file (with optional password)
router.post('/:shareId/download', downloadLimiter, async (req, res) => {
  try {
    const file = getFileByShareId(req.params.shareId);

    if (!file) {
      return res.status(404).json({ error: 'File not found or has been removed.' });
    }

    // Check expiry
    if (new Date(file.expires_at) <= new Date()) {
      return res.status(410).json({ error: 'This file has expired and is no longer available.' });
    }

    // Check max downloads
    if (file.max_downloads && file.downloads >= file.max_downloads) {
      return res.status(410).json({ error: 'This file has reached its maximum download limit.' });
    }

    // Check password
    if (file.password_hash) {
      const password = req.body.password;
      if (!password) {
        return res.status(401).json({ error: 'Password required to download this file.' });
      }
      const valid = await bcrypt.compare(password, file.password_hash);
      if (!valid) {
        return res.status(403).json({ error: 'Incorrect password.' });
      }
    }

    const filePath = path.join(uploadDir, file.stored_name);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File data not found on server.' });
    }

    // Increment download counter
    incrementDownloads(req.params.shareId);

    // Stream file download
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', file.size);

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file.' });
  }
});

// GET /api/file/:shareId/qr — get QR code PNG
router.get('/:shareId/qr', async (req, res) => {
  try {
    const file = getFileByShareId(req.params.shareId);

    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = process.env.BASE_URL || `${protocol}://${host}`;
    const shareUrl = `${baseUrl}/s/${file.share_id}`;

    const qrBuffer = await QRCode.toBuffer(shareUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#0a0d14', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(qrBuffer);
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code.' });
  }
});

module.exports = router;
