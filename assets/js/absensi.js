// ============================================
// absensi.js - Halaman Absensi & Dokumentasi Auditor
// ============================================

let currentUser = null;

window.addEventListener('load', async () => {
  const session = requireLogin();
  if (!session) return;
  
  currentUser = session.user;
  
  // Cek role — hanya auditor & administrator
  if (currentUser.role !== 'auditor' && currentUser.role !== 'administrator') {
    alert('Akses ditolak. Halaman ini hanya untuk auditor & administrator.');
    window.location.href = 'dashboard.html';
    return;
  }
  
  renderUserInfo();
  await loadLinks();
});

function renderUserInfo() {
  document.getElementById('user-name').textContent = currentUser.nama;
  document.getElementById('user-role').textContent = currentUser.role;
  
  const initials = currentUser.nama
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  document.getElementById('user-avatar').textContent = initials;
  
  // Tampilkan menu sesuai role
  if (currentUser.role === 'auditor' || currentUser.role === 'administrator') {
    const elAbsensi = document.getElementById('sidebar-absensi');
    if (elAbsensi) elAbsensi.style.display = 'flex';
    
    const elAudit = document.getElementById('sidebar-audit');
    if (elAudit) elAudit.style.display = 'flex';
  }
  
  if (currentUser.role === 'administrator') {
    const elManage = document.getElementById('sidebar-manage-user');
    if (elManage) elManage.style.display = 'flex';
    
    const elVerif = document.getElementById('sidebar-verifikasi');
    if (elVerif) elVerif.style.display = 'flex';
    
    const elRtl = document.getElementById('sidebar-manage-rtl');
    if (elRtl) elRtl.style.display = 'flex';
  }
}

// ============================================
// LOAD LINKS dari backend
// ============================================
async function loadLinks(forceRefresh = false) {
  const loading = document.getElementById('loading');
  const cardAbsensi = document.getElementById('card-absensi');
  const cardDokumentasi = document.getElementById('card-dokumentasi');
  const cardEmpty = document.getElementById('card-empty');
  
  // Reset display
  loading.style.display = 'block';
  cardAbsensi.style.display = 'none';
  cardDokumentasi.style.display = 'none';
  cardEmpty.style.display = 'none';
  
  const result = await callAPI('getAbsensiLinks');
  
  loading.style.display = 'none';
  
  if (!result.success) {
    cardEmpty.style.display = 'block';
    return;
  }
  
  const data = result.data;
  const linkAbsensi = data.link_absensi || '';
  const linkDokumentasi = data.link_dokumentasi || '';
  
  // Kalau dua-duanya kosong → tampilkan empty state
  if (!linkAbsensi && !linkDokumentasi) {
    cardEmpty.style.display = 'block';
    return;
  }
  
  // ===== CARD ABSENSI =====
  if (linkAbsensi) {
    document.getElementById('link-absensi-url').textContent = linkAbsensi;
    document.getElementById('link-absensi-url').href = linkAbsensi;
    document.getElementById('btn-buka-absensi').href = linkAbsensi;
    cardAbsensi.style.display = 'block';
  }
  
  // ===== CARD DOKUMENTASI =====
  if (linkDokumentasi) {
    document.getElementById('link-dokumentasi-url').textContent = linkDokumentasi;
    document.getElementById('link-dokumentasi-url').href = linkDokumentasi;
    document.getElementById('btn-buka-dokumentasi').href = linkDokumentasi;
    cardDokumentasi.style.display = 'block';
  }
}

function logout() {
  if (!confirm('Yakin ingin logout?')) return;
  clearSession();
  window.location.href = 'index.html';
}