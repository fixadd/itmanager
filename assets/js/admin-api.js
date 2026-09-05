(function () {
  function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c])); }
  function can(key) { return (window.IT_AUTH_USER?.permissions || []).includes(key); }
  function shell(title, subtitle, body) {
    return `<div class="page-header"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div></div><div class="card border-0 shadow-sm"><div class="card-body">${body}</div></div>`;
  }

  async function usersView(root) {
    if (!can('users.manage')) { root.innerHTML = shell('Yetkisiz', 'Bu bölümü görüntülemek için yetkiniz bulunmuyor.', '<div class="alert alert-danger mb-0">users.manage yetkisi gerekli.</div>'); return; }
    const [{ items: users }, { items: roles }] = await Promise.all([window.IT_AUTH.request('/users'), window.IT_AUTH.request('/roles')]);
    root.innerHTML = shell('Kullanıcılar', 'Sistem kullanıcılarını, rollerini ve erişim durumlarını yönetin.', `<div class="d-flex justify-content-between gap-2 mb-3"><div class="input-group" style="max-width:360px"><span class="input-group-text"><i class="ti ti-search"></i></span><input id="adminUserSearch" class="form-control" placeholder="Kullanıcı veya e-posta"></div><button id="addUserBtn" class="btn btn-primary"><i class="ti ti-plus me-1"></i>Kullanıcı Ekle</button></div><div class="table-responsive"><table class="table table-dark table-hover align-middle mb-0"><thead><tr><th>Kullanıcı</th><th>E-posta</th><th>Rol</th><th>Durum</th><th>Son Giriş</th><th class="text-end">İşlem</th></tr></thead><tbody id="adminUsersBody">${userRows(users, roles)}</tbody></table></div>`);
    const body = root.querySelector('#adminUsersBody');
    root.querySelector('#adminUserSearch').addEventListener('input', e => { const q = e.target.value.toLowerCase(); body.innerHTML = userRows(users.filter(u => `${u.username} ${u.email || ''}`.toLowerCase().includes(q)), roles); });
    root.querySelector('#addUserBtn').onclick = () => userModal(roles);
    body.addEventListener('click', async e => {
      const btn = e.target.closest('[data-user-toggle]'); if (!btn) return;
      try { await window.IT_AUTH.request(`/users/${btn.dataset.userToggle}/toggle`, { method:'POST' }); await usersView(root); } catch (err) { alert(err.message); }
    });
  }
  function userRows(users) { return users.map(u => `<tr><td><strong>${esc(u.username)}</strong></td><td>${esc(u.email || '-')}</td><td>${esc(u.role?.name || 'Rol yok')}</td><td><span class="badge ${u.active ? 'text-bg-success' : 'text-bg-secondary'}">${u.active ? 'Aktif' : 'Pasif'}</span></td><td>${u.last_login_at ? new Date(u.last_login_at).toLocaleString('tr-TR') : '-'}</td><td class="text-end"><button class="btn btn-sm btn-outline-secondary" data-user-toggle="${u.id}">${u.active ? 'Pasifleştir' : 'Aktifleştir'}</button></td></tr>`).join('') || '<tr><td colspan="6" class="text-center text-secondary py-4">Kullanıcı bulunamadı.</td></tr>'; }

  function userModal(roles) {
    const old = document.getElementById('adminUserModal'); if (old) old.remove();
    const el = document.createElement('div'); el.id = 'adminUserModal'; el.className = 'modal fade'; el.innerHTML = `<div class="modal-dialog"><div class="modal-content bg-dark text-light"><form id="newUserForm"><div class="modal-header"><h5 class="modal-title">Yeni Kullanıcı</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="mb-3"><label class="form-label">Kullanıcı Adı</label><input name="username" class="form-control" required></div><div class="mb-3"><label class="form-label">E-posta</label><input name="email" type="email" class="form-control"></div><div class="mb-3"><label class="form-label">Şifre</label><input name="password" type="password" minlength="8" class="form-control" required></div><div><label class="form-label">Rol</label><select name="role_id" class="form-select"><option value="">Rol seçin</option>${roles.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary">Oluştur</button></div></form></div></div>`; document.body.appendChild(el); const modal = new bootstrap.Modal(el); modal.show(); el.querySelector('form').onsubmit = async e => { e.preventDefault(); const f=e.currentTarget; try { await window.IT_AUTH.request('/users',{method:'POST',body:JSON.stringify({username:f.username.value,email:f.email.value,password:f.password.value,role_id:f.role_id.value||null})}); modal.hide(); location.hash='#admin'; window.dispatchEvent(new HashChangeEvent('hashchange')); } catch(err){ alert(err.message); } }; el.addEventListener('hidden.bs.modal',()=>el.remove());
  }

  async function rolesView(root) {
    if (!can('roles.manage')) { root.innerHTML = shell('Yetkisiz', 'Rol ve yetki yönetimi için erişiminiz yok.', '<div class="alert alert-danger mb-0">roles.manage yetkisi gerekli.</div>'); return; }
    const [{items: roles}, {items: permissions}] = await Promise.all([window.IT_AUTH.request('/roles'), window.IT_AUTH.request('/permissions')]);
    root.innerHTML = shell('Roller & Yetkiler', 'Rolleri ve sistem izinlerini yönetin.', `<div class="row g-3">${roles.map(r => `<div class="col-xl-4 col-md-6"><div class="border rounded-3 p-3 h-100"><div class="d-flex justify-content-between"><div><h5 class="mb-1">${esc(r.name)}</h5><div class="small text-secondary">${esc(r.description || '')}</div></div><span class="badge ${r.active?'text-bg-success':'text-bg-secondary'}">${r.active?'Aktif':'Pasif'}</span></div><hr><div class="small">${r.permissions.map(p=>`<span class="badge text-bg-dark border me-1 mb-1">${esc(p)}</span>`).join('') || '<span class="text-secondary">Yetki yok</span>'}</div></div></div>`).join('')}</div><hr><h5>Tanımlı Yetkiler</h5><div class="row g-2">${permissions.map(p=>`<div class="col-lg-3 col-md-4"><div class="border rounded p-2"><strong class="small">${esc(p.key)}</strong><div class="small text-secondary">${esc(p.name)}</div></div></div>`).join('')}</div>`);
  }

  async function profileView(root) {
    const u = window.IT_AUTH_USER;
    root.innerHTML = shell('Profil', 'Hesap bilgilerinizi ve şifrenizi yönetin.', `<div class="row g-4"><div class="col-lg-4"><div class="p-4 border rounded-3 h-100 text-center"><div class="rounded-circle bg-primary-subtle text-primary d-inline-grid place-items-center mb-3" style="width:72px;height:72px;font-size:24px;font-weight:700">${esc((u?.username||'IT').slice(0,2).toUpperCase())}</div><h4>${esc(u?.personnel?.name || u?.username || '-')}</h4><div class="text-secondary">${esc(u?.role?.name || 'Kullanıcı')}</div></div></div><div class="col-lg-8"><form id="profileForm"><div class="mb-3"><label class="form-label">Kullanıcı Adı</label><input class="form-control" value="${esc(u?.username||'')}" disabled></div><div class="mb-3"><label class="form-label">E-posta</label><input name="email" class="form-control" value="${esc(u?.email||'')}"></div><hr><h5>Şifre Değiştir</h5><div class="mb-3"><label class="form-label">Yeni Şifre</label><input name="password" type="password" minlength="8" class="form-control" placeholder="Boş bırakılırsa değişmez"></div><button class="btn btn-primary">Kaydet</button></form></div></div>`);
    root.querySelector('#profileForm').onsubmit = async e => { e.preventDefault(); const f=e.currentTarget; try { const d=await window.IT_AUTH.request('/profile',{method:'PATCH',body:JSON.stringify({email:f.email.value,password:f.password.value||undefined})}); window.IT_AUTH_USER=d.user; alert('Profil güncellendi.'); } catch(err){ alert(err.message); } };
  }

  async function render() {
    const hash = location.hash.replace('#','').split('?')[0];
    if (hash !== 'admin' && hash !== 'profile') return;
    const root = document.getElementById('pageContent'); if (!root || !window.IT_AUTH) return;
    try {
      if (hash === 'profile') return profileView(root);
      const sub = document.querySelector('.admin-submenu-link.active')?.dataset.adminView || 'users';
      if (sub === 'roles') return rolesView(root);
      return usersView(root);
    } catch (err) { root.innerHTML = shell('Hata', 'Yönetim ekranı yüklenemedi.', `<div class="alert alert-danger">${esc(err.message)}</div>`); }
  }

  document.addEventListener('click', e => { const b=e.target.closest('[data-admin-view]'); if(!b)return; document.querySelectorAll('[data-admin-view]').forEach(x=>x.classList.remove('active')); b.classList.add('active'); render(); });
  window.IT_ADMIN = { render };
  window.addEventListener('hashchange', render);
  window.addEventListener('itmanager:auth', render);
  document.addEventListener('DOMContentLoaded', render);
})();
