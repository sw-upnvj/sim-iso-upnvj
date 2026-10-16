// ============================================
// api.js - Wrapper untuk call API Apps Script
// + Cache layer + Helper menu sidebar
// ============================================

// ============================================
// CALL API (dengan validasi session)
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

// ============================================
// CALL API DENGAN CACHE (untuk data yang jarang berubah)
// ============================================
function callAPIWithCache(action, payload = {}, ttlMs = 5 * 60 * 1000) {
  const cacheKey = 'cache_' + action + '_' + JSON.stringify(payload);
  
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < ttlMs) {
        console.log('📦 Cache hit:', action);
        return Promise.resolve(data);
      }
      // Cache kadaluarsa → hapus
      localStorage.removeItem(cacheKey);
    }
  } catch (e) {
    console.warn('Cache read error:', e);
  }
  
  return callAPI(action, payload).then(result => {
    if (result.success) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          data: result,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Cache save error:', e);
      }
    }
    return result;
  });
}

// ============================================
// BERSIHKAN SEMUA CACHE (panggil setelah edit data)
// ============================================
function clearAPICache() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('cache_'));
    keys.forEach(k => localStorage.removeItem(k));
    console.log('🗑️ Cache cleared:', keys.length, 'entries');
  } catch (e) {
    console.warn('Cache clear error:', e);
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================
function getSession() {
  const s = localStorage.getItem('iso_session');
  if (!s) return null;
  
  try {
    const session = JSON.parse(s);
    
    // ===== Validasi: harus punya user & token =====
    if (!session.user || !session.token) {
      console.warn('⚠️ Session rusak, dibersihkan');
      localStorage.removeItem('iso_session');
      return null;
    }
    
    return session;
  } catch (e) {
    console.warn('⚠️ Session parse error, dibersihkan');
    localStorage.removeItem('iso_session');
    return null;
  }
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

// ============================================
// TOAST NOTIFICATION
// ============================================
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

// ============================================
// ESCAPE HTML (anti-XSS)
// ============================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// HELPER MENU SIDEBAR
// Semua fungsi ini dipanggil SETELAH login
// ============================================

function showMenuRekap() {
  const s = getSession();
  if (!s || !s.user) return;
  if (s.user.role === 'administrator' || s.user.role === 'auditor') {
    const el = document.getElementById('sidebar-rekap');
    if (el) el.style.display = 'flex';
  }
}

function showMenuPresensi() {
  const s = getSession();
  if (!s || !s.user) return;
  if (s.user.role === 'administrator' || s.user.role === 'auditor') {
    const el = document.getElementById('sidebar-absensi');
    if (el) el.style.display = 'flex';
  }
}

function showMenuAdmin() {
  const s = getSession();
  if (!s || !s.user) return;
  if (s.user.role !== 'administrator') return;
  
  const ids = ['sidebar-manage-user', 'sidebar-manage-rtl'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
  });
}

// ============================================
// Sembunyikan section title yang kosong
// (semua menu di bawahnya hidden)
// ============================================
function hideEmptySections() {
  const sections = document.querySelectorAll('.sidebar-section-title');
  
  sections.forEach((title) => {
    let next = title.nextElementSibling;
    let hasVisibleMenu = false;
    
    while (next && !next.classList.contains('sidebar-section-title')) {
      if (next.tagName === 'A' && next.style.display !== 'none') {
        hasVisibleMenu = true;
        break;
      }
      next = next.nextElementSibling;
    }
    
    if (!hasVisibleMenu) {
      title.style.display = 'none';
    } else {
      title.style.display = 'block';
    }
  });
}