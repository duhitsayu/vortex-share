// ═══════════════════════════════════════════════
//  Vortex — Upload Page Logic
// ═══════════════════════════════════════════════

(function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileSelected = document.getElementById('fileSelected');
  const shareBtn = document.getElementById('shareBtn');
  const progressWrap = document.getElementById('progressWrap');
  const progressFill = document.getElementById('progressFill');
  const progressPct = document.getElementById('progressPct');
  const progressStatus = document.getElementById('progressStatus');
  const resultWrap = document.getElementById('resultWrap');
  const errorBox = document.getElementById('errorBox');
  const qrBox = document.getElementById('qrBox');

  let currentFile = null;
  let qrOpen = false;

  // ── Drag & Drop ───────────────────────────────
  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) setFile(fileInput.files[0]);
  });

  // ── Set File ──────────────────────────────────
  function setFile(f) {
    currentFile = f;
    document.getElementById('fileEmoji').textContent = getEmoji(f.name);
    document.getElementById('fileName').textContent = f.name;
    document.getElementById('fileSize').textContent = formatSize(f.size);
    fileSelected.classList.add('show');
    dropzone.style.display = 'none';
    errorBox.classList.remove('show');
  }

  // ── Remove File ───────────────────────────────
  document.getElementById('fileRemoveBtn').addEventListener('click', () => {
    currentFile = null;
    fileInput.value = '';
    fileSelected.classList.remove('show');
    dropzone.style.display = '';
  });

  // ── Share Button ──────────────────────────────
  shareBtn.addEventListener('click', startUpload);

  async function startUpload() {
    if (!currentFile) {
      dropzone.style.borderColor = '#ef4444';
      setTimeout(() => (dropzone.style.borderColor = ''), 1200);
      return;
    }

    shareBtn.disabled = true;
    errorBox.classList.remove('show');
    resultWrap.classList.remove('show');
    progressWrap.classList.add('show');
    setProgress(5, 'Preparing upload…');

    try {
      const formData = new FormData();
      formData.append('file', currentFile);
      formData.append('expiry', document.getElementById('expirySelect').value);

      const password = document.getElementById('passwordInput').value.trim();
      if (password) {
        formData.append('password', password);
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 85) + 5;
          setProgress(pct, 'Uploading…');
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            setProgress(100, 'Done!');
            setTimeout(() => showResult(data), 300);
          } catch {
            showError('Invalid response from server.');
            resetProgress();
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            showError(err.error || `Upload failed (${xhr.status}).`);
          } catch {
            showError(`Upload failed (${xhr.status}).`);
          }
          resetProgress();
        }
      };

      xhr.onerror = () => {
        showError('Network error. Check your connection and try again.');
        resetProgress();
      };

      xhr.send(formData);
    } catch (err) {
      showError('Upload failed: ' + err.message);
      resetProgress();
    }
  }

  // ── Progress ──────────────────────────────────
  function setProgress(pct, label) {
    progressFill.style.width = pct + '%';
    progressPct.textContent = pct + '%';
    progressStatus.textContent = label;
  }

  function resetProgress() {
    progressWrap.classList.remove('show');
    setProgress(0, 'Uploading…');
    shareBtn.disabled = false;
  }

  function showError(msg) {
    document.getElementById('errorMsg').textContent = msg;
    errorBox.classList.add('show');
    shareBtn.disabled = false;
    progressWrap.classList.remove('show');
  }

  // ── Show Result ───────────────────────────────
  function showResult(data) {
    progressWrap.classList.remove('show');

    document.getElementById('shareUrl').textContent = data.shareUrl;
    document.getElementById('shareUrl').href = data.shareUrl;
    window._shareUrl = data.shareUrl;

    // Expiry label
    const labels = { 1: '1 hour', 24: '24 hours', 72: '3 days', 168: '7 days' };
    document.getElementById('expiryMeta').textContent =
      `Expires in ${labels[data.expiryHours] || data.expiryHours + 'h'}`;

    // Password label
    document.getElementById('passwordMeta').textContent = data.hasPassword
      ? 'Password protected'
      : 'No password';

    // QR code
    qrOpen = false;
    qrBox.classList.remove('show');
    qrBox.innerHTML = '';
    document.getElementById('qrLabel').textContent = 'Show QR Code';

    if (data.qrCode) {
      const img = document.createElement('img');
      img.src = data.qrCode;
      img.alt = 'QR Code';
      img.width = 140;
      img.height = 140;
      qrBox.appendChild(img);
    }

    resultWrap.classList.add('show');
  }

  // ── QR Toggle ─────────────────────────────────
  document.getElementById('qrToggleBtn').addEventListener('click', () => {
    qrOpen = !qrOpen;
    qrBox.classList.toggle('show', qrOpen);
    document.getElementById('qrLabel').textContent = qrOpen ? 'Hide QR Code' : 'Show QR Code';
  });

  // ── Copy Link ─────────────────────────────────
  document.getElementById('copyBtn').addEventListener('click', copyLink);

  function copyLink() {
    const url = window._shareUrl;
    if (!url) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(onCopied).catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); onCopied(); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function onCopied() {
    const btn = document.getElementById('copyBtn');
    btn.classList.add('copied');
    btn.innerHTML = '✓ Copied!';
    showToast('✅ Link copied to clipboard!');
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2500);
  }

  // ── Reset ─────────────────────────────────────
  document.getElementById('resetBtn').addEventListener('click', () => {
    currentFile = null;
    fileInput.value = '';
    fileSelected.classList.remove('show');
    dropzone.style.display = '';
    shareBtn.disabled = false;
    setProgress(0, 'Uploading…');
    progressWrap.classList.remove('show');
    resultWrap.classList.remove('show');
    errorBox.classList.remove('show');
    document.getElementById('passwordInput').value = '';
    window._shareUrl = '';
  });

  // ── Toast ─────────────────────────────────────
  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // ── Helpers ───────────────────────────────────
  function getEmoji(name) {
    const ext = name.split('.').pop().toLowerCase();
    const map = {
      pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
      ppt: '📑', pptx: '📑', zip: '📦', rar: '📦', '7z': '📦',
      jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
      mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬',
      mp3: '🎵', wav: '🎵', flac: '🎵',
      js: '💻', ts: '💻', py: '💻', html: '💻', css: '💻', json: '💻',
      txt: '📃', md: '📃', csv: '📃',
    };
    return map[ext] || '📁';
  }

  function formatSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
  }
})();
