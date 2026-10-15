(function () {
  const shell = () => document.querySelector('.app-shell');
  const api = () => window.IT_AUTH;
  const style = document.createElement('style');
  style.textContent = `
    .app-shell { visibility: hidden; }
    #itLoginOverlay { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 24px; background: radial-gradient(ellipse at top left, rgba(35,115,145,.25), transparent 48%), var(--bs-body-bg, #101923); color: var(--bs-body-color, #f2f5f8); }
    #itLoginOverlay .login-card { width: min(100%, 440px); padding: clamp(24px, 5vw, 38px); border: 1px solid var(--bs-border-color, #394552); border-radius: 18px; background: var(--bs-tertiary-bg, #17222d); box-shadow: 0 24px 70px rgba(0,0,0,.24); }
    #itLoginOverlay .login-brand { display:flex; align-items:center; gap:12px; margin-bottom:28px; }
    #itLoginOverlay .login-brand-mark { width:48px;height:48px;border-radius:13px;display:grid;place-items:center;background:#126b83;color:white;font-weight:800;font-size:24px; }
    #itLoginOverlay .login-brand small { display:block; letter-spacing:.16em; opacity:.7; font-size:11px; }
    #itLoginOverlay .form-control { min-height:46px; }
    #itLoginOverlay .btn { min-height:44px; }
    #itLoginOverlay .login-error { display:none; }
    #itLoginOverlay .login-error.show { display:block; }
    #itLoginOverlay .login-ad { width:100%; }
  `;
  document.head.appendChild(style);
  const app = shell();
  if (app) app.style.visibility = 'hidden';

  function translateError(error) {
    const map = {
      invalid_credentials: 'Kullanıcı adı veya parola hatalı.',
      username_and_password_required: 'Kullanıcı adı ve parola girin.',
      ad_login_unavailable: 'Active Directory girişi henüz etkinleştirilmedi.',
      authentication_required: 'Devam etmek için giriş yapın.',
      ad_connection_must_pass_test_before_enable: 'Önce Active Directory bağlantı testini başarıyla tamamlayın.',
      ad_bind_credentials_required_before_enable: 'Etkinleştirmek için Bind kullanıcı hesabı ve parolası gerekli.'
    };
    return map[error] || error || 'Giriş yapılamadı. Bilgilerinizi kontrol edip tekrar deneyin.';
  }

  function mount() {
    if (document.getElementById('itLoginOverlay')) return;
    const overlay = document.createElement('section');
    overlay.id = 'itLoginOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'itLoginTitle');
    overlay.innerHTML = `
      <div class="login-card">
        <div class="login-brand">
          <div class="login-brand-mark">B</div>
          <div><strong>BAYLAN</strong><small>IT MANAGER</small></div>
        </div>
        <h1 id="itLoginTitle" class="h3 mb-2">Güvenli giriş</h1>
        <p class="text-secondary mb-4">IT varlık ve stok yönetim sistemine devam etmek için giriş yapın.</p>
        <form id="itLoginForm" autocomplete="on">
          <div class="mb-3"><label for="itLoginUsername" class="form-label">Kullanıcı adı veya e-posta</label><input id="itLoginUsername" name="username" class="form-control" autocomplete="username" required autofocus></div>
          <div class="mb-3"><label for="itLoginPassword" class="form-label">Parola</label><input id="itLoginPassword" name="password" type="password" class="form-control" autocomplete="current-password" required></div>
          <div id="itLoginError" class="alert alert-danger login-error" role="alert"></div>
          <button type="submit" id="itLocalLogin" class="btn btn-primary w-100">Kullanıcı adı ile giriş</button>
          <div class="d-flex align-items-center gap-3 my-3"><div class="border-top flex-grow-1"></div><span class="small text-secondary">veya</span><div class="border-top flex-grow-1"></div></div>
          <button type="button" id="itAdLogin" class="btn btn-outline-info login-ad" disabled>Active Directory ile giriş</button>
          <p id="itAdStatus" class="small text-secondary mt-2 mb-0">Active Directory durumu kontrol ediliyor…</p>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    const form = overlay.querySelector('#itLoginForm');
    const errorBox = overlay.querySelector('#itLoginError');
    const localButton = overlay.querySelector('#itLocalLogin');
    const adButton = overlay.querySelector('#itAdLogin');
    const adStatus = overlay.querySelector('#itAdStatus');
    const username = overlay.querySelector('#itLoginUsername');
    const password = overlay.querySelector('#itLoginPassword');

    const showError = message => {
      errorBox.textContent = message;
      errorBox.classList.add('show');
    };
    const doLogin = async provider => {
      errorBox.textContent = '';
      errorBox.classList.remove('show');
      if (!username.value.trim() || !password.value) {
        showError('Kullanıcı adı ve parola girin.');
        return;
      }
      localButton.disabled = true;
      adButton.disabled = true;
      localButton.textContent = 'Kontrol ediliyor…';
      try {
        await api().login(username.value.trim(), password.value, provider);
        overlay.remove();
        if (app) app.style.visibility = 'visible';
        window.location.reload();
      } catch (err) {
        showError(translateError(err.message));
      } finally {
        localButton.disabled = false;
        localButton.textContent = 'Kullanıcı adı ile giriş';
        try {
          const status = await api().request('/auth/ad-status');
          adButton.disabled = !status.available;
        } catch (_) {
          adButton.disabled = true;
        }
      }
    };
    form.addEventListener('submit', event => { event.preventDefault(); doLogin('local'); });
    adButton.addEventListener('click', () => doLogin('ad'));
    api().request('/auth/ad-status').then(status => {
      adButton.disabled = !status.available;
      adStatus.textContent = status.available
        ? 'Baylan Active Directory bağlantısı doğrulandı.'
        : 'Active Directory girişi henüz doğrulanıp etkinleştirilmedi.';
    }).catch(() => {
      adButton.disabled = true;
      adStatus.textContent = 'Active Directory durumu alınamadı; yerel giriş kullanılabilir.';
    });
    username.focus();
  }

  async function start() {
    try {
      const authenticated = await api().init();
      if (authenticated) {
        if (app) app.style.visibility = 'visible';
        return;
      }
    } catch (_) {}
    mount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();