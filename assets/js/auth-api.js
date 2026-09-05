(function () {
  const API = '/api';
  let me = { username: 'admin', role: { name: 'Yönetici' } };

  async function request(url, options = {}) {
    const res = await fetch(API + url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data.detail || data.error || 'İşlem başarısız.');
    return data;
  }

  function initials(name) { return String(name || 'IT').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'IT'; }

  function syncUser(user) {
    me = user || me;
    const btn = document.getElementById('topUserBtn');
    if (!btn) return;
    const spans = btn.querySelectorAll('span');
    const avatar = btn.querySelector('.avatar');
    if (avatar) avatar.textContent = initials(me.personnel?.name || me.username);
    if (spans[1]) {
      const strong = spans[1].querySelector('strong');
      const small = spans[1].querySelector('small');
      if (strong) strong.textContent = me.personnel?.name || me.username || 'Yönetici';
      if (small) small.textContent = me.role?.name || 'Yönetici';
    }
    window.IT_AUTH_USER = me;
    window.dispatchEvent(new CustomEvent('itmanager:auth', { detail: me }));
  }

  // Geçici test modu: giriş ekranı devre dışı. Güvenlik/yetkilendirme son aşamada yeniden aktif edilecek.
  async function init() {
    syncUser(me);
  }

  async function logout() {
    me = { username: 'admin', role: { name: 'Yönetici' } };
    window.IT_AUTH_USER = me;
    window.location.hash = '#dashboard';
    window.location.reload();
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
