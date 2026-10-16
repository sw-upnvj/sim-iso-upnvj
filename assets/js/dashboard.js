// ============================================
// dashboard.js - Logic halaman dashboard
// + TERSEDIA = globalTersedia (submitted + rejected, parent + sub)
// ============================================

let allDocs = [];
let currentUser = null;
let selectedSubsatker = '';
let cachedRekap = null;

window.addEventListener('load', async () => {
  const session = requireLogin();
  if (!session) return;
  
  if (!session.user || !session.user.nama) {
    console.warn('Session user kosong, redirect ke login');
    clearSession();
    window.location.href = 'index.html';
    return;
  }
  
  currentUser = session.user;
  renderUserInfo();
  
  // ===== Ambil getRekap 1x (kalau admin/verif/auditor) =====
  if (currentUser.role !== 'auditee') {
    cachedRekap = await callAPI('getRekap');
  }
  
  // ===== Load paralel =====
  const tasks = [
    setupSubsatkerFilter(),
    loadDocs()
  ];
  
  if (currentUser.role !== 'auditee') {
    tasks.push(loadCharts());
  } else {
    const chartSection = document.getElementById('chart-section');
    if (chartSection) chartSection.style.display = 'none';
  }
  
  await Promise.all(tasks);
  
  if (currentUser.role === 'auditee') {
    await Promise.all([
      loadRtlInfo(),
      loadAuditResult()
    ]);
  }
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
  
  if (currentUser.role === 'verifikator' || currentUser.role === 'administrator') {
    const el = document.getElementById('sidebar-verifikasi');
    if (el) el.style.display = 'flex';
  }
  
  if (currentUser.role === 'auditor' || currentUser.role === 'administrator') {
    const el = document.getElementById('sidebar-audit');
    if (el) el.style.display = 'flex';
    const elAbsensi = document.getElementById('sidebar-absensi');
    if (elAbsensi) elAbsensi.style.display = 'flex';
  }
  
  if (currentUser.role === 'administrator') {
    const el = document.getElementById('sidebar-manage-user');
    if (el) el.style.display = 'flex';
    const elRtl = document.getElementById('sidebar-manage-rtl');
    if (elRtl) elRtl.style.display = 'flex';
  }
  
  if (currentUser.role === 'administrator' || currentUser.role === 'auditor') {
    const elRekap = document.getElementById('sidebar-rekap');
    if (elRekap) elRekap.style.display = 'flex';
  }
  
  if (currentUser.role === 'auditee') {
    const kategoriSection = document.getElementById('stat-category-section');
    if (kategoriSection) kategoriSection.style.display = 'none';
  }
  
  renderBannerPintasan();
  hideEmptySections();
}

// ============================================
// BANNER PINTASAN (Verifikator / Auditor)
// ============================================
function renderBannerPintasan() {
  const role = currentUser.role;
  
  const oldBanner = document.getElementById('banner-pintasan');
  if (oldBanner) oldBanner.remove();
  
  if (role !== 'verifikator' && role !== 'auditor') return;
  
  const welcomeCard = document.querySelector('.welcome-card');
  if (!welcomeCard) return;
  
  let bannerHtml = '';
  
  if (role === 'verifikator') {
    bannerHtml = `
      <div id="banner-pintasan" class="card" style="background:linear-gradient(135deg,#0F3D2E 0%,#2A9D8F 100%);color:white;border-left:4px solid #A7D129;margin-bottom:20px;padding:24px 28px;position:relative;overflow:hidden;">
        <div style="position:relative;z-index:1;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
            <div style="flex:1;min-width:250px;">
              <h2 style="font-size:20px;font-weight:800;margin-bottom:8px;color:white;letter-spacing:-0.3px;">
                🎯 Selamat datang, Verifikator!
              </h2>
              <p style="font-size:14px;color:rgba(255,255,255,0.85);line-height:1.6;margin-bottom:12px;">
                Tugas Anda adalah <strong>memverifikasi link dokumen</strong> yang di-submit auditee. Pastikan link bisa dibuka dan tidak ada revisi.
              </p>
              <div id="banner-pintasan-stat" style="font-size:13px;color:rgba(255,255,255,0.95);padding:10px 14px;background:rgba(255,255,255,0.1);border-radius:8px;display:inline-block;">
                ⏳ Memuat statistik...
              </div>
            </div>
            <div style="display:flex;align-items:center;">
              <a href="verifikasi.html" class="btn" style="background:#A7D129;color:#0F3D2E;font-weight:700;padding:14px 24px;font-size:14px;box-shadow:0 8px 20px rgba(0,0,0,0.2);">
                ✅ Ke Halaman Verifikasi →
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (role === 'auditor') {
    bannerHtml = `
      <div id="banner-pintasan" class="card" style="background:linear-gradient(135deg,#0F3D2E 0%,#2A9D8F 100%);color:white;border-left:4px solid #A7D129;margin-bottom:20px;padding:24px 28px;position:relative;overflow:hidden;">
        <div style="position:relative;z-index:1;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
            <div style="flex:1;min-width:250px;">
              <h2 style="font-size:20px;font-weight:800;margin-bottom:8px;color:white;letter-spacing:-0.3px;">
                🎯 Selamat datang, Auditor!
              </h2>
              <p style="font-size:14px;color:rgba(255,255,255,0.85);line-height:1.6;margin-bottom:12px;">
                Tugas Anda adalah <strong>mengaudit dokumen ISO</strong> dan <strong>menilai RTL</strong> satker yang di-assign.
              </p>
            </div>
            <div style="display:flex;align-items:center;">
              <a href="audit.html" class="btn" style="background:#A7D129;color:#0F3D2E;font-weight:700;padding:14px 24px;font-size:14px;box-shadow:0 8px 20px rgba(0,0,0,0.2);">
                🔍 Ke Halaman Audit →
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  welcomeCard.insertAdjacentHTML('afterend', bannerHtml);
  
  if (role === 'verifikator') {
    loadBannerStatistik();
  }
}

async function loadBannerStatistik() {
  const statEl = document.getElementById('banner-pintasan-stat');
  if (!statEl) return;
  
  try {
    const result = await callAPI('getDocsForVerification');
    if (result.success && result.stats) {
      const menunggu = result.stats.menunggu || 0;
      const revisi = result.stats.revisi || 0;
      
      if (menunggu === 0 && revisi === 0) {
        statEl.innerHTML = '🎉 Tidak ada dokumen menunggu verifikasi';
      } else {
        let html = '';
        if (menunggu > 0) {
          html += `📤 <strong>${menunggu}</strong> dokumen menunggu verifikasi`;
        }
        if (revisi > 0) {
          html += (html ? ' · ' : '') + `🔄 <strong>${revisi}</strong> dokumen revisi baru`;
        }
        statEl.innerHTML = html;
      }
    }
  } catch (e) {
    statEl.innerHTML = '';
  }
}

async function setupSubsatkerFilter() {
  if (currentUser.role !== 'administrator' && currentUser.role !== 'verifikator' && currentUser.role !== 'auditor') return;
  
  const filterEl = document.getElementById('filter-subsatker');
  if (!filterEl) return;
  filterEl.style.display = 'block';
  
  const result = await callAPIWithCache('getSubsatkerList', {}, 5 * 60 * 1000);
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
  
  const isAdminOrStaff = currentUser.role === 'administrator' || 
                          currentUser.role === 'verifikator' || 
                          currentUser.role === 'auditor';
  
  if (isAdminOrStaff && !selectedSubsatker) {
    const aggregateResult = cachedRekap || await callAPI('getRekap');
    
    if (aggregateResult.success && aggregateResult.data) {
      let totalDocs = 0;
      let totalVerified = 0;
      
      aggregateResult.data.forEach(item => {
        totalDocs += item.total || 0;
        totalVerified += item.verified || 0;
      });
      
      // ============================================
      // TERSEDIA = globalTersedia dari backend
      // (submitted + rejected, parent + sub-item)
      // SAMA dengan Verifikasi MENUNGGU
      // ============================================
      let totalTersedia = 0;
      if (aggregateResult.globalTersedia !== undefined) {
        totalTersedia = aggregateResult.globalTersedia;
      } else {
        // Fallback: pakai item.tersedia (parent only)
        aggregateResult.data.forEach(item => {
          totalTersedia += item.tersedia || 0;
        });
      }
      
      const totalKosong = Math.max(0, totalDocs - totalTersedia);
      const totalPercent = totalDocs > 0 ? Math.round((totalVerified / totalDocs) * 100) : 0;
      
      document.getElementById('stat-total').textContent = totalDocs;
      document.getElementById('stat-tersedia').textContent = totalTersedia;
      document.getElementById('stat-verified').textContent = totalVerified;
      document.getElementById('stat-kosong').textContent = totalKosong;
      document.getElementById('stat-progress').textContent = totalPercent + '%';
      
      document.getElementById('progress-value').textContent = totalPercent + '%';
      document.getElementById('progress-fill').style.width = totalPercent + '%';
      
      const kategoriProdi = aggregateResult.data.filter(r => 
        /^(D3|S1|S2|S3|Profesi|Spesialis)\s/i.test(r.subsatker)
      );
      const kategoriSatker = aggregateResult.data.filter(r => {
        const isProdi = /^(D3|S1|S2|S3|Profesi|Spesialis)\s/i.test(r.subsatker);
        const isLab = /Laboratorium/i.test(r.subsatker);
        return !isProdi && !isLab;
      });
      const kategoriLab = aggregateResult.data.filter(r => 
        /Laboratorium/i.test(r.subsatker)
      );
      
      updateKategoriCard('prodi', kategoriProdi);
      updateKategoriCard('satker', kategoriSatker);
      updateKategoriCard('lab', kategoriLab);
      
    } else {
      updateStats([]);
    }
    
    document.getElementById('audit-summary-card').style.display = 'none';
    container.innerHTML = `
      <div class="empty-state">
        <div>👆</div>
        <p>Silakan pilih <strong>Subsatker</strong> terlebih dahulu di atas</p>
        <p style="font-size:13px;color:#6B7280;margin-top:8px;">Angka di atas menunjukkan total seluruh subsatker</p>
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

// ============================================
// UPDATE STATS — per subsatker (auditee)
// ============================================
function updateStats(docs) {
  const total = docs.length;
  
  let tersedia = 0;
  let verified = 0;
  
  docs.forEach(doc => {
    const status = getParentStatus(doc);
    
    if (status !== 'kosong' && status !== 'draft') {
      tersedia++;
    }
    
    if (status === 'verified' || status === 'audited_pass') {
      verified++;
    }
  });
  
  const kosong = total - tersedia;
  const percent = total > 0 ? Math.round((verified / total) * 100) : 0;
  
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-tersedia').textContent = tersedia;
  document.getElementById('stat-verified').textContent = verified;
  document.getElementById('stat-kosong').textContent = kosong;
  document.getElementById('stat-progress').textContent = percent + '%';
  
  document.getElementById('progress-value').textContent = percent + '%';
  document.getElementById('progress-fill').style.width = percent + '%';
}

// ============================================
// UPDATE CARD KATEGORI
// ============================================
function updateKategoriCard(kategori, items) {
  const totalSatker = items.length;
  let totalDocs = 0;
  let totalVerified = 0;
  let totalTersedia = 0;
  
  items.forEach(item => {
    totalDocs += item.total || 0;
    totalVerified += item.verified || 0;
    totalTersedia += item.tersedia || 0;
  });
  
  const tersediaPercent = totalDocs > 0 
    ? Math.round((totalTersedia / totalDocs) * 100) 
    : 0;
  
  const verifiedPercent = totalDocs > 0 
    ? Math.round((totalVerified / totalDocs) * 100) 
    : 0;
  
  const elTotal = document.getElementById('stat-' + kategori + '-total');
  const elTersedia = document.getElementById('stat-' + kategori + '-tersedia');
  const elVerified = document.getElementById('stat-' + kategori + '-verified');
  const elProgress = document.getElementById('stat-' + kategori + '-progress');
  
  if (elTotal) elTotal.textContent = totalSatker;
  if (elTersedia) elTersedia.textContent = tersediaPercent + '%';
  if (elVerified) elVerified.textContent = verifiedPercent + '%';
  if (elProgress) elProgress.style.width = verifiedPercent + '%';
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
// HITUNG STATUS PARENT DARI ANAK
// ============================================
function getParentStatus(doc) {
  if (!doc.hasSubs || !doc.subs || doc.subs.length === 0) {
    return doc.status;
  }
  
  const subStatuses = doc.subs.map(s => s.status || 'kosong');
  
  const allEmpty = subStatuses.every(s => s === 'kosong' || s === 'draft');
  if (allEmpty) return 'kosong';
  
  const hasFail = subStatuses.some(s => s === 'rejected' || s === 'audited_fail');
  if (hasFail) return 'audited_fail';
  
  const allVerified = subStatuses.every(s => 
    s === 'verified' || s === 'audited_pass'
  );
  if (allVerified) return 'verified';
  
  const hasSubmitted = subStatuses.some(s => s === 'submitted');
  if (hasSubmitted) return 'submitted';
  
  const hasVerified = subStatuses.some(s => 
    s === 'verified' || s === 'audited_pass'
  );
  if (hasVerified) return 'verified';
  
  return 'kosong';
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
  
  const hasRTL = allDocs.some(d => d.kategori === 'B');
  
  let html = `
    <table>
      <thead>
        <tr>
          <th style="width:50px;">No</th>
          <th>Nama Dokumen</th>
          <th style="width:110px;">Kategori</th>
          <th style="width:180px;">Status</th>
          <th style="width:220px;">Aksi</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  filtered.forEach((doc, index) => {
    const hasSubs = doc.hasSubs === true;
    const isAuditee = currentUser.role === 'auditee';
    const isRTL = doc.kategori === 'B';
    
    const parentStatus = getParentStatus(doc);
    const statusBadge = getStatusBadge(parentStatus);
    
    let kategoriBadge;
    if (hasRTL) {
      kategoriBadge = doc.kategori === 'A'
        ? '<span class="badge badge-info">A (70%)</span>'
        : '<span class="badge badge-warning">B (30%)</span>';
    } else {
      kategoriBadge = '<span class="badge" style="background:#D1FAE5;color:#065F46;">100%</span>';
    }
    
    const actions = [];
    
    if (hasSubs) {
      actions.push(`<button class="btn btn-secondary btn-sm" onclick="toggleSubs('${doc.docID}')" id="btn-toggle-${doc.docID}">📂 Detail</button>`);
    } else if (isRTL) {
      if (doc.link) {
        actions.push(`<a href="${escapeHtml(doc.link)}" target="_blank" class="btn btn-primary btn-sm">🔗 Lihat</a>`);
      } else {
        actions.push(`<button class="btn btn-secondary btn-sm" onclick="alert('Link RTL belum diatur oleh administrator.\\n\\nSilakan hubungi admin ISO.')">🔗 Lihat RTL</button>`);
      }
      
      if (doc.status !== 'kosong' && doc.status !== 'draft' && (doc.verifikator_catatan || doc.auditor_catatan)) {
        actions.push(`<button class="btn btn-sm" style="background:#6B7280;color:white;" onclick="showDetail('${doc.docID}')">📝 Catatan</button>`);
      }
    } else {
      const canEdit = isAuditee && ['kosong', 'draft', 'submitted', 'rejected', 'audited_fail'].indexOf(doc.status) !== -1;
      const canFillNew = isAuditee && (doc.status === 'kosong' || doc.status === 'draft');
      
      if (canFillNew) {
        actions.push(`<button class="btn btn-primary btn-sm" onclick="openInput('${doc.docID}')">Isi</button>`);
      }
      
      if (doc.link) {
        actions.push(`<a href="${escapeHtml(doc.link)}" target="_blank" class="btn btn-secondary btn-sm">🔗 Lihat</a>`);
      }
      
      if (canEdit && doc.link && doc.status !== 'kosong' && doc.status !== 'draft') {
        const isRevisi = doc.status === 'rejected' || doc.status === 'audited_fail';
        if (isRevisi) {
          actions.push(`<button class="btn btn-sm" style="background:#059669;color:white;" onclick="submitRevisi('${doc.docID}')">🔄 Submit Revisi</button>`);
          actions.push(`<button class="btn btn-sm" style="background:#D97706;color:white;" onclick="openInput('${doc.docID}')">✏️ Edit Link</button>`);
        } else {
          actions.push(`<button class="btn btn-sm" style="background:#D97706;color:white;" onclick="openInput('${doc.docID}')">✏️ Edit</button>`);
        }
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
    
    if (hasSubs) {
      doc.subs.forEach((sub) => {
        const subStatus = getStatusBadge(sub.status);
        const subActions = [];
        
        const subCanEdit = isAuditee && ['kosong', 'draft', 'submitted', 'rejected', 'audited_fail'].indexOf(sub.status) !== -1;
        const subCanFillNew = isAuditee && (sub.status === 'kosong' || sub.status === 'draft');
        
        if (subCanFillNew) {
          subActions.push(`<button class="btn btn-primary btn-sm" onclick="openInput('${sub.docID}')">Isi</button>`);
        }
        
        if (sub.link) {
          subActions.push(`<a href="${escapeHtml(sub.link)}" target="_blank" class="btn btn-secondary btn-sm">🔗 Lihat</a>`);
        }
        
        if (subCanEdit && sub.link && sub.status !== 'kosong' && sub.status !== 'draft') {
          const subIsRevisi = sub.status === 'rejected' || sub.status === 'audited_fail';
          if (subIsRevisi) {
            subActions.push(`<button class="btn btn-sm" style="background:#059669;color:white;" onclick="submitRevisi('${sub.docID}')">🔄</button>`);
            subActions.push(`<button class="btn btn-sm" style="background:#D97706;color:white;" onclick="openInput('${sub.docID}')">✏️</button>`);
          } else {
            subActions.push(`<button class="btn btn-sm" style="background:#D97706;color:white;" onclick="openInput('${sub.docID}')">✏️</button>`);
          }
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
// OPEN INPUT (Isi / Edit Link)
// ============================================
function openInput(docID) {
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
  
  const isEdit = doc.link && doc.status !== 'kosong' && doc.status !== 'draft';
  const judulPrompt = isEdit ? '✏️ EDIT LINK' : 'ISI LINK';
  const pesanPrompt = isEdit 
    ? `Anda akan MENGUBAH link untuk:\n\n${doc.nama_dokumen}\n\nLink saat ini:\n${doc.link}\n\nKalau diubah, status kembali ke "submitted".`
    : `Masukkan link Google Drive:\n\n${doc.nama_dokumen}\n\nFormat: https://drive.google.com/... atau https://docs.google.com/...`;
  
  const link = prompt(`${judulPrompt}\n\n${pesanPrompt}`, doc.link || '');
  
  if (link === null) return;
  if (!link.trim()) {
    showToast('Link tidak boleh kosong', 'error');
    return;
  }
  
  if (link.trim() === doc.link) {
    showToast('Link tidak berubah', 'error');
    return;
  }
  
  saveLink(docID, link.trim());
}

async function saveLink(docID, link) {
  const result = await callAPI('submitLink', { docID, link });
  
  if (result.success) {
    clearAPICache();
    showToast('✅ Link berhasil disimpan!');
    await loadDocs();
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

// ============================================
// CHART
// ============================================
let chartBarInstance = null;
let chartDonutInstance = null;
let currentChartType = 'bar';

async function loadCharts() {
  const result = cachedRekap || await callAPI('getRekap');
  
  if (!result.success || !result.data) {
    document.getElementById('chart-section').style.display = 'none';
    return;
  }
  
  const data = result.data;
  
  const fakultasMap = {
    'Fakultas Teknik': [],
    'Fakultas Ekonomi dan Bisnis': [],
    'Fakultas Hukum': [],
    'Fakultas Ilmu Kesehatan': [],
    'Fakultas Ilmu Komputer': [],
    'Fakultas Ilmu Sosial dan Ilmu Politik': [],
    'Fakultas Kedokteran': [],
    'Satuan Kerja Pendukung': []
  };
  
  data.forEach(item => {
    const subsatker = item.subsatker;
    let fakultas = 'Satuan Kerja Pendukung';
    
    if (subsatker.match(/^D3|^S1|^S2|^S3|^Profesi/) && 
        (subsatker.includes('Teknik'))) {
      fakultas = 'Fakultas Teknik';
    } else if (subsatker.match(/Perbankan|Akuntansi|Manajemen|Ekonomi/)) {
      fakultas = 'Fakultas Ekonomi dan Bisnis';
    } else if (subsatker.match(/Hukum/)) {
      fakultas = 'Fakultas Hukum';
    } else if (subsatker.match(/Keperawatan|Fisioterapi|Gizi|Kesehatan|Ners/)) {
      fakultas = 'Fakultas Ilmu Kesehatan';
    } else if (subsatker.match(/Sistem Informasi|Informatika|Sains Data/)) {
      fakultas = 'Fakultas Ilmu Komputer';
    } else if (subsatker.match(/Komunikasi|Politik|Hubungan Internasional|Sains Informasi|Kajian Film/)) {
      fakultas = 'Fakultas Ilmu Sosial dan Ilmu Politik';
    } else if (subsatker.match(/Kedokteran|Farmasi|Biomedis|Radiologi|Biologi|Apoteker/)) {
      fakultas = 'Fakultas Kedokteran';
    }
    
    if (!fakultasMap[fakultas]) fakultasMap[fakultas] = [];
    fakultasMap[fakultas].push(item.skor);
  });
  
  const fakultasLabels = [];
  const fakultasScores = [];
  
  Object.entries(fakultasMap).forEach(([nama, scores]) => {
    if (scores.length === 0) return;
    const avg = scores.reduce((s, x) => s + x, 0) / scores.length;
    fakultasLabels.push(nama.replace('Fakultas ', 'F. '));
    fakultasScores.push(Math.round(avg * 10) / 10);
  });
  
  const barColors = fakultasScores.map(skor => {
    if (skor >= 90) return '#059669';
    if (skor >= 70) return '#D97706';
    return '#DC2626';
  });
  
  const ctxBar = document.getElementById('chart-bar').getContext('2d');
  
  if (chartBarInstance) chartBarInstance.destroy();
  
  chartBarInstance = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: fakultasLabels,
      datasets: [{
        label: 'Rata-rata Skor (%)',
        data: fakultasScores,
        backgroundColor: barColors,
        borderRadius: 8,
        borderSkipped: false,
        barThickness: 28
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F3D2E',
          titleColor: 'white',
          bodyColor: 'white',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => 'Skor: ' + ctx.parsed.x + '%'
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            callback: (val) => val + '%',
            color: '#6B7280',
            font: { size: 11 }
          }
        },
        y: {
          grid: { display: false },
          ticks: {
            color: '#0F3D2E',
            font: { size: 12, weight: '600' }
          }
        }
      }
    }
  });
  
  const excellent = data.filter(d => d.skor >= 90).length;
  const good = data.filter(d => d.skor >= 70 && d.skor < 90).length;
  const poor = data.filter(d => d.skor < 70).length;
  
  const ctxDonut = document.getElementById('chart-donut').getContext('2d');
  
  if (chartDonutInstance) chartDonutInstance.destroy();
  
  chartDonutInstance = new Chart(ctxDonut, {
    type: 'doughnut',
    data: {
      labels: ['Excellent (≥90)', 'Good (70-89)', 'Perlu Perbaikan (<70)'],
      datasets: [{
        data: [excellent, good, poor],
        backgroundColor: ['#059669', '#D97706', '#DC2626'],
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F3D2E',
          titleColor: 'white',
          bodyColor: 'white',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => {
              const total = excellent + good + poor;
              const percent = Math.round((ctx.parsed / total) * 100);
              return ctx.label + ': ' + ctx.parsed + ' prodi (' + percent + '%)';
            }
          }
        }
      }
    }
  });
  
  const legendHtml = `
    <div class="donut-legend-item">
      <div class="donut-legend-color" style="background:#059669;"></div>
      <div class="donut-legend-label">✅ Excellent (≥90)</div>
      <div class="donut-legend-value">${excellent}</div>
    </div>
    <div class="donut-legend-item">
      <div class="donut-legend-color" style="background:#D97706;"></div>
      <div class="donut-legend-label">⚠️ Good (70-89)</div>
      <div class="donut-legend-value">${good}</div>
    </div>
    <div class="donut-legend-item">
      <div class="donut-legend-color" style="background:#DC2626;"></div>
      <div class="donut-legend-label">❌ Perlu Perbaikan</div>
      <div class="donut-legend-value">${poor}</div>
    </div>
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #E5E7EB;text-align:center;">
      <div style="font-size:24px;font-weight:800;color:#0F3D2E;">${data.length}</div>
      <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Total Prodi</div>
    </div>
  `;
  
  document.getElementById('chart-donut-legend').innerHTML = legendHtml;
}

function switchChart(type) {
  currentChartType = type;
  
  const btnBar = document.getElementById('btn-chart-bar');
  const btnDonut = document.getElementById('btn-chart-donut');
  const containerBar = document.getElementById('chart-bar-container');
  const containerDonut = document.getElementById('chart-donut-container');
  
  if (type === 'bar') {
    btnBar.classList.add('active');
    btnDonut.classList.remove('active');
    containerBar.style.display = 'block';
    containerDonut.style.display = 'none';
  } else {
    btnBar.classList.remove('active');
    btnDonut.classList.add('active');
    containerBar.style.display = 'none';
    containerDonut.style.display = 'block';
  }
}

// ============================================
// RTL Info
// ============================================
async function loadRtlInfo() {
  const card = document.getElementById('rtl-card');
  if (!card) return;
  
  const result = await callAPI('getMyRtlLink');
  
  if (!result.success || !result.data || !result.data.link_rtl) {
    card.style.display = 'none';
    return;
  }
  
  const link = result.data.link_rtl;
  const rtlStatus = result.data.rtl_status || 'kosong';
  const auditorCatatan = result.data.auditor_catatan || '';
  const verifikatorCatatan = result.data.verifikator_catatan || '';
  const auditorEmail = result.data.auditor_email || '';
  
  document.getElementById('rtl-link-url').textContent = link;
  document.getElementById('rtl-link-url').href = link;
  document.getElementById('btn-rtl-open').href = link;
  
  const statusInfo = document.getElementById('rtl-status-info');
  const btn = document.getElementById('btn-rtl-confirm');
  const header = card.querySelector('h2');
  
  if (rtlStatus === 'audited_pass') {
    card.querySelector('.badge').textContent = '✅ Selesai';
    card.querySelector('.badge').className = 'badge badge-success';
    if (header) header.textContent = '✅ RTL Sudah Lolos Audit';
    statusInfo.innerHTML = '<span style="color:#059669;font-weight:700;">✅ RTL sudah lolos audit — tidak perlu tindakan</span>';
    btn.style.display = 'none';
    
    const descEl = card.querySelector('p');
    if (descEl) descEl.textContent = 'RTL untuk prodi/satker Anda sudah lolos audit. Terima kasih.';
    
  } else if (rtlStatus === 'verified') {
    card.querySelector('.badge').textContent = '⏳ Menunggu Audit';
    card.querySelector('.badge').className = 'badge badge-info';
    if (header) header.textContent = '📋 RTL Sudah Diverifikasi';
    statusInfo.innerHTML = '<span style="color:#1E40AF;font-weight:700;">✅ Sudah diverifikasi — menunggu audit auditor</span>';
    btn.disabled = true;
    btn.style.background = '#9CA3AF';
    btn.style.cursor = 'not-allowed';
    btn.textContent = '✅ Sudah Diverifikasi';
    
  } else if (rtlStatus === 'submitted') {
    card.querySelector('.badge').textContent = '⏳ Menunggu Verifikasi';
    card.querySelector('.badge').className = 'badge badge-info';
    statusInfo.innerHTML = '<span style="color:#1E40AF;font-weight:700;">📤 Menunggu verifikasi</span>';
    btn.disabled = true;
    btn.style.background = '#9CA3AF';
    btn.style.cursor = 'not-allowed';
    btn.textContent = '📤 Menunggu Verifikasi';
    
  } else if (rtlStatus === 'rejected' || rtlStatus === 'audited_fail') {
    card.querySelector('.badge').textContent = '⚠️ Perlu Perbaikan';
    card.querySelector('.badge').className = 'badge badge-warning';
    
    let catatanHtml = '<span style="color:#DC2626;font-weight:700;">❌ Perlu perbaikan</span>';
    
    if (auditorCatatan) {
      catatanHtml += `
        <div style="margin-top:12px;padding:14px;background:#FEF3C7;border-left:4px solid #D97706;border-radius:8px;">
          <div style="font-weight:700;color:#92400E;font-size:12px;margin-bottom:6px;">⚠️ CATATAN AUDITOR</div>
          <div style="color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(auditorCatatan)}</div>
          ${auditorEmail ? `<div style="font-size:11px;color:#6B7280;margin-top:6px;">— ${escapeHtml(auditorEmail)}</div>` : ''}
        </div>
      `;
    } else if (verifikatorCatatan) {
      catatanHtml += `
        <div style="margin-top:12px;padding:14px;background:#DBEAFE;border-left:4px solid #2563EB;border-radius:8px;">
          <div style="font-weight:700;color:#1E40AF;font-size:12px;margin-bottom:6px;">✅ CATATAN VERIFIKATOR</div>
          <div style="color:#374151;font-size:14px;line-height:1.6;">${escapeHtml(verifikatorCatatan)}</div>
        </div>
      `;
    } else {
      catatanHtml += '<div style="margin-top:8px;font-size:12px;color:#6B7280;">(Tidak ada catatan dari auditor/verifikator)</div>';
    }
    
    statusInfo.innerHTML = catatanHtml;
    btn.disabled = false;
    btn.style.background = '#059669';
    btn.style.cursor = 'pointer';
    btn.textContent = '✅ Konfirmasi Selesai';
    
  } else {
    statusInfo.innerHTML = '<span style="color:#D97706;font-weight:700;">⏳ Belum dikonfirmasi</span>';
    btn.disabled = false;
    btn.style.background = '#059669';
    btn.style.cursor = 'pointer';
    btn.textContent = '✅ Konfirmasi Selesai';
  }
  
  card.style.display = 'block';
}

function findRtlDocID() {
  const rtlDoc = allDocs.find(d => 
    d.kategori === 'B' || 
    d.nama_dokumen.toLowerCase().includes('rtl')
  );
  return rtlDoc ? rtlDoc.docID : null;
}

async function confirmRtl() {
  const docID = findRtlDocID();
  if (!docID) {
    showToast('Dokumen RTL tidak ditemukan', 'error');
    return;
  }
  
  if (!confirm('Konfirmasi bahwa Anda sudah selesai mengisi dokumen RTL di link yang disiapkan?')) return;
  
  const btn = document.getElementById('btn-rtl-confirm');
  btn.disabled = true;
  btn.textContent = 'Memproses...';
  
  const result = await callAPI('confirmRtlDone', { docID });
  
  if (result.success) {
    clearAPICache();
    showToast('✅ ' + result.message);
    await loadDocs();
    await loadRtlInfo();
  } else {
    showToast('❌ ' + result.message, 'error');
    btn.disabled = false;
    btn.textContent = '✅ Konfirmasi Selesai';
  }
}

// ============================================
// Audit Result
// ============================================
async function loadAuditResult() {
  const card = document.getElementById('audit-result-card');
  if (!card) return;
  
  const result = await callAPI('getMyAuditResult');
  
  if (!result.success || !result.data || !result.data.link_audit) {
    card.style.display = 'none';
    return;
  }
  
  const link = result.data.link_audit;
  
  document.getElementById('audit-link-url').textContent = link;
  document.getElementById('audit-link-url').href = link;
  document.getElementById('btn-audit-open').href = link;
  
  card.style.display = 'block';
}

// ============================================
// SUBMIT REVISI
// ============================================
async function submitRevisi(docID) {
  let doc = allDocs.find(d => d.docID === docID);
  
  if (!doc) {
    for (const parent of allDocs) {
      if (parent.subs) {
        const sub = parent.subs.find(s => s.docID === docID);
        if (sub) { doc = sub; break; }
      }
    }
  }
  
  if (!doc) {
    showToast('Dokumen tidak ditemukan', 'error');
    return;
  }
  
  const konfirmasi = confirm(
    `🔄 KONFIRMASI SUBMIT REVISI\n\n` +
    `Dokumen: ${doc.nama_dokumen}\n\n` +
    `Link: ${doc.link}\n\n` +
    `Catatan sebelumnya:\n${doc.verifikator_catatan || doc.auditor_catatan || '(tidak ada)'}\n\n` +
    `Kirim konfirmasi ke verifikator? (Link tetap sama)`
  );
  
  if (!konfirmasi) return;
  
  const result = await callAPI('submitRevisi', { docID: docID });
  
  if (result.success) {
    clearAPICache();
    showToast('✅ Revisi terkirim ke verifikator!');
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