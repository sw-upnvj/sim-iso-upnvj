// ============================================
// absensi.js - Halaman Presensi & Dokumentasi Auditor
// + cache getAbsensiLinks + hideEmptySections
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
  
  // ===== Menu Rekap (admin & auditor) =====
  showMenuRekap();
  
  // ===== Sembunyikan section kosong =====
  hideEmptySections();
}

// ============================================
// LOAD LINKS dari backend
// ============================================
async function loadLinks(forceRefresh = false) {
  const loading = document.getElementById('loading');
  const cardAbsensi = document.getElementById('card-absensi');
  const cardDokumentasi = document.getElementById('card-dokumentasi');
  const cardEmpty = document.getElementById('card-empty');
  
  // ===== Guard elemen =====
  if (!loading || !cardAbsensi || !cardDokumentasi || !cardEmpty) return;
  
  // ===== Reset display =====
  loading.style.display = 'block';
  cardAbsensi.style.display = 'none';
  cardDokumentasi.style.display = 'none';
  cardEmpty.style.display = 'none';
  
  // ===== Pakai cache (5 menit) kecuali forceRefresh =====
  const result = forceRefresh
    ? await callAPI('getAbsensiLinks')
    : await callAPIWithCache('getAbsensiLinks', {}, 5 * 60 * 1000);
  
  loading.style.display = 'none';
  
  if (!result.success) {
    cardEmpty.style.display = 'block';
    return;
  }
  
  const data = result.data || {};
  const linkAbsensi = data.link_absensi || '';
  const linkDokumentasi = data.link_dokumentasi || '';
  
  // Kalau dua-duanya kosong → tampilkan empty state
  if (!linkAbsensi && !linkDokumentasi) {
    cardEmpty.style.display = 'block';
    return;
  }
  
  // ===== CARD ABSENSI =====
  if (linkAbsensi) {
    const elLink = document.getElementById('link-absensi-url');
    const elBtn = document.getElementById('btn-buka-absensi');
    
    if (elLink) {
      elLink.textContent = linkAbsensi;
      elLink.href = linkAbsensi;
    }
    if (elBtn) elBtn.href = linkAbsensi;
    
    cardAbsensi.style.display = 'block';
  }
  
  // ===== CARD DOKUMENTASI =====
  if (linkDokumentasi) {
    const elLink = document.getElementById('link-dokumentasi-url');
    const elBtn = document.getElementById('btn-buka-dokumentasi');
    
    if (elLink) {
      elLink.textContent = linkDokumentasi;
      elLink.href = linkDokumentasi;
    }
    if (elBtn) elBtn.href = linkDokumentasi;
    
    cardDokumentasi.style.display = 'block';
  }
}

// ============================================
// REFRESH — dipanggil dari tombol Refresh
// ============================================
async function refreshData() {
  clearAPICache();
  await loadLinks(true);
  showToast('✅ Data berhasil di-refresh');
}

function logout() {
  if (!confirm('Yakin ingin logout?')) return;
  clearSession();
  window.location.href = 'index.html';
}