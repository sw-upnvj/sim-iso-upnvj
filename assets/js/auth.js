// ============================================
// auth.js - Login handler dengan Google
// ============================================

async function handleCredentialResponse(response) {
  const messageEl = document.getElementById('message');
  messageEl.innerHTML = '<div style="background:#dbeafe;color:#1e40af;padding:12px;border-radius:8px;font-size:14px;">⏳ Memverifikasi login...</div>';
  
  const result = await callAPI('login', { credential: response.credential });
  
  if (result.success) {
    setSession({
      user: result.user,
      token: result.token,
      loginAt: Date.now()
    });
    
    messageEl.innerHTML = '<div style="background:#d1fae5;color:#065f46;padding:12px;border-radius:8px;font-size:14px;">✅ Login sukses! Mengalihkan...</div>';
    
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 800);
  } else {
    messageEl.innerHTML = '<div style="background:#fee2e2;color:#991b1b;padding:12px;border-radius:8px;font-size:14px;">❌ ' + escapeHtml(result.message) + '</div>';
  }
}

window.addEventListener('load', () => {
  const existing = getSession();
  if (existing && existing.token && window.location.pathname.endsWith('index.html')) {
    window.location.href = 'dashboard.html';
  }
});

// ============================================
// Load Public Stats — untuk preview card di login
// ============================================
async function loadPublicStats() {
  const statProdi = document.getElementById('stat-prodi');
  const statLab = document.getElementById('stat-lab');
  const statSatker = document.getElementById('stat-satker');
  
  if (!statProdi || !statLab || !statSatker) return;
  
  try {
    const response = await fetch(APP_CONFIG.API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getPublicStats' }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    
    const data = await response.json();
    
    if (data.success && data.data) {
      statProdi.textContent = data.data.prodi || 0;
      statLab.textContent = data.data.lab || 0;
      statSatker.textContent = data.data.satker || 0;
    }
  } catch (err) {
    console.error('Load public stats error:', err);
    // Fallback angka statis
    statProdi.textContent = '51';
    statLab.textContent = '0';
    statSatker.textContent = '11';
  }
}

// Jalankan saat halaman login dibuka
if (window.location.pathname.endsWith('index.html') || 
    window.location.pathname.endsWith('/')) {
  window.addEventListener('load', loadPublicStats);
}