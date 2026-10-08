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