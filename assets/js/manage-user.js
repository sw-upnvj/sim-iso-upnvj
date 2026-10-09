// ============================================
// manage-user.js - Logic kelola user (admin)
// ============================================

let allUsers = [];
let subsatkerList = [];
let currentUser = null;

window.addEventListener('load', async () => {
  const session = requireLogin();
  if (!session) return;
  
  currentUser = session.user;
  
  if (currentUser.role !== 'admin') {
    alert('Akses ditolak. Hanya admin.');
    window.location.href = 'dashboard.html';
    return;
  }
  
  renderUserInfo();
  await loadSubsatkerList();
  await loadUsers();
});

function renderUserInfo() {
  const el = document.getElementById('user-info');
  el.innerHTML = `
    <span style="opacity:0.9;">${escapeHtml(currentUser.nama)}</span>
    <span style="opacity:0.7;font-size:12px;"> • ${escapeHtml(currentUser.role)}</span>
  `;
}

async function loadSubsatkerList() {
  const result = await callAPI('getSubsatkerListAll');
  if (!result.success) return;
  
  subsatkerList = result.data || [];
  
  const select = document.getElementById('form-subsatker');
  subsatkerList.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });
}

// ============================================
// LOAD USERS DENGAN CACHE
// ============================================
async function loadUsers(forceRefresh = false) {
  const container = document.getElementById('table-container');
  
  // Cek cache dulu (kecuali force refresh)
  const cached = !forceRefresh ? getUsersCache() : null;
  if (cached) {
    allUsers = cached;
    renderUsers();
    return;
  }
  
  container.innerHTML = '<div class="loading"><span class="spinner"></span> Memuat data...</div>';
  
  const result = await callAPI('getUsers');
  
  if (!result.success) {
    container.innerHTML = `<div class="alert alert-error">❌ ${escapeHtml(result.message)}</div>`;
    return;
  }
  
  allUsers = result.data || [];
  setUsersCache(allUsers);
  renderUsers();
}

