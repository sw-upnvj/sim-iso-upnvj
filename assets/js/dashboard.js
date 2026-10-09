// ============================================
// dashboard.js - Logic halaman dashboard auditee
// ============================================

let allDocs = [];
let currentUser = null;
let selectedSubsatker = '';

window.addEventListener('load', async () => {
  const session = requireLogin();
  if (!session) return;
  
  currentUser = session.user;
  renderUserInfo();
  await setupSubsatkerFilter();
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
  
  const firstName = currentUser.nama.split(' ')[0];
  document.getElementById('welcome-name').textContent = firstName;
  
  if (currentUser.role === 'auditee') {
    document.getElementById('welcome-subtitle').textContent = 
      'Silakan lengkapi dokumen ISO untuk ' + currentUser.subsatker;
  } else {
    document.getElementById('welcome-subtitle').textContent = 
      'Pilih subsatker untuk melihat dan mengelola dokumen';
  }
  
  // ===== Role-Based Menu =====
  if (currentUser.role === 'verifikator' || currentUser.role === 'administrator') {
    const el = document.getElementById('sidebar-verifikasi');
    if (el) el.style.display = 'flex';
  }
  
  if (currentUser.role === 'auditor' || currentUser.role === 'administrator') {
    const el = document.getElementById('sidebar-audit');
    if (el) el.style.display = 'flex';
  }
  
  if (currentUser.role === 'administrator') {
    const el = document.getElementById('sidebar-manage-user');
    if (el) el.style.display = 'flex';
  }
}

async function setupSubsatkerFilter() {
  if (currentUser.role !== 'administrator' && currentUser.role !== 'verifikator' && currentUser.role !== 'auditor') return;
  
  const filterEl = document.getElementById('filter-subsatker');
  if (!filterEl) return;
  filterEl.style.display = 'block';
  
  const result = await callAPI('getSubsatkerList');
  if (!result.success) return;
  
  result.data.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    filterEl.appendChild(opt);
  });
}

async function onSubsatkerChange() {
  selectedSubsatker = document.getElementById('filter-subsatker').value;
  await loadDocs();
  if (selectedSubsatker) {
    await loadAuditSummary(selectedSubsatker);
  }
}

