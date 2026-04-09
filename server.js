require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cron = require('node-cron');

const { initDB } = require('./src/db');
const { cleanupExpiredFiles } = require('./src/cleanup');
const uploadRoutes = require('./src/routes/upload');
const downloadRoutes = require('./src/routes/download');

const app = express();
const PORT = parseInt(process.env.PORT) || 3000;
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const DB_PATH = path.resolve(process.env.DB_PATH || './data/vortex.db');

// ── Ensure directories exist ──────────────────
[UPLOAD_DIR, path.dirname(DB_PATH)].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Initialize database ───────────────────────
initDB(DB_PATH);
console.log('✓ Database initialized');

// ── Security middleware ───────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(compression());

// ── Body parsing ──────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files ──────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API routes ────────────────────────────────
app.use('/api/upload', uploadRoutes);
app.use('/api/file', downloadRoutes);

// ── Share link route (serve download page) ────
app.get('/s/:shareId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'download.html'));
});

// ── Health check ──────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── Error handling ────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Cleanup cron (every 10 minutes) ───────────
cron.schedule('*/10 * * * *', () => {
  cleanupExpiredFiles(UPLOAD_DIR);
});

// Run cleanup once on startup
cleanupExpiredFiles(UPLOAD_DIR);

// ── Start server ──────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║                                           ║
  ║   ⚡ Vortex is running                    ║
  ║   → http://localhost:${PORT}                ║
  ║   → Upload dir: ${UPLOAD_DIR}
  ║                                           ║
  ╚═══════════════════════════════════════════╝
  `);
});

module.exports = app;
