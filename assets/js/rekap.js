// ============================================
// rekap.js - Logic halaman rekap admin
// ============================================

let allRekap = [];
let currentUser = null;

window.addEventListener('load', async () => {
  const session = requireLogin();
  if (!session) return;
  
  currentUser = session.user;
  
  if (currentUser.role !== 'admin' && currentUser.role !== 'auditor') {
    alert('Akses ditolak. Halaman ini hanya untuk admin & auditor.');
    window.location.href = 'dashboard.html';
    return;
  }
  
  renderUserInfo();
  await loadRekap();
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
  
  if (currentUser.role === 'admin') {
    document.getElementById('sidebar-manage-user').style.display = 'flex';
  }
}

async function loadRekap() {
  const container = document.getElementById('table-container');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Memuat data...</div>';
  
  const result = await callAPI('getRekap');
  
  if (!result.success) {
    container.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(result.message)}</div>`;
    return;
  }
  
  allRekap = result.data || [];
  
  document.getElementById('year-badge').textContent = result.tahun || '-';
  
  renderStats();
  renderRekap();
}

function renderStats() {
  const total = allRekap.length;
  const excellent = allRekap.filter(r => r.totalSkor >= 90).length;
  const good = allRekap.filter(r => r.totalSkor >= 70 && r.totalSkor < 90).length;
  const poor = allRekap.filter(r => r.totalSkor < 70).length;
  
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-excellent').textContent = excellent;
  document.getElementById('stat-good').textContent = good;
  document.getElementById('stat-poor').textContent = poor;
}

function renderRekap() {
  const container = document.getElementById('table-container');
  
  if (allRekap.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div>📭</div>
        <p>Tidak ada data rekap</p>
      </div>
    `;
    return;
  }
  
  const searchFilter = document.getElementById('filter-search').value.toLowerCase();
  const skorFilter = document.getElementById('filter-skor').value;
  const sortFilter = document.getElementById('filter-sort').value;
  
  let filtered = allRekap.filter(r => {
    if (searchFilter && !r.subsatker.toLowerCase().includes(searchFilter)) return false;
    if (skorFilter === 'excellent' && r.totalSkor < 90) return false;
    if (skorFilter === 'good' && (r.totalSkor < 70 || r.totalSkor >= 90)) return false;
    if (skorFilter === 'poor' && r.totalSkor >= 70) return false;
    return true;
  });
  
  filtered.sort((a, b) => {
    if (sortFilter === 'skor-desc') return b.totalSkor - a.totalSkor;
    if (sortFilter === 'skor-asc') return a.totalSkor - b.totalSkor;
    if (sortFilter === 'nama') return a.subsatker.localeCompare(b.subsatker);
    if (sortFilter === 'progress') return b.persentase - a.persentase;
    return 0;
  });
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div>🔍</div>
        <p>Tidak ada data yang cocok dengan filter</p>
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
          <th style="width:200px;">Progress</th>
          <th style="width:90px;text-align:center;">Skor A</th>
          <th style="width:90px;text-align:center;">Skor B</th>
          <th style="width:110px;text-align:center;">Total</th>
          <th style="width:130px;">Status</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  filtered.forEach((r, index) => {
    const percent = r.persentase;
    let progressClass = 'poor';
    if (r.totalSkor >= 90) progressClass = 'excellent';
    else if (r.totalSkor >= 70) progressClass = 'good';
    
    let statusChip;
    if (r.totalSkor >= 90) {
      statusChip = '<span class="score-chip excellent">✅ Excellent</span>';
    } else if (r.totalSkor >= 70) {
      statusChip = '<span class="score-chip good">⚠️ Good</span>';
    } else {
      statusChip = '<span class="score-chip poor">❌ Perlu Perbaikan</span>';
    }
    
    html += `
      <tr>
        <td>${index + 1}</td>
        <td><strong style="color:var(--gray-900);">${escapeHtml(r.subsatker)}</strong></td>
        <td>
          <div class="mini-progress">
            <div class="mini-progress-bar">
              <div class="mini-progress-fill ${progressClass}" style="width:${percent}%"></div>
            </div>
            <span style="font-weight:700;color:var(--gray-700);min-width:70px;text-align:right;">${r.tersedia}/${r.total}</span>
          </div>
        </td>
        <td style="text-align:center;"><span class="score-value">${r.skorA.toFixed(1)}</span></td>
        <td style="text-align:center;"><span class="score-value">${r.skorB.toFixed(1)}</span></td>
        <td style="text-align:center;"><span class="score-value ${progressClass}">${r.totalSkor.toFixed(1)}</span></td>
        <td>${statusChip}</td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function exportCSV() {
  if (allRekap.length === 0) {
    showToast('Tidak ada data untuk di-export', 'error');
    return;
  }
  
  const headers = ['No', 'Subsatker', 'Tersedia', 'Total', 'Persentase', 'Skor A', 'Skor B', 'Total Skor'];
  const rows = allRekap.map((r, i) => [
    i + 1,
    r.subsatker,
    r.tersedia,
    r.total,
    r.persentase + '%',
    r.skorA.toFixed(2),
    r.skorB.toFixed(2),
    r.totalSkor.toFixed(2)
  ]);
  
  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
  });
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'rekap_iso_' + new Date().toISOString().slice(0,10) + '.csv';
  link.click();
  
  showToast('✅ CSV berhasil di-download');
}

function logout() {
  if (!confirm('Yakin ingin logout?')) return;
  clearSession();
  window.location.href = 'index.html';
}