async function loadDocs() {
  const container = document.getElementById('table-container');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Memuat data...</div>';
  
  if ((currentUser.role === 'administrator' || currentUser.role === 'verifikator' || currentUser.role === 'auditor') && !selectedSubsatker) {
    updateStats([]);
    document.getElementById('audit-summary-card').style.display = 'none';
    container.innerHTML = `
      <div class="empty-state">
        <div>👆</div>
        <p>Silakan pilih <strong>Subsatker</strong> terlebih dahulu di atas</p>
      </div>
    `;
    return;
  }
  
  const payload = {};
  if (selectedSubsatker) payload.subsatker = selectedSubsatker;
  
  const result = await callAPI('getDocs', payload);
  
  if (!result.success) {
    container.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(result.message)}</div>`;
    return;
  }
  
  allDocs = result.data || [];
  updateStats(allDocs);
  renderDocs();
  
  const subsatkerTarget = selectedSubsatker || (currentUser.role === 'auditee' ? currentUser.subsatker : null);
  if (subsatkerTarget) {
    await loadAuditSummary(subsatkerTarget);
  }
}

async function loadAuditSummary(subsatker) {
  const card = document.getElementById('audit-summary-card');
  if (!card) return;
  
  const result = await callAPI('getAuditSummary', { subsatker });
  
  if (!result.success || !result.data) {
    card.style.display = 'none';
    return;
  }
  
  const data = result.data;
  const hasContent = (data.temuan_audit || data.rekomendasi_perbaikan || data.rekomendasi_peningkatan);
  
  if (!hasContent) {
    card.style.display = 'none';
    return;
  }
  
  document.getElementById('summary-temuan').textContent = data.temuan_audit || '-';
  document.getElementById('summary-perbaikan').textContent = data.rekomendasi_perbaikan || '-';
  document.getElementById('summary-peningkatan').textContent = data.rekomendasi_peningkatan || '-';
  card.style.display = 'block';
}

function updateStats(docs) {
  const total = docs.length;
  const tersedia = docs.filter(d => d.status !== 'kosong' && d.status !== 'draft').length;
  const kosong = total - tersedia;
  const percent = total > 0 ? Math.round((tersedia / total) * 100) : 0;
  
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-tersedia').textContent = tersedia;
  document.getElementById('stat-kosong').textContent = kosong;
  document.getElementById('stat-progress').textContent = percent + '%';
  
  document.getElementById('progress-value').textContent = percent + '%';
  document.getElementById('progress-fill').style.width = percent + '%';
}

// ============================================
// STATUS BADGE
// ============================================
function getStatusBadge(status) {
  const badges = {
    'kosong':        '<span class="badge badge-gray">❌ Kosong</span>',
    'draft':         '<span class="badge badge-gray">📝 Draft</span>',
    'submitted':     '<span class="badge badge-info">📤 Submitted</span>',
    'verified':      '<span class="badge badge-success">✅ Terverifikasi</span>',
    'rejected':      '<span class="badge badge-danger">❌ Ditolak<br><small>Perlu perbaikan</small></span>',
    'audited_pass':  '<span class="badge badge-success">✅ Terverifikasi</span>',
    'audited_fail':  '<span class="badge badge-warning">⚠️ Perlu Perbaikan<br><small>Lihat catatan</small></span>'
  };
  return badges[status] || badges['kosong'];
}

// ============================================
// RENDER DOCS
// ============================================
function renderDocs() {
  const container = document.getElementById('table-container');
  
  if (allDocs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div>📭</div>
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
    if (statusFilter === 'tersedia' && (doc.status === 'kosong' || doc.status === 'draft')) return false;
    if (statusFilter === 'kosong' && doc.status !== 'kosong' && doc.status !== 'draft') return false;
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
  
  // Cek apakah prodi ini punya RTL (ada dokumen kategori B)
  const hasRTL = allDocs.some(d => d.kategori === 'B');
  
  let html = `
    <table>
      <thead>
        <tr>
          <th style="width:50px;">No</th>
          <th>Nama Dokumen</th>
          <th style="width:110px;">Kategori</th>
          <th style="width:180px;">Status</th>
          <th style="width:150px;">Aksi</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  filtered.forEach((doc, index) => {
    const statusBadge = getStatusBadge(doc.status);
    const hasSubs = doc.hasSubs === true;
    const isAuditee = currentUser.role === 'auditee';
    
    // ===== Kategori Badge =====
    let kategoriBadge;
    if (hasRTL) {
      kategoriBadge = doc.kategori === 'A'
        ? '<span class="badge badge-info">A (70%)</span>'
        : '<span class="badge badge-warning">B (30%)</span>';
    } else {
      kategoriBadge = '<span class="badge" style="background:#D1FAE5;color:#065F46;">100%</span>';
    }
    
    // ===== Actions untuk Parent =====
    const actions = [];
    
    if (hasSubs) {
      actions.push(`<button class="btn btn-secondary btn-sm" onclick="toggleSubs('${doc.docID}')" id="btn-toggle-${doc.docID}">📂 Detail</button>`);
    } else {
      if (isAuditee && (doc.status === 'kosong' || doc.status === 'draft')) {
        actions.push(`<button class="btn btn-primary btn-sm" onclick="openInput('${doc.docID}')">Isi</button>`);
      }
      
      if (doc.link) {
        actions.push(`<a href="${escapeHtml(doc.link)}" target="_blank" class="btn btn-secondary btn-sm">Lihat</a>`);
      }
      
      if (doc.status !== 'kosong' && doc.status !== 'draft' && (doc.verifikator_catatan || doc.auditor_catatan)) {
        actions.push(`<button class="btn btn-sm" style="background:#6B7280;color:white;" onclick="showDetail('${doc.docID}')">📝 Catatan</button>`);
      }
    }
    
    html += `
      <tr class="doc-parent" data-docid="${doc.docID}">
        <td>${index + 1}</td>
        <td>
          <div class="doc-name-cell">
            <div class="doc-icon folder">📁</div>
            <span>${escapeHtml(doc.nama_dokumen)}</span>
          </div>
        </td>
        <td>${kategoriBadge}</td>
        <td>${statusBadge}</td>
        <td style="white-space:nowrap;">
          ${actions.join(' ')}
        </td>
      </tr>
    `;
    
    // ===== Sub-items =====
    if (hasSubs) {
      doc.subs.forEach((sub) => {
        const subStatus = getStatusBadge(sub.status);
        const subActions = [];
        
        if (isAuditee && (sub.status === 'kosong' || sub.status === 'draft')) {
          subActions.push(`<button class="btn btn-primary btn-sm" onclick="openInput('${sub.docID}')">Isi</button>`);
        }
        
        if (sub.link) {
          subActions.push(`<a href="${escapeHtml(sub.link)}" target="_blank" class="btn btn-secondary btn-sm">Lihat</a>`);
        }
        
        if (sub.status !== 'kosong' && sub.status !== 'draft' && (sub.verifikator_catatan || sub.auditor_catatan)) {
          subActions.push(`<button class="btn btn-sm" style="background:#6B7280;color:white;" onclick="showDetail('${sub.docID}')">📝</button>`);
        }
        
        html += `
          <tr class="doc-child" data-parent="${doc.docID}" style="display:none;">
            <td></td>
            <td>
              <div style="padding-left:32px;display:flex;align-items:center;gap:8px;">
                <span style="color:var(--gray-400);">↳</span>
                <span style="color:var(--gray-700);font-size:13px;">${escapeHtml(sub.nama_dokumen)}</span>
              </div>
            </td>
            <td></td>
            <td>${subStatus}</td>
            <td style="white-space:nowrap;">${subActions.join(' ')}</td>
          </tr>
        `;
      });
    }
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function toggleSubs(docID) {
  const parentRow = document.querySelector(`.doc-parent[data-docid="${docID}"]`);
  const childRows = document.querySelectorAll(`.doc-child[data-parent="${docID}"]`);
  const btn = document.getElementById(`btn-toggle-${docID}`);
  
  if (!childRows.length) return;
  
  const isHidden = childRows[0].style.display === 'none';
  
  childRows.forEach(row => {
    row.style.display = isHidden ? 'table-row' : 'none';
  });
  
  btn.innerHTML = isHidden ? '📁 Tutup' : '📂 Detail';
  
  if (isHidden) {
    parentRow.style.background = '#F0FDF4';
  } else {
    parentRow.style.background = '';
  }
}

// ============================================
// SHOW DETAIL (Modal Catatan)
// ============================================
function showDetail(docID) {
  let doc = allDocs.find(d => d.docID === docID);
  
  if (!doc) {
    for (const parent of allDocs) {
      if (parent.subs) {
        const sub = parent.subs.find(s => s.docID === docID);
        if (sub) { doc = sub; break; }
      }
    }
  }
  
  if (!doc) return;
  
  document.getElementById('modal-detail-title').textContent = doc.nama_dokumen;
  
  let html = '';
  
  html += `
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;color:#6B7280;margin-bottom:4px;">Status Saat Ini</div>
      <div>${getStatusBadge(doc.status)}</div>
    </div>
  `;
  
  if (doc.link) {
    html += `
      <div style="margin-bottom:20px;">
        <div style="font-size:12px;color:#6B7280;margin-bottom:4px;">Link Dokumen</div>
        <a href="${escapeHtml(doc.link)}" target="_blank" style="color:#1E40AF;word-break:break-all;">${escapeHtml(doc.link)}</a>
      </div>
    `;
  }
  
  if (doc.verifikator_catatan) {
    html += `
      <div style="margin-bottom:20px;padding:14px;background:#DBEAFE;border-left:4px solid #2563EB;border-radius:8px;">
        <div style="font-weight:700;color:#1E40AF;font-size:12px;margin-bottom:6px;">✅ CATATAN VERIFIKATOR</div>
        <div style="color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(doc.verifikator_catatan)}</div>
      </div>
    `;
  }
  
  if (doc.auditor_catatan) {
    const isPass = doc.status === 'audited_pass';
    const bgColor = isPass ? '#D1FAE5' : '#FEF3C7';
    const borderColor = isPass ? '#059669' : '#D97706';
    const textColor = isPass ? '#065F46' : '#92400E';
    const label = isPass ? '🎉 CATATAN AUDITOR (LOLOS)' : '⚠️ CATATAN AUDITOR';
    
    html += `
      <div style="margin-bottom:20px;padding:14px;background:${bgColor};border-left:4px solid ${borderColor};border-radius:8px;">
        <div style="font-weight:700;color:${textColor};font-size:12px;margin-bottom:6px;">${label}</div>
        <div style="color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(doc.auditor_catatan)}</div>
      </div>
    `;
  }
  
  if (doc.revision_count > 0) {
    html += `
      <div style="font-size:12px;color:#6B7280;margin-top:12px;">
        📋 Sudah revisi ke-${doc.revision_count}
      </div>
    `;
  }
  
  document.getElementById('modal-detail-content').innerHTML = html;
  document.getElementById('modal-detail').classList.add('show');
}

function closeDetailModal() {
  document.getElementById('modal-detail').classList.remove('show');
}

// ============================================
// OPEN INPUT (Isi Link)
// ============================================
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