// ===== Cache Management =====
function getUsersCache() {
  try {
    const cached = localStorage.getItem('users_cache');
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > 5 * 60 * 1000) {  // 5 menit
      localStorage.removeItem('users_cache');
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

function setUsersCache(data) {
  try {
    localStorage.setItem('users_cache', JSON.stringify({
      data: data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.error('Cache save error:', e);
  }
}

function clearUsersCache() {
  localStorage.removeItem('users_cache');
}

// ============================================
// RENDER TABEL USER
// ============================================
function renderUsers() {
  const container = document.getElementById('table-container');
  
  if (allUsers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size:48px;">👥</div>
        <p>Belum ada user terdaftar</p>
      </div>
    `;
    return;
  }
  
  const searchFilter = document.getElementById('filter-search').value.toLowerCase();
  const roleFilter = document.getElementById('filter-role').value;
  const statusFilter = document.getElementById('filter-status').value;
  
  let filtered = allUsers.filter(u => {
    if (searchFilter && 
        !u.nama.toLowerCase().includes(searchFilter) && 
        !u.email.toLowerCase().includes(searchFilter)) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter === 'aktif' && !u.aktif) return false;
    if (statusFilter === 'nonaktif' && u.aktif) return false;
    return true;
  });
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size:48px;">🔍</div>
        <p>Tidak ada user yang cocok dengan filter</p>
      </div>
    `;
    return;
  }
  
  let html = `
    <table>
      <thead>
        <tr>
          <th style="width:50px;">No</th>
          <th>Nama</th>
          <th>Email</th>
          <th style="width:100px;">Role</th>
          <th>Subsatker</th>
          <th style="width:90px;">Status</th>
          <th style="width:140px;">Aksi</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  filtered.forEach((u, index) => {
    const roleBadge = u.role === 'administrator' 
     ? '<span class="badge badge-danger">Administrator</span>'
        : u.role === 'verifikator'
        ? '<span class="badge badge-info">Verifikator</span>'
        : u.role === 'auditor'
        ? '<span class="badge badge-warning">Auditor</span>'
        : '<span class="badge" style="background:#D1FAE5;color:#065F46;">Auditee</span>';

    const statusBadge = u.aktif
      ? '<span class="badge badge-success">✅ Aktif</span>'
      : '<span class="badge badge-gray">⛔ Nonaktif</span>';
    
    const isSelf = u.email.toLowerCase() === currentUser.email.toLowerCase();
    
    html += `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(u.nama)}</strong></td>
        <td style="font-size:13px;color:#6b7280;">${escapeHtml(u.email)}</td>
        <td>${roleBadge}</td>
        <td style="font-size:13px;">${escapeHtml(u.subsatker)}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editUser('${escapeHtml(u.email)}')">Edit</button>
          ${!isSelf ? `<button class="btn btn-sm" style="background:#dc2626;color:white;" onclick="confirmDelete('${escapeHtml(u.email)}', '${escapeHtml(u.nama)}')">Hapus</button>` : ''}
        </td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ============================================
// MODAL
// ============================================
function openModal() {
  document.getElementById('modal-title').textContent = 'Tambah User Baru';
  document.getElementById('form-is-edit').value = 'false';
  document.getElementById('form-email').value = '';
  document.getElementById('form-email').disabled = false;
  document.getElementById('form-nama').value = '';
  document.getElementById('form-role').value = 'user';
  document.getElementById('form-subsatker').value = '';
  document.getElementById('form-aktif').checked = true;
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

function editUser(email) {
  const u = allUsers.find(x => x.email.toLowerCase() === email.toLowerCase());
  if (!u) return;
  
  document.getElementById('modal-title').textContent = 'Edit User';
  document.getElementById('form-is-edit').value = 'true';
  document.getElementById('form-email').value = u.email;
  document.getElementById('form-email').disabled = true;
  document.getElementById('form-nama').value = u.nama;
  document.getElementById('form-role').value = u.role;
  document.getElementById('form-subsatker').value = u.subsatker;
  document.getElementById('form-aktif').checked = u.aktif;
  document.getElementById('modal-overlay').classList.add('show');
}

// ============================================
// SAVE USER (dengan clear cache)
// ============================================
async function saveUser() {
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';
  
  const payload = {
    email: document.getElementById('form-email').value.trim().toLowerCase(),
    nama: document.getElementById('form-nama').value.trim(),
    role: document.getElementById('form-role').value,
    subsatker: document.getElementById('form-subsatker').value,
    aktif: document.getElementById('form-aktif').checked,
    isEdit: document.getElementById('form-is-edit').value === 'true'
  };
  
  if (!payload.email || !payload.nama || !payload.subsatker) {
    showToast('Semua field wajib diisi', 'error');
    btn.disabled = false;
    btn.textContent = 'Simpan';
    return;
  }
  
  const result = await callAPI('saveUser', payload);
  
  btn.disabled = false;
  btn.textContent = 'Simpan';
  
  if (result.success) {
    showToast('✅ ' + result.message);
    closeModal();
    clearUsersCache();          // Clear cache karena data berubah
    await loadUsers(true);      // Force refresh
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

// ============================================
// DELETE USER (dengan clear cache)
// ============================================
async function confirmDelete(email, nama) {
  if (!confirm(`Yakin ingin menghapus user:\n\n${nama}\n(${email})\n\nAksi ini tidak bisa dibatalkan.`)) return;
  
  const result = await callAPI('deleteUser', { email });
  
  if (result.success) {
    showToast('✅ User berhasil dihapus');
    clearUsersCache();          // Clear cache karena data berubah
    await loadUsers(true);      // Force refresh
  } else {
    showToast('❌ ' + result.message, 'error');
  }
}

function logout() {
  if (!confirm('Yakin ingin logout?')) return;
  clearSession();
  window.location.href = 'index.html';
}

// Close modal kalau klik overlay
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});