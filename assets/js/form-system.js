(() => {
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]));
  const field = (label, type='text', options=[]) => ({label,type,options});

  window.IT_FORM_DEFS = {
    inventory: [field('Envanter No'),field('Bilgisayar Adı'),field('Fabrika','select',['Merkez','Fabrika 1','Fabrika 2']),field('Departman'),field('Donanım Tipi','select',['Laptop','Masaüstü Bilgisayar','Monitör','Yazıcı','El Terminali','Telefon','Kamera','Sunucu','Network Cihazı','Diğer']),field('Sorumlu Personel'),field('Marka'),field('Model'),field('Seri No'),field('IFS No'),field('Açıklama','textarea')],
    licenses: [field('Lisans Adı'),field('Lisans Anahtarı'),field('E-posta','email'),field('Şifre','password'),field('Not','textarea')],
    stock: [field('Donanım Tipi','select',['Mouse','Klavye','HDMI Kablo','Network Kablo','Adaptör','Toner','Batarya','Kulaklık','USB Bellek','Diğer']),field('Marka'),field('Model'),field('Miktar','number'),field('Not','textarea')],
    requests: [field('Sipariş No'),field('Talep Sahibi','current-user'),field('Ürün Tipi','select',['Envanter','Lisans','Stok']),field('Donanım Tipi','select',['Laptop','Masaüstü Bilgisayar','Monitör','Yazıcı','El Terminali','Telefon','Kamera','Sunucu','Network Cihazı','Mouse','Klavye','Kablo','Toner','Adaptör','Diğer']),field('Miktar','number'),field('Marka'),field('Model'),field('Açıklama','textarea')],
    knowledge: [field('Başlık'),field('Kategori','select',['Windows','Office','Microsoft 365','Adobe','Ağ / Network','Sunucu','Yazıcı','Güvenlik','Donanım','Diğer']),field('İçerik','textarea'),field('Ek Dosyalar','file','Fotoğraf, PDF, DOCX vb.')]
  };

  window.IT_FORM_RENDER = function(page, title) {
    const defs = window.IT_FORM_DEFS[page] || [];
    const html = '<form id="itDynamicForm"><div class="row g-3">' + defs.map((f,i) => {
      const wide = f.type === 'textarea' || f.type === 'file';
      const cls = wide ? 'col-12' : 'col-md-6';
      if (f.type === 'select') return `<div class="${cls}"><label class="form-label">${esc(f.label)}</label><select class="form-select" name="${esc(f.label)}"><option value="">Seçiniz</option>${f.options.map(o=>`<option>${esc(o)}</option>`).join('')}</select></div>`;
      if (f.type === 'textarea') return `<div class="${cls}"><label class="form-label">${esc(f.label)}</label><textarea class="form-control" rows="4" name="${esc(f.label)}" placeholder="${esc(f.label)}"></textarea></div>`;
      if (f.type === 'file') return `<div class="${cls}"><label class="form-label">${esc(f.label)}</label><input class="form-control" type="file" name="attachments" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"><div class="form-text">${esc(f.options || 'Birden fazla dosya seçebilirsiniz.')}</div></div>`;
      if (f.type === 'current-user') return `<div class="${cls}"><label class="form-label">${esc(f.label)}</label><input class="form-control" name="${esc(f.label)}" value="IT Manager" readonly></div>`;
      return `<div class="${cls}"><label class="form-label">${esc(f.label)}</label><input class="form-control" type="${esc(f.type)}" name="${esc(f.label)}" placeholder="${esc(f.label)}"></div>`;
    }).join('') + '</div>' + (page === 'requests' ? `<div class="mt-4 d-flex justify-content-start"><button type="button" class="btn btn-outline-primary" id="addRequestRow"><i class="ti ti-plus me-1"></i>Satır Ekle</button></div><div id="requestExtraRows" class="mt-3"></div>` : '') + '</form>';
    return html;
  };

  document.addEventListener('click', e => {
    const addRow = e.target.closest('#addRequestRow');
    if (!addRow) return;
    const box = document.querySelector('#requestExtraRows');
    if (!box) return;
    const n = box.children.length + 2;
    box.insertAdjacentHTML('beforeend', `<div class="request-extra-row row g-2 align-items-end mb-2"><div class="col-md-3"><label class="form-label">Ürün ${n}</label><input class="form-control" placeholder="Donanım / Malzeme"></div><div class="col-md-2"><label class="form-label">Miktar</label><input class="form-control" type="number" min="1" value="1"></div><div class="col-md-2"><label class="form-label">Marka</label><input class="form-control"></div><div class="col-md-2"><label class="form-label">Model</label><input class="form-control"></div><div class="col-md-2"><label class="form-label">Açıklama</label><input class="form-control"></div><div class="col-md-1"><button type="button" class="btn btn-outline-danger w-100 remove-request-row"><i class="ti ti-trash"></i></button></div></div>`);
  });

  document.addEventListener('click', e => {
    const rm = e.target.closest('.remove-request-row');
    if (rm) rm.closest('.request-extra-row')?.remove();
  });

  function setupAdminMenu() {
    const admin = document.querySelector('.sidebar .nav-link[data-page="admin"]');
    if (!admin || document.querySelector('#adminSubmenu')) return;
    const box = document.createElement('div');
    box.id = 'adminSubmenu'; box.className = 'admin-submenu'; box.hidden = true;
    box.innerHTML = `<button type="button" data-admin-view="users"><i class="ti ti-users"></i>Kullanıcılar</button><button type="button" data-admin-view="products"><i class="ti ti-database-plus"></i>Ürün Ekle</button><button type="button" data-admin-view="connections"><i class="ti ti-plug-connected"></i>Bağlantılar</button><button type="button" data-admin-view="data"><i class="ti ti-database-export"></i>Veriler</button>`;
    admin.insertAdjacentElement('afterend', box);
    admin.addEventListener('click', e => { e.preventDefault(); box.hidden = !box.hidden; });
  }

  function setupUserMenu() {
    const user = document.querySelector('.sidebar-user');
    const top = document.querySelector('.top-actions');
    if (!user || !top || document.querySelector('#topUserMenu')) return;
    const wrap = document.createElement('div'); wrap.className = 'top-user-wrap';
    wrap.innerHTML = `<button class="top-user-btn" type="button" id="topUserBtn"><span class="avatar">KC</span><span><strong>IT Manager</strong><small>Sistem Yöneticisi</small></span><i class="ti ti-chevron-down"></i></button><div id="topUserMenu" class="top-user-menu" hidden><button data-user-action="profile"><i class="ti ti-user"></i>Profil</button><button data-user-action="password"><i class="ti ti-lock"></i>Şifre Değiştir</button><button data-user-action="logout"><i class="ti ti-logout"></i>Çıkış</button></div>`;
    top.appendChild(wrap); user.style.display='none';
  }

  document.addEventListener('click', e => {
    if (e.target.closest('#topUserBtn')) { const m=document.querySelector('#topUserMenu'); if(m)m.hidden=!m.hidden; return; }
    const a=e.target.closest('[data-user-action]');
    if(a){ document.querySelector('#topUserMenu').hidden=true; if(a.dataset.userAction==='password' && window.ITUI) ITUI.modal('Şifre Değiştir','<div class="row g-3"><div class="col-12"><label class="form-label">Mevcut Şifre</label><input class="form-control" type="password"></div><div class="col-md-6"><label class="form-label">Yeni Şifre</label><input class="form-control" type="password"></div><div class="col-md-6"><label class="form-label">Yeni Şifre Tekrar</label><input class="form-control" type="password"></div></div>',{size:'modal-md'}); }
    if(a?.dataset.userAction==='logout') alert('Çıkış işlemi backend bağlantısı eklendiğinde aktif olacaktır.');
  });

  document.addEventListener('DOMContentLoaded', () => { setupAdminMenu(); setupUserMenu(); });
})();