// ============================================
// dashboard.js - Logic halaman dashboard
// ============================================

let allDocs = [];
let currentUser = null;
let selectedSubsatker = '';

// Cek login dulu
window.addEventListener('load', async () => {
  const session = requireLogin();
  if (!session) return;
  
  currentUser = session.user;
  renderUserInfo();
  await setupSubsatkerFilter();
  await loadDocs();
});

function renderUserInfo() {
  const el = document.getElementById('user-info');
  el.innerHTML = `
    <span style="opacity:0.9;">${escapeHtml(currentUser.nama)}</span>
    <span style="opacity:0.7;font-size:12px;"> • ${escapeHtml(currentUser.role)}</span>
  `;
  
  // Tampilkan link Kelola User kalau role = admin
  if (currentUser.role === 'admin') {
    const linkManage = document.getElementById('link-manage-user');
    if (linkManage) linkManage.style.display = 'inline';
  }
}

// Setup dropdown subsatker kalau admin/auditor
async function setupSubsatkerFilter() {
  if (currentUser.role !== 'admin' && currentUser.role !== 'auditor') return;
  
  // Tampilkan dropdown
  document.getElementById('subsatker-filter').style.display = 'block';
  
  // Load daftar subsatker
  const result = await callAPI('getSubsatkerList');
  if (!result.success) return;
  
  const select = document.getElementById('filter-subsatker');
  result.data.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });
}

// Event saat subsatker dipilih
async function onSubsatkerChange() {
  selectedSubsatker = document.getElementById('filter-subsatker').value;
  await loadDocs();
}

async function loadDocs() {
  const container = document.getElementById('table-container');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Memuat data...</div>';
  
  // Untuk admin: butuh pilih subsatker dulu
  if ((currentUser.role === 'admin' || currentUser.role === 'auditor') && !selectedSubsatker) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size:48px;">👆</div>
        <p>Silakan pilih <strong>Subsatker</strong> terlebih dahulu di atas</p>
      </div>
    `;
    return;
  }
  
  // Untuk user: langsung load dokumen prodi sendiri
  const payload = {};
  if (selectedSubsatker) payload.subsatker = selectedSubsatker;
  
  const result = await callAPI('getDocs', payload);
  
  if (!result.success) {
    container.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(result.message)}</div>`;
    return;
  }
  
  allDocs = result.data || [];
  
  document.getElementById('year-badge').textContent = 'Tahun ' + (result.tahun || '-');
  
  renderProgress();
  renderDocs();
}

function renderProgress() {
  const total = allDocs.length;
  const tersedia = allDocs.filter(d => d.status === 'submitted').length;
  const percent = total > 0 ? Math.round((tersedia / total) * 100) : 0;
  
  document.getElementById('progress-count').textContent = `${tersedia}/${total}`;
  document.getElementById('progress-percent').textContent = `${percent}%`;
  document.getElementById('progress-fill').style.width = percent + '%';
}

function renderDocs() {
  const container = document.getElementById('table-container');
  
  if (allDocs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size:48px;">📭</div>
        <p>Tidak ada dokumen untuk ditampilkan</p>
      </div>
    `;
    return;
  }
  
  const kategoriFilter = document.getElementById('filter-kategori').value;
  const statusFilter = document.getElementById('filter-status').value;
  const searchFilter = document.getElementById('filter-search').value.toLowerCase();
  
  let filtered = allDocs.filter(doc => {
    if (kategoriFilter && doc.kategori !== kategoriFilter) return false;
    if (statusFilter === 'tersedia' && doc.status !== 'submitted') return false;
    if (statusFilter === 'kosong' && doc.status === 'submitted') return false;
    if (searchFilter && !doc.nama_dokumen.toLowerCase().includes(searchFilter)) return false;
    return true;
  });
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size:48px;">🔍</div>
        <p>Tidak ada dokumen yang cocok dengan filter</p>
      </div>
    `;
    return;
  }
  
  let html = `
    <table>
      <thead>
        <tr>
          <th style="width:50px;">No</th>
          <th>Nama Dokumen</th>
          <th style="width:100px;">Kategori</th>
          <th style="width:120px;">Status</th>
          <th style="width:100px;">Aksi</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  filtered.forEach((doc, index) => {
    const isSubmitted = doc.status === 'submitted';
    const statusBadge = isSubmitted 
      ? '<span class="badge badge-success">✅ Tersedia</span>'
      : '<span class="badge badge-gray">❌ Kosong</span>';
    
    const kategoriBadge = doc.kategori === 'A'
      ? '<span class="badge badge-info">A (70%)</span>'
      : '<span class="badge badge-warning">B (30%)</span>';
    
    const actionBtn = isSubmitted
      ? `<a href="${escapeHtml(doc.link)}" target="_blank" class="btn btn-secondary btn-sm">Lihat</a>`
      : `<button class="btn btn-primary btn-sm" onclick="openInput('${doc.docID}')">Isi</button>`;
    
    html += `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(doc.nama_dokumen)}</td>
        <td>${kategoriBadge}</td>
        <td>${statusBadge}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function openInput(docID) {
  const doc = allDocs.find(d => d.docID === docID);
  if (!doc) return;
  
  const link = prompt(`Masukkan link Google Drive untuk:\n\n${doc.nama_dokumen}\n\nFormat: https://drive.google.com/... atau https://docs.google.com/...`, doc.link || '');
  
  if (link === null) return;
  if (!link.trim()) {
    showToast('Link tidak boleh kosong', 'error');
    return;
  }
  
  saveLink(docID, link.trim());
}

async function saveLink(docID, link) {
  const result = await callAPI('submitLink', { docID, link });
  
  if (result.success) {
    showToast('✅ Link berhasil disimpan!');
    await loadDocs();
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

function logout() {
  if (!confirm('Yakin ingin logout?')) return;
  clearSession();
  window.location.href = 'index.html';
}