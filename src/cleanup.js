const fs = require('fs');
const path = require('path');
const { getExpiredFiles, deleteFileRecord } = require('./db');

function cleanupExpiredFiles(uploadDir) {
  try {
    const expired = getExpiredFiles();

    if (expired.length === 0) return;

    console.log(`[Cleanup] Found ${expired.length} expired file(s). Removing...`);

    for (const file of expired) {
      const filePath = path.join(uploadDir, file.stored_name);

      // Delete from disk
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Cleanup] Deleted file: ${file.original_name} (${file.share_id})`);
      }

      // Delete from DB
      deleteFileRecord(file.id);
    }

    console.log(`[Cleanup] Removed ${expired.length} expired file(s).`);
  } catch (err) {
    console.error('[Cleanup] Error during cleanup:', err.message);
  }
}

module.exports = { cleanupExpiredFiles };
