// ============================================
// audit.js - Logic halaman auditor (Section A/B)
// ============================================

let currentUser = null;
let allProdi = [];
let currentProdi = null;
let currentAuditDoc = null;

window.addEventListener('load', async () => {
  const session = requireLogin();
  if (!session) return;
  
  currentUser = session.user;
  
  if (currentUser.role !== 'auditor' && currentUser.role !== 'administrator') {
    alert('Akses ditolak. Halaman ini hanya untuk auditor & administrator.');
    window.location.href = 'dashboard.html';
    return;
  }
  
  renderUserInfo();
  await loadProdiList();
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
    const elVerif = document.getElementById('sidebar-verifikasi');
    if (elVerif) elVerif.style.display = 'flex';
    const elRtl = document.getElementById('sidebar-manage-rtl');
    if (elRtl) elRtl.style.display = 'flex';
  }
}

// ============================================
// SECTION A: LIST PRODI
// ============================================
async function loadProdiList(forceRefresh = false) {
  const container = document.getElementById('prodi-container');
  if (!container) return;
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Memuat daftar prodi...</div>';
  
  const result = await callAPI('getAllProdiForAudit');
  
  if (!result.success) {
    container.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(result.message)}</div>`;
    return;
  }
  
  allProdi = result.data || [];
  
  const totalProdi = allProdi.length;
  const rtlCount = allProdi.filter(p => p.hasRtl).length;
  const avgSkor = totalProdi > 0 
    ? Math.round(allProdi.reduce((s, p) => s + p.skor, 0) / totalProdi * 10) / 10 
    : 0;
  const prodi100 = allProdi.filter(p => p.skor === 100).length;
  
  const elTotalProdi = document.getElementById('stat-total-prodi');
  const elRtl = document.getElementById('stat-rtl');
  const elAvg = document.getElementById('stat-avg-skor');
  const el100 = document.getElementById('stat-100');
  
  if (elTotalProdi) elTotalProdi.textContent = totalProdi;
  if (elRtl) elRtl.textContent = rtlCount;
  if (elAvg) elAvg.textContent = avgSkor + '%';
  if (el100) el100.textContent = prodi100;
  
  renderProdi();
}

function renderProdi() {
  const container = document.getElementById('prodi-container');
  if (!container) return;
  
  const searchFilter = document.getElementById('filter-search')?.value.toLowerCase() || '';
  const rtlFilter = document.getElementById('filter-rtl')?.value || '';
  
  let filtered = allProdi.filter(p => {
    if (searchFilter && !p.subsatker.toLowerCase().includes(searchFilter)) return false;
    if (rtlFilter === 'rtl' && !p.hasRtl) return false;
    if (rtlFilter === 'non-rtl' && p.hasRtl) return false;
    return true;
  });
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div>🔍</div>
        <p>Tidak ada prodi yang cocok</p>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  filtered.forEach(p => {
    const skorColor = p.skor >= 90 ? '#059669' : p.skor >= 70 ? '#D97706' : '#DC2626';
    
    html += `
      <div style="padding:20px;border:1px solid #E5E7EB;border-radius:12px;margin-bottom:12px;background:white;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <div style="font-size:16px;font-weight:700;color:#0F3D2E;margin-bottom:6px;">
              ${escapeHtml(p.subsatker)}
            </div>
            <div style="font-size:13px;color:#6B7280;">
              ${p.verified}/${p.total} dokumen verified · Skor: 
              <strong style="color:${skorColor};">${p.skor}%</strong>
            </div>
            ${p.hasRtl ? `<div style="margin-top:8px;"><span class="badge badge-warning">⚠️ Prodi dengan RTL 2025</span>${p.rtlAssessed ? `<span class="badge badge-info" style="margin-left:6px;">RTL: ${p.rtlStatus === 'selesai' ? '✅ Selesai' : '⚠️ Belum Sesuai'}</span>` : ''}</div>` : ''}
          </div>
          
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${p.hasRtl ? `<button class="btn btn-secondary btn-sm" onclick="openRtl('${escapeHtml(p.subsatker)}')">📋 Lihat RTL 2025</button>` : ''}
            <button class="btn btn-primary btn-sm" onclick="openAudit('${escapeHtml(p.subsatker)}')">🔍 Audit 2026</button>
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// ============================================
// SECTION B: AUDIT PRODI
// ============================================
async function openAudit(subsatker) {
  currentProdi = subsatker;
  
  document.getElementById('section-a').style.display = 'none';
  document.getElementById('section-b').style.display = 'block';
  document.getElementById('page-title').textContent = 'Audit: ' + subsatker;
  
  document.getElementById('audit-title').textContent = '🔍 Audit: ' + subsatker;
  document.getElementById('audit-subtitle').textContent = 'Review RTL 2025 & audit dokumen ISO 2026';
  
  const container = document.getElementById('audit-docs-container');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Memuat detail...</div>';
  
  const result = await callAPI('getProdiAuditFullDetail', { subsatker });
  
  if (!result.success) {
    container.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(result.message)}</div>`;
    return;
  }
  
  const data = result.data;
  
  // ===== RTL Section =====
  const rtlCard = document.getElementById('rtl-section-card');
  
  if (rtlCard && data.rtl && data.rtl.length > 0) {
    rtlCard.style.display = 'block';
    
    const rtl = data.rtl[0];
    
    document.getElementById('rtl-link-auditee').textContent = rtl.link_auditee || '-';
    document.getElementById('rtl-link-auditee').href = rtl.link_auditee || '#';
    document.getElementById('rtl-btn-auditee').href = rtl.link_auditee || '#';
    
    const statusInfo = document.getElementById('rtl-status-info');
    if (rtl.status === 'submitted') {
      statusInfo.innerHTML = '<span class="badge badge-info">📤 Submitted</span> <span style="font-size:12px;color:#6B7280;">— Siap direview</span>';
    } else if (rtl.status === 'verified') {
      statusInfo.innerHTML = '<span class="badge badge-success">✅ Terverifikasi</span>';
    } else if (rtl.status === 'rejected') {
      statusInfo.innerHTML = '<span class="badge badge-danger">❌ Ditolak</span>';
    } else {
      statusInfo.innerHTML = '<span class="badge badge-gray">❌ Belum submit</span>';
    }
    
    const linkAdmin = data.link_audit_admin || '';
    document.getElementById('rtl-link-admin').textContent = linkAdmin || 'Belum diatur';
    document.getElementById('rtl-link-admin').href = linkAdmin || '#';
    document.getElementById('rtl-btn-admin').href = linkAdmin || '#';
    
    if (data.rtl_assessment) {
      document.querySelectorAll('input[name="status-rtl"]').forEach(r => {
        r.checked = r.value === data.rtl_assessment.status_rtl;
      });
      document.getElementById('input-catatan-rtl').value = data.rtl_assessment.catatan_rtl || '';
    } else {
      document.querySelectorAll('input[name="status-rtl"]').forEach(r => r.checked = false);
      document.getElementById('input-catatan-rtl').value = '';
    }
  } else if (rtlCard) {
    rtlCard.style.display = 'none';
  }
  
  // ===== Dokumen Section =====
  if (!data.docs || data.docs.length === 0) {
    container.innerHTML = '<div class="empty-state"><div>📭</div><p>Tidak ada dokumen</p></div>';
  } else {
    let html = `
      <table>
        <thead>
          <tr>
            <th style="width:50px;">No</th>
            <th>Nama Dokumen</th>
            <th style="width:150px;">Status</th>
            <th style="width:200px;">Aksi</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    data.docs.forEach((doc, index) => {
      let statusBadge;
      if (doc.status === 'verified') {
        statusBadge = '<span class="badge badge-info">✅ Terverifikasi</span>';
      } else if (doc.status === 'audited_pass') {
        statusBadge = '<span class="badge badge-success">✅ Lolos Audit</span>';
      } else if (doc.status === 'audited_fail') {
        statusBadge = '<span class="badge badge-warning">⚠️ Perlu Perbaikan</span>';
      } else if (doc.status === 'submitted') {
        statusBadge = '<span class="badge badge-info">📤 Submitted</span>';
      } else if (doc.status === 'rejected') {
        statusBadge = '<span class="badge badge-danger">❌ Ditolak</span>';
      } else {
        statusBadge = '<span class="badge badge-gray">❌ Kosong</span>';
      }
      
      const actionBtns = doc.link 
        ? `<a href="${escapeHtml(doc.link)}" target="_blank" class="btn btn-secondary btn-sm">🔗 Lihat</a>
           <button class="btn btn-primary btn-sm" onclick="openAuditDoc('${doc.docID}')">🔍 Audit</button>`
        : '<span style="color:#9CA3AF;font-size:12px;">Belum ada link</span>';
      
      html += `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(doc.nama_dokumen)}</td>
          <td>${statusBadge}</td>
          <td>${actionBtns}</td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }
  
  // ===== Summary Section =====
  const summaryCard = document.getElementById('summary-card');
  if (summaryCard) {
    summaryCard.style.display = 'block';
    if (data.summary) {
      document.getElementById('input-temuan').value = data.summary.temuan_audit || '';
      document.getElementById('input-perbaikan').value = data.summary.rekomendasi_perbaikan || '';
      document.getElementById('input-peningkatan').value = data.summary.rekomendasi_peningkatan || '';
    } else {
      document.getElementById('input-temuan').value = '';
      document.getElementById('input-perbaikan').value = '';
      document.getElementById('input-peningkatan').value = '';
    }
  }
}

function openAuditDoc(docID) {
  callAPI('getProdiAuditFullDetail', { subsatker: currentProdi }).then(r => {
    if (!r.success) return;
    
    let doc = r.data.docs.find(d => d.docID === docID);
    if (!doc) {
      doc = r.data.rtl.find(d => d.docID === docID);
    }
    if (!doc) return;
    
    currentAuditDoc = {
      docID: doc.docID,
      subsatker: currentProdi,
      nama_dokumen: doc.nama_dokumen,
      link: doc.link || doc.link_auditee,
      verifikator_catatan: doc.verifikator_catatan,
      auditor_catatan: doc.auditor_catatan,
      email_auditee: doc.email_auditee || ''
    };
    
    document.getElementById('modal-audit-title').textContent = 'Audit: ' + doc.nama_dokumen;
    document.getElementById('modal-audit-link').textContent = doc.link || doc.link_auditee || '-';
    document.getElementById('modal-audit-link').href = doc.link || doc.link_auditee || '#';
    document.getElementById('modal-audit-link-btn').href = doc.link || doc.link_auditee || '#';
    document.getElementById('modal-catatan').value = doc.auditor_catatan || '';
    
    if (doc.verifikator_catatan) {
      document.getElementById('modal-ver-catatan').textContent = doc.verifikator_catatan;
      document.getElementById('modal-ver-container').style.display = 'block';
    } else {
      document.getElementById('modal-ver-container').style.display = 'none';
    }
    
    document.getElementById('modal-audit-doc').classList.add('show');
  });
}

function closeAuditModal() {
  document.getElementById('modal-audit-doc').classList.remove('show');
  currentAuditDoc = null;
}

async function submitAuditPass() {
  if (!currentAuditDoc) return;
  
  const catatan = document.getElementById('modal-catatan').value.trim();
  const btn = document.getElementById('btn-audit-pass');
  btn.disabled = true;
  btn.textContent = 'Memproses...';
  
  const result = await callAPI('auditPass', {
    docID: currentAuditDoc.docID,
    subsatker: currentAuditDoc.subsatker,
    email_auditee: currentAuditDoc.email_auditee,
    catatan: catatan
  });
  
  btn.disabled = false;
  btn.textContent = '✅ Lolos';
  
  if (result.success) {
    showToast('✅ ' + result.message);
    closeAuditModal();
    await openAudit(currentProdi);
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

async function submitAuditFail() {
  if (!currentAuditDoc) return;
  
  const catatan = document.getElementById('modal-catatan').value.trim();
  if (!catatan) {
    showToast('Catatan wajib diisi', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-audit-fail');
  btn.disabled = true;
  btn.textContent = 'Memproses...';
  
  const result = await callAPI('auditFail', {
    docID: currentAuditDoc.docID,
    subsatker: currentAuditDoc.subsatker,
    email_auditee: currentAuditDoc.email_auditee,
    catatan: catatan
  });
  
  btn.disabled = false;
  btn.textContent = '❌ Tidak Lolos';
  
  if (result.success) {
    showToast('✅ ' + result.message);
    closeAuditModal();
    await openAudit(currentProdi);
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

async function saveSummary() {
  const btn = document.getElementById('btn-save-summary');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';
  
  const result = await callAPI('saveAuditSummary', {
    subsatker: currentProdi,
    temuan_audit: document.getElementById('input-temuan').value.trim(),
    rekomendasi_perbaikan: document.getElementById('input-perbaikan').value.trim(),
    rekomendasi_peningkatan: document.getElementById('input-peningkatan').value.trim()
  });
  
  btn.disabled = false;
  btn.textContent = '💾 Simpan 3 Poin';
  
  if (result.success) {
    showToast('✅ ' + result.message);
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

// ============================================
// SECTION C: REVIEW RTL (via tombol)
// ============================================
async function openRtl(subsatker) {
  currentProdi = subsatker;
  
  document.getElementById('section-a').style.display = 'none';
  document.getElementById('section-b').style.display = 'none';
  document.getElementById('section-c').style.display = 'block';
  document.getElementById('page-title').textContent = 'Review RTL: ' + subsatker;
  
  document.getElementById('rtl-title').textContent = '📋 Review RTL 2025 - ' + subsatker;
  
  const container = document.getElementById('rtl-doc-container');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Memuat dokumen RTL...</div>';
  
  const result = await callAPI('getRtlDetail', { subsatker });
  
  if (!result.success) {
    container.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(result.message)}</div>`;
    document.getElementById('rtl-assessment-card').style.display = 'none';
    return;
  }
  
  const data = result.data;
  
  let html = `
    <div style="padding:16px;background:#F9FAFB;border-radius:12px;margin-bottom:16px;">
      <div style="font-size:14px;font-weight:700;color:#0F3D2E;margin-bottom:8px;">
        ${escapeHtml(data.nama_dokumen)}
      </div>
      <div style="font-size:12px;color:#6B7280;margin-bottom:8px;">
        Status: <strong>${data.status === 'verified' ? '✅ Terverifikasi' : data.status}</strong>
      </div>
      ${data.link ? `<a href="${escapeHtml(data.link)}" target="_blank" class="btn btn-primary btn-sm">🔗 Buka Dokumen RTL</a>` : '<div style="color:#9CA3AF;font-size:12px;">Belum ada link</div>'}
      ${data.verifikator_catatan ? `<div style="margin-top:12px;padding:12px;background:#DBEAFE;border-radius:8px;font-size:13px;color:#1E40AF;"><strong>Catatan Verifikator:</strong> ${escapeHtml(data.verifikator_catatan)}</div>` : ''}
    </div>
  `;
  container.innerHTML = html;
  
  document.getElementById('rtl-assessment-card').style.display = 'block';
  
  if (data.assessment) {
    const radios = document.querySelectorAll('input[name="status-rtl"]');
    radios.forEach(r => {
      r.checked = r.value === data.assessment.status_rtl;
    });
    document.getElementById('input-catatan-rtl').value = data.assessment.catatan_rtl || '';
  } else {
    document.querySelectorAll('input[name="status-rtl"]').forEach(r => r.checked = false);
    document.getElementById('input-catatan-rtl').value = '';
  }
}

async function saveRtlAssessment() {
  const statusRtl = document.querySelector('input[name="status-rtl"]:checked');
  
  if (!statusRtl) {
    showToast('Pilih status RTL terlebih dahulu', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-save-rtl');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';
  }
  
  const result = await callAPI('saveRtlAssessment', {
    subsatker: currentProdi,
    status_rtl: statusRtl.value,
    catatan_rtl: document.getElementById('input-catatan-rtl').value.trim()
  });
  
  if (btn) {
    btn.disabled = false;
    btn.textContent = '💾 Simpan Penilaian RTL';
  }
  
  if (result.success) {
    showToast('✅ ' + result.message);
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

function backToSectionA() {
  document.getElementById('section-a').style.display = 'block';
  document.getElementById('section-b').style.display = 'none';
  document.getElementById('section-c').style.display = 'none';
  document.getElementById('page-title').textContent = 'Audit Dokumen';
  currentProdi = null;
  loadProdiList();
}

function logout() {
  if (!confirm('Yakin ingin logout?')) return;
  clearSession();
  window.location.href = 'index.html';
}