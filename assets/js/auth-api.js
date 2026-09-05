(function () {
  const API = '/api';
  let me = null;

  async function request(url, options = {}) {
    const res = await fetch(API + url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data.detail || data.error || 'İşlem başarısız.');
    return data;
  }

  function initials(name) { return String(name || 'IT').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'IT'; }

  function syncUser(user) {
    me = user;
    const btn = document.getElementById('topUserBtn');
    if (!btn || !user) return;
    const spans = btn.querySelectorAll('span');
    const avatar = btn.querySelector('.avatar');
    if (avatar) avatar.textContent = initials(user.personnel?.name || user.username);
    if (spans[1]) {
      const strong = spans[1].querySelector('strong');
      const small = spans[1].querySelector('small');
      if (strong) strong.textContent = user.personnel?.name || user.username;
      if (small) small.textContent = user.role?.name || 'Kullanıcı';
    }
    window.IT_AUTH_USER = user;
    window.dispatchEvent(new CustomEvent('itmanager:auth', { detail: user }));
  }

  function showLogin() {
    if (document.getElementById('itLoginOverlay')) return;
    const el = document.createElement('div');
    el.id = 'itLoginOverlay';
    el.innerHTML = `<div class="it-login-card"><div class="it-login-brand"><div class="brand-mark">B</div><div><strong>BAYLAN</strong><span>IT MANAGER</span></div></div><h2>Hoş Geldiniz</h2><p>Devam etmek için hesabınızla giriş yapın.</p><form id="itLoginForm"><div class="mb-3"><label class="form-label">Kullanıcı Adı</label><input class="form-control" name="username" autocomplete="username" required></div><div class="mb-3"><label class="form-label">Şifre</label><input class="form-control" type="password" name="password" autocomplete="current-password" required></div><div id="itLoginError" class="alert alert-danger py-2 small d-none"></div><button class="btn btn-primary w-100" type="submit"><i class="ti ti-login me-1"></i>Giriş Yap</button></form></div>`;
    document.body.appendChild(el);
    document.getElementById('itLoginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const button = form.querySelector('button');
      const error = document.getElementById('itLoginError');
      error.classList.add('d-none'); button.disabled = true;
      try {
        const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username: form.username.value, password: form.password.value }) });
        syncUser(data.user); el.remove(); window.location.hash = '#dashboard'; window.location.reload();
      } catch (err) { error.textContent = err.message; error.classList.remove('d-none'); }
      finally { button.disabled = false; }
    });
  }

  async function logout() {
    try { await request('/auth/logout', { method: 'POST' }); } catch (_) {}
    me = null; window.IT_AUTH_USER = null; showLogin();
  }

  async function init() {
    try { const data = await request('/auth/me'); syncUser(data.user); }
    catch (_) { showLogin(); }
  }

  document.addEventListener('click', e => {
    const item = e.target.closest('[data-user-menu]');
    if (!item) return;
    if (item.dataset.userMenu === 'logout') logout();
    if (item.dataset.userMenu === 'profile') window.location.hash = '#profile';
    if (item.dataset.userMenu === 'password') window.location.hash = '#profile';
  });

  window.IT_AUTH = { request, logout, getUser: () => me, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
