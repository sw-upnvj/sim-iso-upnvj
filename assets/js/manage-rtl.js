// ============================================
// manage-rtl.js - Kelola Link RTL & Audit (Admin)
// ============================================

let currentUser = null;
let prodiList = [];
let activeYear = 2026;

window.addEventListener('load', async () => {
  const session = requireLogin();
  if (!session) return;
  
  currentUser = session.user;
  
  if (currentUser.role !== 'administrator') {
    alert('Akses ditolak. Halaman ini hanya untuk administrator.');
    window.location.href = 'dashboard.html';
    return;
  }
  
  renderUserInfo();
  await loadAll();
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
  
  // Tampilkan semua menu untuk admin
  const elManage = document.getElementById('sidebar-manage-user');
  if (elManage) elManage.style.display = 'flex';
  
  const elVerif = document.getElementById('sidebar-verifikasi');
  if (elVerif) elVerif.style.display = 'flex';
  
  const elAudit = document.getElementById('sidebar-audit');
  if (elAudit) elAudit.style.display = 'flex';
  
  const elRtl = document.getElementById('sidebar-manage-rtl');
  if (elRtl) elRtl.style.display = 'flex';
}

async function loadAll(forceRefresh = false) {
  await Promise.all([
    loadConfig(),
    loadProdi()
  ]);
}

// ===== LOAD CONFIG LINK =====
async function loadConfig() {
  const result = await callAPI('getRtlConfig');
  
  if (!result.success) {
    showToast('❌ ' + result.message, 'error');
    return;
  }
  
  const data = result.data;
  activeYear = data.tahun || new Date().getFullYear();
  
  document.getElementById('year-badge').textContent = activeYear;
  document.getElementById('label-year-rtl').textContent = activeYear - 1;
  document.getElementById('label-year-audit').textContent = activeYear;
  document.getElementById('label-year-prodi').textContent = activeYear;
  
  document.getElementById('input-link-rtl').value = data.link_rtl_auditee || '';
  document.getElementById('input-link-audit').value = data.link_audit_auditor || '';
}

async function saveLinks() {
  const linkRtl = document.getElementById('input-link-rtl').value.trim();
  const linkAudit = document.getElementById('input-link-audit').value.trim();
  
  if (!linkRtl && !linkAudit) {
    showToast('Minimal 1 link harus diisi', 'error');
    return;
  }
  
  const urlPattern = /^https?:\/\/(drive|docs)\.google\.com\//;
  if (linkRtl && !urlPattern.test(linkRtl)) {
    showToast('Link RTL harus dari Google Drive/Docs', 'error');
    return;
  }
  if (linkAudit && !urlPattern.test(linkAudit)) {
    showToast('Link Audit harus dari Google Drive/Docs', 'error');
    return;
  }
  
  const btn = document.getElementById('btn-save-links');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';
  
  const result = await callAPI('saveRtlConfig', {
    link_rtl_auditee: linkRtl,
    link_audit_auditor: linkAudit
  });
  
  btn.disabled = false;
  btn.textContent = '💾 Simpan Link';
  
  if (result.success) {
    showToast('✅ ' + result.message);
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

// ===== LOAD PRODI =====
async function loadProdi() {
  const container = document.getElementById('prodi-list');
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Memuat daftar prodi...</div>';
  
  const result = await callAPI('getRtlProdiList');
  
  if (!result.success) {
    container.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(result.message)}</div>`;
    return;
  }
  
  prodiList = result.data || [];
  renderProdi();
  updateBadgeCount();
}

function renderProdi() {
  const container = document.getElementById('prodi-list');
  const searchFilter = document.getElementById('filter-search').value.toLowerCase();
  
  let filtered = prodiList.filter(p => {
    if (searchFilter && !p.subsatker.toLowerCase().includes(searchFilter)) return false;
    return true;
  });
  
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:40px;"><div>🔍</div><p>Tidak ada prodi yang cocok</p></div>`;
    return;
  }
  
  let html = '';
  
  filtered.forEach((p, index) => {
    const realIndex = prodiList.findIndex(x => x.subsatker === p.subsatker);
    const bgColor = p.selected ? '#F0FDF4' : 'transparent';
    const borderColor = p.selected ? '#A7F3D0' : '#E5E7EB';
    
    html += `
      <div style="padding:16px;margin-bottom:8px;border:1.5px solid ${borderColor};border-radius:12px;background:${bgColor};transition:all 0.2s;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <input type="checkbox" id="chk-${index}" ${p.selected ? 'checked' : ''}
                 onchange="toggleSelect(${realIndex})"
                 style="width:20px;height:20px;cursor:pointer;margin-top:2px;flex-shrink:0;">
          <div style="flex:1;">
            <label for="chk-${index}" style="font-size:14px;font-weight:600;color:#0F3D2E;cursor:pointer;display:block;margin-bottom:10px;">
              ${escapeHtml(p.subsatker)}
            </label>
            ${p.selected ? `
              <div style="display:flex;gap:16px;flex-wrap:wrap;">
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:6px 12px;background:white;border-radius:8px;border:1px solid #E5E7EB;">
                  <input type="checkbox" ${p.tampilkan_rtl ? 'checked' : ''}
                         onchange="toggleVisibility(${realIndex}, 'tampilkan_rtl')"
                         style="width:auto;cursor:pointer;">
                  👁️ Tampilkan Link RTL ke Auditee
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:6px 12px;background:white;border-radius:8px;border:1px solid #E5E7EB;">
                  <input type="checkbox" ${p.tampilkan_audit ? 'checked' : ''}
                         onchange="toggleVisibility(${realIndex}, 'tampilkan_audit')"
                         style="width:auto;cursor:pointer;">
                  📄 Tampilkan Hasil Audit ke Auditee
                </label>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function toggleSelect(index) {
  prodiList[index].selected = !prodiList[index].selected;
  if (!prodiList[index].selected) {
    prodiList[index].tampilkan_rtl = false;
    prodiList[index].tampilkan_audit = false;
  }
  renderProdi();
  updateBadgeCount();
}

function toggleVisibility(index, field) {
  prodiList[index][field] = !prodiList[index][field];
  renderProdi();
}

function updateBadgeCount() {
  const count = prodiList.filter(p => p.selected).length;
  document.getElementById('badge-count').textContent = count + ' prodi';
}

function resetProdiSelection() {
  if (!confirm('Reset semua pilihan prodi? Semua centang akan dihapus.')) return;
  prodiList.forEach(p => {
    p.selected = false;
    p.tampilkan_rtl = false;
    p.tampilkan_audit = false;
  });
  renderProdi();
  updateBadgeCount();
}

async function saveProdiSelection() {
  const selected = prodiList.filter(p => p.selected);
  
  if (selected.length === 0) {
    if (!confirm('Tidak ada prodi yang dipilih. Simpan tetap?')) return;
  }
  
  const btn = document.getElementById('btn-save-prodi');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';
  
  const result = await callAPI('saveRtlProdiSelected', {
    prodiList: prodiList
  });
  
  btn.disabled = false;
  btn.textContent = '💾 Simpan Semua Prodi';
  
  if (result.success) {
    showToast('✅ ' + result.message);
    await loadProdi();
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

function logout() {
  if (!confirm('Yakin ingin logout?')) return;
  clearSession();
  window.location.href = 'index.html';
}