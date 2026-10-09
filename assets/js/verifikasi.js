// ============================================
// verifikasi.js - Logic halaman verifikator
// ============================================

let allDocs = [];
let currentUser = null;
let currentDoc = null;

window.addEventListener('load', async () => {
  const session = requireLogin();
  if (!session) return;
  
  currentUser = session.user;
  
  if (currentUser.role !== 'verifikator' && currentUser.role !== 'administrator') {
    alert('Akses ditolak. Halaman ini hanya untuk verifikator & administrator.');
    window.location.href = 'dashboard.html';
    return;
  }
  
  renderUserInfo();
  await loadDocs();
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
  
  if (currentUser.role === 'administrator') {
    const el = document.getElementById('sidebar-manage-user');
    if (el) el.style.display = 'flex';
    const elAudit = document.getElementById('sidebar-audit');
    if (elAudit) elAudit.style.display = 'flex';
  }
}

async function loadDocs(forceRefresh = false) {
  const container = document.getElementById('table-container');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Memuat data...</div>';
  
  const result = await callAPI('getDocsForVerification');
  
  if (!result.success) {
    container.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(result.message)}</div>`;
    return;
  }
  
  allDocs = result.data || [];
  
  populateSubsatkerFilter();
  updateStats(result.stats);
  renderDocs();
}

function populateSubsatkerFilter() {
  const select = document.getElementById('filter-subsatker');
  const currentValue = select.value;
  
  const unique = [...new Set(allDocs.map(d => d.subsatker))].sort();
  
  select.innerHTML = '<option value="">Semua Subsatker</option>';
  unique.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });
  
  if (currentValue) select.value = currentValue;
}

function updateStats(stats) {
  if (!stats) {
    // Fallback
    document.getElementById('stat-submitted').textContent = allDocs.length;
    document.getElementById('stat-verified').textContent = '—';
    document.getElementById('stat-rejected').textContent = '—';
    document.getElementById('stat-progress').textContent = '0%';
    return;
  }
  
  document.getElementById('stat-submitted').textContent = stats.menunggu || 0;
  document.getElementById('stat-verified').textContent = stats.verified || 0;
  document.getElementById('stat-rejected').textContent = stats.ditolak || 0;
  document.getElementById('stat-progress').textContent = (stats.progress || 0) + '%';
}

function renderDocs() {
  const container = document.getElementById('table-container');
  
  if (allDocs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div>🎉</div>
        <p>Tidak ada dokumen yang menunggu verifikasi</p>
        <p style="font-size:13px;color:#6B7280;margin-top:8px;">Semua dokumen sudah diverifikasi</p>
      </div>
    `;
    return;
  }
  
  const subsatkerFilter = document.getElementById('filter-subsatker').value;
  const searchFilter = document.getElementById('filter-search').value.toLowerCase();
  
  let filtered = allDocs.filter(doc => {
    if (subsatkerFilter && doc.subsatker !== subsatkerFilter) return false;
    if (searchFilter && !doc.nama_dokumen.toLowerCase().includes(searchFilter)) return false;
    return true;
  });
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div>🔍</div>
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
          <th>Subsatker</th>
          <th>Nama Dokumen</th>
          <th style="width:100px;">Status</th>
          <th style="width:150px;">Link</th>
          <th style="width:180px;">Aksi</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  filtered.forEach((doc, index) => {
    const statusBadge = doc.status === 'submitted'
      ? '<span class="badge badge-info">📤 Submitted</span>'
      : '<span class="badge badge-danger">❌ Ditolak</span>';
    
    const revisionInfo = doc.revision_count > 0
      ? `<div style="font-size:10px;color:#D97706;margin-top:2px;">Revisi ke-${doc.revision_count}</div>`
      : '';
    
    html += `
      <tr>
        <td>${index + 1}</td>
        <td><strong style="color:#0F3D2E;">${escapeHtml(doc.subsatker)}</strong></td>
        <td>${escapeHtml(doc.nama_dokumen)}</td>
        <td>${statusBadge}${revisionInfo}</td>
        <td>
          <a href="${escapeHtml(doc.link)}" target="_blank" class="btn btn-secondary btn-sm">🔗 Buka</a>
        </td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="openVerifyModal('${doc.docID}', '${escapeHtml(doc.subsatker)}', '${escapeHtml(doc.email)}')">Verifikasi</button>
        </td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function openVerifyModal(docID, subsatker, email) {
  const doc = allDocs.find(d => 
    d.docID === docID && 
    d.subsatker === subsatker && 
    d.email === email
  );
  
  if (!doc) return;
  
  currentDoc = doc;
  
  document.getElementById('modal-title').textContent = 'Verifikasi: ' + doc.nama_dokumen;
  document.getElementById('modal-subsatker').textContent = doc.subsatker;
  document.getElementById('modal-link').textContent = doc.link;
  document.getElementById('modal-link').href = doc.link;
  document.getElementById('modal-link-btn').href = doc.link;
  document.getElementById('modal-catatan').value = doc.verifikator_catatan || '';
  
  document.getElementById('modal-verify').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-verify').classList.remove('show');
  currentDoc = null;
}

async function submitVerify() {
  if (!currentDoc) return;
  
  const catatan = document.getElementById('modal-catatan').value.trim();
  const btn = document.getElementById('btn-verify');
  
  btn.disabled = true;
  btn.textContent = 'Memproses...';
  
  const result = await callAPI('verifyDoc', {
    docID: currentDoc.docID,
    subsatker: currentDoc.subsatker,
    email_auditee: currentDoc.email,
    catatan: catatan
  });
  
  btn.disabled = false;
  btn.textContent = '✅ Verifikasi';
  
  if (result.success) {
    showToast('✅ ' + result.message);
    closeModal();
    await loadDocs(true);
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

async function submitReject() {
  if (!currentDoc) return;
  
  const catatan = document.getElementById('modal-catatan').value.trim();
  
  if (!catatan) {
    showToast('Catatan wajib diisi untuk penolakan', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-reject');
  btn.disabled = true;
  btn.textContent = 'Memproses...';
  
  const result = await callAPI('rejectDoc', {
    docID: currentDoc.docID,
    subsatker: currentDoc.subsatker,
    email_auditee: currentDoc.email,
    catatan: catatan
  });
  
  btn.disabled = false;
  btn.textContent = '❌ Tolak';
  
  if (result.success) {
    showToast('✅ ' + result.message);
    closeModal();
    await loadDocs(true);
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

function logout() {
  if (!confirm('Yakin ingin logout?')) return;
  clearSession();
  window.location.href = 'index.html';
}