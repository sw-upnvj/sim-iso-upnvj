// ============================================
// dashboard.js - Logic halaman dashboard
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
  // User chip
  document.getElementById('user-name').textContent = currentUser.nama;
  document.getElementById('user-role').textContent = currentUser.role;
  
  // Avatar initials
  const initials = currentUser.nama
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  document.getElementById('user-avatar').textContent = initials;
  
  // Welcome name
  const firstName = currentUser.nama.split(' ')[0];
  document.getElementById('welcome-name').textContent = firstName;
  
  // Welcome subtitle
  if (currentUser.role === 'user') {
    document.getElementById('welcome-subtitle').textContent = 
      'Silakan lengkapi dokumen ISO untuk ' + currentUser.subsatker;
  } else {
    document.getElementById('welcome-subtitle').textContent = 
      'Pilih subsatker untuk melihat dan mengelola dokumen';
  }
  
  // Show sidebar link to manage user for admin
  if (currentUser.role === 'admin') {
    document.getElementById('sidebar-manage-user').style.display = 'flex';
  }
}

async function setupSubsatkerFilter() {
  if (currentUser.role !== 'admin' && currentUser.role !== 'auditor') return;
  
  const filterEl = document.getElementById('filter-subsatker');
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
}

async function loadDocs() {
  const container = document.getElementById('table-container');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Memuat data...</div>';
  
  if ((currentUser.role === 'admin' || currentUser.role === 'auditor') && !selectedSubsatker) {
    // Reset stats
    updateStats([]);
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
}

function updateStats(docs) {
  const total = docs.length;
  const tersedia = docs.filter(d => d.status === 'submitted').length;
  const kosong = total - tersedia;
  const percent = total > 0 ? Math.round((tersedia / total) * 100) : 0;
  
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-tersedia').textContent = tersedia;
  document.getElementById('stat-kosong').textContent = kosong;
  document.getElementById('stat-progress').textContent = percent + '%';
  
  document.getElementById('progress-value').textContent = percent + '%';
  document.getElementById('progress-fill').style.width = percent + '%';
}

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
    if (statusFilter === 'tersedia' && doc.status !== 'submitted') return false;
    if (statusFilter === 'kosong' && doc.status === 'submitted') return false;
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
          <th>Nama Dokumen</th>
          <th style="width:110px;">Kategori</th>
          <th style="width:120px;">Status</th>
          <th style="width:140px;">Update Terakhir</th>
          <th style="width:100px;">Aksi</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  filtered.forEach((doc, index) => {
    const isSubmitted = doc.status === 'submitted';
    const hasSubs = doc.hasSubs === true;
    
    // Status badge
    let statusBadge;
    if (hasSubs) {
      // Untuk parent dengan subs, tampilkan progress
      const subsPercent = doc.subsTotal > 0 
        ? Math.round((doc.subsTersedia / doc.subsTotal) * 100) 
        : 0;
      const badgeColor = subsPercent === 100 ? 'success' : subsPercent > 0 ? 'warning' : 'gray';
      statusBadge = `<span class="badge badge-${badgeColor}">📊 ${doc.subsTersedia}/${doc.subsTotal}</span>`;
    } else {
      statusBadge = isSubmitted 
        ? '<span class="badge badge-success">✅ Tersedia</span>'
        : '<span class="badge badge-gray">❌ Kosong</span>';
    }
    
    const kategoriBadge = doc.kategori === 'A'
      ? '<span class="badge badge-info">A (70%)</span>'
      : '<span class="badge badge-warning">B (30%)</span>';
    
    // Action button
    let actionBtn;
    if (hasSubs) {
      actionBtn = `<button class="btn btn-secondary btn-sm" onclick="toggleSubs('${doc.docID}')" id="btn-toggle-${doc.docID}">📂 Detail</button>`;
    } else if (isSubmitted) {
      actionBtn = `<a href="${escapeHtml(doc.link)}" target="_blank" class="btn btn-secondary btn-sm">Lihat</a>`;
    } else {
      actionBtn = `<button class="btn btn-primary btn-sm" onclick="openInput('${doc.docID}')">Isi</button>`;
    }
    
    // Icon type
    const docName = doc.nama_dokumen.toLowerCase();
    let iconClass = 'folder';
    let iconEmoji = '📁';
    if (docName.includes('pdf')) { iconClass = 'pdf'; iconEmoji = '📕'; }
    else if (docName.includes('laporan') || docName.includes('led')) { iconClass = 'doc'; iconEmoji = '📘'; }
    else if (docName.includes('data') || docName.includes('lkps')) { iconClass = 'xls'; iconEmoji = '📗'; }
    
    const tanggal = doc.timestamp ? formatDateShort(doc.timestamp) : '-';
    
    // Parent row
    html += `
      <tr class="doc-parent" data-docid="${doc.docID}">
        <td>${index + 1}</td>
        <td>
          <div class="doc-name-cell">
            <div class="doc-icon ${iconClass}">${iconEmoji}</div>
            <span>${escapeHtml(doc.nama_dokumen)}</span>
          </div>
        </td>
        <td>${kategoriBadge}</td>
        <td>${statusBadge}</td>
        <td style="font-size:12px;color:var(--gray-500);">${tanggal}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
    
    // Sub-items (hidden by default)
    if (hasSubs) {
      doc.subs.forEach((sub, subIndex) => {
        const subIsSubmitted = sub.status === 'submitted';
        const subStatusBadge = subIsSubmitted
          ? '<span class="badge badge-success">✅</span>'
          : '<span class="badge badge-gray">❌</span>';
        const subAction = subIsSubmitted
          ? `<a href="${escapeHtml(sub.link)}" target="_blank" class="btn btn-secondary btn-sm">Lihat</a>`
          : `<button class="btn btn-primary btn-sm" onclick="openInput('${sub.docID}')">Isi</button>`;
        const subTanggal = sub.timestamp ? formatDateShort(sub.timestamp) : '-';
        
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
            <td>${subStatusBadge}</td>
            <td style="font-size:12px;color:var(--gray-500);">${subTanggal}</td>
            <td>${subAction}</td>
          </tr>
        `;
      });
    }
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

// Toggle sub-items
function toggleSubs(docID) {
  const parentRow = document.querySelector(`.doc-parent[data-docid="${docID}"]`);
  const childRows = document.querySelectorAll(`.doc-child[data-parent="${docID}"]`);
  const btn = document.getElementById(`btn-toggle-${docID}`);
  
  if (!childRows.length) return;
  
  const isHidden = childRows[0].style.display === 'none';
  
  childRows.forEach(row => {
    row.style.display = isHidden ? 'table-row' : 'none';
  });
  
  // Update button text
  btn.innerHTML = isHidden ? '📁 Tutup' : '📂 Detail';
  
  // Toggle parent row background
  if (isHidden) {
    parentRow.style.background = '#F0FDF4';
  } else {
    parentRow.style.background = '';
  }
}

function formatDateShort(dateVal) {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
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