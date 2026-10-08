// ============================================
// api.js - Wrapper untuk call API Apps Script
// ============================================

async function callAPI(action, payload = {}) {
  const session = getSession();
  const body = { action, ...payload };
  if (session && session.token) body.token = session.token;
  
  try {
    const response = await fetch(APP_CONFIG.API_URL, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    
    const data = await response.json();
    
    if (!data.success && data.message && 
        data.message.toLowerCase().includes('session')) {
      clearSession();
      window.location.href = 'index.html';
      return data;
    }
    
    return data;
  } catch (err) {
    console.error('API Error:', err);
    return { success: false, message: 'Koneksi gagal: ' + err.message };
  }
}

function getSession() {
  const s = localStorage.getItem('iso_session');
  return s ? JSON.parse(s) : null;
}

function setSession(data) {
  localStorage.setItem('iso_session', JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem('iso_session');
}

function requireLogin() {
  const session = getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:' +
    (type === 'error' ? '#dc2626' : '#059669') +
    ';color:white;padding:14px 20px;border-radius:8px;font-size:14px;' +
    'z-index:9999;box-shadow:0 10px 25px rgba(0,0,0,0.2);';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}