// ═══════════════════════════════════════════════
//  Vortex — Download Page Logic
// ═══════════════════════════════════════════════

(function () {
  'use strict';

  const loadingState = document.getElementById('loadingState');
  const downloadState = document.getElementById('downloadState');
  const expiredState = document.getElementById('expiredState');

  // Extract shareId from URL: /s/:shareId
  const pathParts = window.location.pathname.split('/');
  const shareId = pathParts[pathParts.length - 1];

  if (!shareId) {
    showExpired('Invalid Link', 'This share link is malformed.');
    return;
  }

  // ── Load file info ────────────────────────────
  fetchFileInfo();

  async function fetchFileInfo() {
    try {
      const res = await fetch(`/api/file/${shareId}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 410) {
          showExpired('File Expired', data.error || 'This file has expired and is no longer available.');
        } else {
          showExpired('File Not Found', data.error || 'This file does not exist or has been removed.');
        }
        return;
      }

      showDownload(data);
    } catch (err) {
      showExpired('Connection Error', 'Could not reach the server. Please try again.');
    }
  }

  // ── Show download state ───────────────────────
  function showDownload(data) {
    loadingState.style.display = 'none';

    document.getElementById('dlFileName').textContent = data.fileName;
    document.getElementById('dlFileSize').textContent = formatSize(data.fileSize);
    document.getElementById('dlDownloads').textContent = data.downloads + ' download' + (data.downloads !== 1 ? 's' : '');

    // Expiry
    const expiresAt = new Date(data.expiresAt);
    const now = new Date();
    const diffMs = expiresAt - now;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);

    if (diffHours > 24) {
      const days = Math.ceil(diffHours / 24);
      document.getElementById('dlExpiry').textContent = `Expires in ${days} day${days > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      document.getElementById('dlExpiry').textContent = `Expires in ${diffHours}h ${diffMins}m`;
    } else {
      document.getElementById('dlExpiry').textContent = `Expires in ${diffMins}m`;
    }

    // Password
    if (data.hasPassword) {
      document.getElementById('passwordSection').style.display = 'block';
    }

    // Share URL + QR
    const shareUrl = window.location.href;
    document.getElementById('dlShareUrl').textContent = shareUrl;

    // Load QR from server
    const qrImg = document.createElement('img');
    qrImg.src = `/api/file/${shareId}/qr`;
    qrImg.alt = 'QR Code';
    qrImg.width = 160;
    qrImg.height = 160;
    qrImg.style.display = 'block';
    document.getElementById('dlQrBox').appendChild(qrImg);

    downloadState.style.display = 'block';

    // ── Download button ─────────────────────────
    document.getElementById('downloadBtn').addEventListener('click', startDownload);

    // ── Copy button ─────────────────────────────
    document.getElementById('dlCopyBtn').addEventListener('click', () => {
      copyToClipboard(shareUrl);
    });
  }

  // ── Start Download ────────────────────────────
  async function startDownload() {
    const btn = document.getElementById('downloadBtn');
    const errorBox = document.getElementById('dlErrorBox');
    errorBox.classList.remove('show');

    const body = {};
    const passwordInput = document.getElementById('dlPassword');
    if (passwordInput && passwordInput.value.trim()) {
      body.password = passwordInput.value.trim();
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></span> Downloading…`;

    try {
      const res = await fetch(`/api/file/${shareId}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        document.getElementById('dlErrorMsg').textContent = err.error || 'Download failed.';
        errorBox.classList.add('show');
        btn.disabled = false;
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download File`;
        return;
      }

      // Get filename from Content-Disposition header
      const disposition = res.headers.get('Content-Disposition');
      let filename = 'download';
      if (disposition) {
        const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
        if (match) filename = decodeURIComponent(match[1]);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Downloaded!`;
      btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

      // Update download count
      const dlCount = document.getElementById('dlDownloads');
      const current = parseInt(dlCount.textContent) || 0;
      const newCount = current + 1;
      dlCount.textContent = newCount + ' download' + (newCount !== 1 ? 's' : '');

      setTimeout(() => {
        btn.disabled = false;
        btn.style.background = '';
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Again`;
      }, 3000);
    } catch (err) {
      document.getElementById('dlErrorMsg').textContent = 'Network error. Please try again.';
      errorBox.classList.add('show');
      btn.disabled = false;
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download File`;
    }
  }

  // ── Show expired ──────────────────────────────
  function showExpired(title, msg) {
    loadingState.style.display = 'none';
    document.getElementById('expiredTitle').textContent = title;
    document.getElementById('expiredMsg').textContent = msg;
    expiredState.style.display = 'block';
  }

  // ── Copy to clipboard ─────────────────────────
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onCopied).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
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
    const btn = document.getElementById('dlCopyBtn');
    btn.classList.add('copied');
    btn.innerHTML = '✓ Copied!';
    showToast('✅ Link copied to clipboard!');
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    }, 2500);
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // ── Helpers ───────────────────────────────────
  function formatSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
  }
})();
