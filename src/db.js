const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;

function initDB(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT DEFAULT 'application/octet-stream',
      share_id TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      expires_at DATETIME NOT NULL,
      downloads INTEGER DEFAULT 0,
      max_downloads INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_share_id ON files(share_id);
    CREATE INDEX IF NOT EXISTS idx_expires_at ON files(expires_at);
  `);

  return db;
}

function getDB() {
  if (!db) throw new Error('Database not initialized. Call initDB() first.');
  return db;
}

function insertFile({ originalName, storedName, size, mimeType, shareId, passwordHash, expiresAt, maxDownloads }) {
  const stmt = getDB().prepare(`
    INSERT INTO files (original_name, stored_name, size, mime_type, share_id, password_hash, expires_at, max_downloads)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(originalName, storedName, size, mimeType, shareId, passwordHash, expiresAt, maxDownloads || null);
}

function getFileByShareId(shareId) {
  const stmt = getDB().prepare('SELECT * FROM files WHERE share_id = ?');
  return stmt.get(shareId);
}

function incrementDownloads(shareId) {
  const stmt = getDB().prepare('UPDATE files SET downloads = downloads + 1 WHERE share_id = ?');
  return stmt.run(shareId);
}

function getExpiredFiles() {
  const stmt = getDB().prepare("SELECT * FROM files WHERE expires_at <= datetime('now')");
  return stmt.all();
}

function deleteFileRecord(id) {
  const stmt = getDB().prepare('DELETE FROM files WHERE id = ?');
  return stmt.run(id);
}

function getStats() {
  const totalFiles = getDB().prepare('SELECT COUNT(*) as count FROM files').get();
  const totalSize = getDB().prepare('SELECT COALESCE(SUM(size), 0) as total FROM files').get();
  const totalDownloads = getDB().prepare('SELECT COALESCE(SUM(downloads), 0) as total FROM files').get();
  return {
    totalFiles: totalFiles.count,
    totalSize: totalSize.total,
    totalDownloads: totalDownloads.total,
  };
}

module.exports = {
  initDB,
  getDB,
  insertFile,
  getFileByShareId,
  incrementDownloads,
  getExpiredFiles,
  deleteFileRecord,
  getStats,
};
