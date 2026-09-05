/* Baylan IT Manager - requested module forms and admin UI */
(() => {
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]));
  const invTypes = ['Laptop','Masaüstü Bilgisayar','Monitör','Yazıcı','El Terminali','Telefon','Kamera','Sunucu','Network Cihazı','Diğer'];
  const stockTypes = ['Mouse','Klavye','HDMI Kablo','Network Kablo','Adaptör','Toner','Batarya','Kulaklık','USB Bellek','Temizlik Malzemesi','Yedek Parça','USB Bellek','Diğer'];
  const licenseTypes = ['Windows','Office','Microsoft 365','Adobe','AutoCAD','Antivirus','VPN','Diğer'];
  const getStore = (k, fallback) => { try { return JSON.parse(localStorage.getItem('itmanager_'+k)) || fallback; } catch { return fallback; } };
  const setStore = (k,v) => localStorage.setItem('itmanager_'+k, JSON.stringify(v));

  const defs = {
    inventory: [
      ['Envanter No','text'],['Bilgisayar Adı','text'],['Fabrika','select',['Merkez','Fabrika 1','Fabrika 2']],['Departman','text'],
      ['Donanım Tipi','select',invTypes],['Sorumlu Personel','text'],['Marka','text'],['Model','text'],['Seri No','text'],['IFS No','text'],['Açıklama','textarea']
    ],
    licenses: [['Lisans Adı','text'],['Lisans Anahtarı','text'],['E-posta','email'],['Şifre','password'],['Not','textarea']],
    stock: [['Donanım Tipi','select',stockTypes],['Marka','text'],['Model','text'],['Miktar','number'],['Not','textarea']],
    knowledge: [['Başlık','text'],['Kategori','select',['Windows','Office','Microsoft 365','Adobe','Ağ / Network','Sunucu','Yazıcı','Güvenlik','Donanım','Diğer']],['İçerik','textarea'],['Ek Dosyalar','file']],
  };

  function renderFields(list) {
    return '<div class="row g-3">' + list.map((f,i) => {
      const [label,type,options] = f, wide = type === 'textarea' || type === 'file';
      const cls = wide ? 'col-12' : 'col-md-6';
      if (type === 'select') return `<div class="${cls}"><label class="form-label">${esc(label)}</label><select class="form-select" name="${esc(label)}" ${label==='Donanım Tipi'?'data-request-device-type':''}><option value="">Seçiniz</option>${options.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select></div>`;
      if (type === 'textarea') return `<div class="${cls}"><label class="form-label">${esc(label)}</label><textarea class="form-control" rows="4" name="${esc(label)}" placeholder="${esc(label)}"></textarea></div>`;
      if (type === 'file') return `<div class="${cls}"><label class="form-label">Ek Dosyalar</label><input class="form-control" type="file" name="attachments" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"><div class="form-text">Fotoğraf, PDF, DOC/DOCX, XLS/XLSX veya TXT. Birden fazla dosya seçebilirsiniz.</div></div>`;
      return `<div class="${cls}"><label class="form-label">${esc(label)}</label><input class="form-control" type="${esc(type)}" name="${esc(label)}" placeholder="${esc(label)}"></div>`;
    }).join('') + '</div>';
  }

  function requestForm() {
    const all = [...invTypes,...stockTypes,...licenseTypes].filter((x,i,a)=>a.indexOf(x)===i);
    return `<form id="itDynamicForm" data-form-page="requests"><div class="row g-3">
      <div class="col-md-6"><label class="form-label">Sipariş No</label><input class="form-control" name="Sipariş No" placeholder="Sipariş No"></div>
      <div class="col-md-6"><label class="form-label">Talep Sahibi</label><input class="form-control" name="Talep Sahibi" value="IT Manager" readonly></div>
      <div class="col-md-6"><label class="form-label">Ürün Tipi</label><select class="form-select" id="requestProductType" name="Ürün Tipi"><option value="">Seçiniz</option><option value="Envanter">Envanter</option><option value="Lisans">Lisans</option><option value="Stok">Stok</option></select></div>
      <div class="col-md-6"><label class="form-label">Donanım Tipi</label><select class="form-select" id="requestDeviceType" name="Donanım Tipi"><option value="">Önce ürün tipini seçiniz</option></select></div>
      <div class="col-md-6"><label class="form-label">Miktar</label><input class="form-control" type="number" min="1" value="1" name="Miktar"></div>
      <div class="col-md-6"><label class="form-label">Marka</label><input class="form-control" name="Marka" placeholder="Marka"></div>
      <div class="col-md-6"><label class="form-label">Model</label><input class="form-control" name="Model" placeholder="Model"></div>
      <div class="col-12"><label class="form-label">Açıklama</label><textarea class="form-control" rows="3" name="Açıklama" placeholder="Açıklama"></textarea></div>
    </div><div class="mt-4 d-flex justify-content-start"><button type="button" class="btn btn-outline-primary" id="addRequestRow"><i class="ti ti-plus me-1"></i>Satır Ekle</button></div><div id="requestExtraRows" class="mt-3"></div></form>`;
  }

  window.IT_FORM_RENDER = (page) => page === 'requests' ? requestForm() : `<form id="itDynamicForm" data-form-page="${esc(page)}">${renderFields(defs[page] || [])}</form>`;

  function openForm(page,title) {
    if (!window.ITUI) return;
    ITUI.modal(title, IT_FORM_RENDER(page), {size: page==='inventory'?'modal-xl':'modal-lg'});
  }

  function updateRequestTypes(value) {
    const select = document.querySelector('#requestDeviceType'); if (!select) return;
    const data = value==='Envanter' ? invTypes : value==='Stok' ? stockTypes : value==='Lisans' ? licenseTypes : [];
    select.innerHTML = '<option value="">Seçiniz</option>' + data.map(x=>`<option>${esc(x)}</option>`).join('');
  }

  function setupAdminMenu() {
    const admin = document.querySelector('.sidebar .nav-link[data-page="admin"]'); if (!admin || document.querySelector('#adminSubmenu')) return;
    const box = document.createElement('div'); box.id='adminSubmenu'; box.className='admin-submenu'; box.hidden=true;
    box.innerHTML = `<button type="button" data-admin-view="users"><i class="ti ti-users"></i><span>Kullanıcılar</span></button><button type="button" data-admin-view="products"><i class="ti ti-database-plus"></i><span>Ürün Ekle</span></button><button type="button" data-admin-view="connections"><i class="ti ti-plug-connected"></i><span>Bağlantılar</span></button><button type="button" data-admin-view="data"><i class="ti ti-database-export"></i><span>Veriler</span></button>`;
    admin.insertAdjacentElement('afterend',box);
    admin.addEventListener('click',e=>{e.preventDefault();box.hidden=!box.hidden;});
  }

  function adminView(type) {
    const content=document.querySelector('#pageContent'); if(!content) return;
    document.querySelectorAll('.sidebar .nav-link').forEach(x=>x.classList.remove('active')); document.querySelector('.sidebar .nav-link[data-page="admin"]')?.classList.add('active');
    const views={
      users:`<div class="page-head"><div><h1>Kullanıcılar</h1><p>Sistem kullanıcıları, roller ve erişim durumları.</p></div><div class="page-actions"><button class="btn btn-primary" data-admin-add-user><i class="ti ti-plus me-1"></i>Kullanıcı Ekle</button></div></div>${adminPanelUsers()}`,
      products:`<div class="page-head"><div><h1>Ürün Ekle</h1><p>Envanter, lisans ve stok modüllerinde kullanılacak ana verileri yönetin.</p></div></div>${adminPanelProducts()}`,
      connections:`<div class="page-head"><div><h1>Bağlantılar</h1><p>SNMP, LDAP/AD, SMTP ve diğer sistem bağlantılarını yönetin.</p></div></div>${adminPanelConnections()}`,
      data:`<div class="page-head"><div><h1>Veriler</h1><p>PostgreSQL yedekleme ve geri yükleme işlemleri.</p></div></div>${adminPanelData()}`
    };
    content.innerHTML=views[type]||views.users;
    document.querySelector('#crumb').textContent=type==='users'?'Kullanıcılar':type==='products'?'Ürün Ekle':type==='connections'?'Bağlantılar':'Veriler';
  }

  function adminPanelUsers(){
    const users=getStore('users',[{name:'IT Manager',email:'it@baylan.com',role:'Sistem Yöneticisi',status:'Aktif'}]);
    return `<div class="panel"><div class="table-responsive"><table class="table align-middle"><thead><tr><th>AD SOYAD</th><th>E-POSTA</th><th>ROL</th><th>DURUM</th><th>İŞLEM</th></tr></thead><tbody>${users.map((u,i)=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td><span class="status success">${esc(u.status)}</span></td><td><button class="btn btn-sm btn-light" data-user-delete="${i}"><i class="ti ti-trash"></i></button></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function adminPanelProducts(){
    const data=getStore('masterData',{Envanter:{'Donanım Tipi':invTypes,Marka:['Dell','HP','Lenovo','Asus','Acer','Canon','Kyocera','Xerox','Hikvision','Aruba','Samsung','Zebra'],Model:[]},Lisans:{Kategori:licenseTypes,Marka:[],Model:[]},Stok:{'Donanım Tipi':stockTypes,Marka:[],Model:[]}});
    return `<div class="row g-3">${Object.entries(data).map(([module,groups])=>`<div class="col-xl-4"><div class="panel"><div class="panel-head"><div><h3>${esc(module)}</h3><p>Tanım / ana veri</p></div></div>${Object.entries(groups).map(([group,items])=>`<div class="mb-4"><label class="form-label fw-bold">${esc(group)}</label><div class="input-group mb-2"><input class="form-control" id="master-${module}-${group}" placeholder="Yeni ${esc(group)}"><button class="btn btn-primary" data-master-add data-module="${esc(module)}" data-group="${esc(group)}">Ekle</button></div><div class="d-flex flex-wrap gap-2">${items.map((x,i)=>`<span class="badge rounded-pill text-bg-secondary d-inline-flex align-items-center gap-1">${esc(x)} <button type="button" class="btn btn-sm p-0 text-white" data-master-delete data-module="${esc(module)}" data-group="${esc(group)}" data-index="${i}">×</button></span>`).join('')}</div></div>`).join('')}</div></div>`).join('')}</div>`;
  }
  function adminPanelConnections(){
    const c=getStore('connections',{SNMP:{host:'',port:'161',community:'public'},LDAP:{host:'',port:'389',base:'',username:''},SMTP:{host:'',port:'587',username:''}});
    return `<div class="row g-3">${Object.entries(c).map(([name,v])=>`<div class="col-xl-4"><div class="panel"><div class="panel-head"><div><h3>${name}</h3><p>Bağlantı ayarları</p></div></div><label class="form-label">Sunucu / Host</label><input class="form-control mb-2" data-conn="${name}" data-key="host" value="${esc(v.host)}"><label class="form-label">Port</label><input class="form-control mb-2" data-conn="${name}" data-key="port" value="${esc(v.port)}"><label class="form-label">${name==='SNMP'?'Community':name==='LDAP'?'Base DN':'Kullanıcı Adı'}</label><input class="form-control mb-3" data-conn="${name}" data-key="${name==='SNMP'?'community':name==='LDAP'?'base':'username'}" value="${esc(v[name==='SNMP'?'community':name==='LDAP'?'base':'username'])}"><button class="btn btn-primary w-100" data-connection-save="${name}">Kaydet</button></div></div>`).join('')}</div>`;
  }
  function adminPanelData(){
    return `<div class="row g-3"><div class="col-xl-6"><div class="panel"><div class="panel-head"><div><h3>PostgreSQL Yedek</h3><p>Backend bağlantısı hazır olduğunda gerçek pg_dump çalıştırılır.</p></div></div><button class="btn btn-primary" id="backupDatabase"><i class="ti ti-database-export me-1"></i>Yedek Al</button></div></div><div class="col-xl-6"><div class="panel"><div class="panel-head"><div><h3>Yedekten Geri Yükle</h3><p>PostgreSQL yedek dosyasını seçin.</p></div></div><input type="file" class="form-control mb-3" id="restoreFile" accept=".sql,.dump,.backup"><button class="btn btn-outline-primary" id="restoreDatabase"><i class="ti ti-database-import me-1"></i>Geri Yükle</button></div></div></div>`;
  }

  function setupUserMenu(){
    const old=document.querySelector('.sidebar-user'), top=document.querySelector('.top-actions'); if(!old||!top||document.querySelector('#topUserMenu')) return;
    const wrap=document.createElement('div'); wrap.className='top-user-wrap'; wrap.innerHTML=`<button class="top-user-btn" type="button" id="topUserBtn"><span class="avatar">KC</span><span><strong>IT Manager</strong><small>Sistem Yöneticisi</small></span><i class="ti ti-chevron-down"></i></button><div id="topUserMenu" class="top-user-menu" hidden><button data-user-action="profile"><i class="ti ti-user"></i>Profil</button><button data-user-action="password"><i class="ti ti-lock"></i>Şifre Değiştir</button><button data-user-action="logout"><i class="ti ti-logout"></i>Çıkış</button></div>`;
    top.appendChild(wrap); old.style.display='none';
  }

  document.addEventListener('click',e=>{
    const add=e.target.closest('[data-page-action]'); if(add){ const p=add.dataset.pageAction; const titles={inventory:'Yeni Envanter',licenses:'Yeni Lisans',stock:'Stok Girişi',requests:'Yeni Satın Alma Talebi',knowledge:'Yeni Bilgi'}; if(defs[p]||p==='requests') openForm(p,titles[p]); return; }
    const product=e.target.closest('#requestProductType'); if(product) updateRequestTypes(product.value);
    const row=e.target.closest('#addRequestRow'); if(row){ const box=document.querySelector('#requestExtraRows'); if(box){const n=box.children.length+2; box.insertAdjacentHTML('beforeend',`<div class="request-extra-row row g-2 align-items-end mb-2"><div class="col-md-3"><label class="form-label">Ürün ${n}</label><input class="form-control" placeholder="Donanım / Malzeme"></div><div class="col-md-2"><label class="form-label">Miktar</label><input class="form-control" type="number" min="1" value="1"></div><div class="col-md-2"><label class="form-label">Marka</label><input class="form-control" placeholder="Marka"></div><div class="col-md-2"><label class="form-label">Model</label><input class="form-control" placeholder="Model"></div><div class="col-md-2"><label class="form-label">Açıklama</label><input class="form-control" placeholder="Açıklama"></div><div class="col-md-1"><button type="button" class="btn btn-outline-danger w-100 remove-request-row"><i class="ti ti-trash"></i></button></div></div>`);} return; }
    const rm=e.target.closest('.remove-request-row'); if(rm){rm.closest('.request-extra-row')?.remove();return;}
    const av=e.target.closest('[data-admin-view]'); if(av){adminView(av.dataset.adminView);return;}
    if(e.target.closest('#topUserBtn')){const m=document.querySelector('#topUserMenu');if(m)m.hidden=!m.hidden;return;}
    const ua=e.target.closest('[data-user-action]'); if(ua){document.querySelector('#topUserMenu').hidden=true;if(ua.dataset.userAction==='profile') location.hash='#profile'; if(ua.dataset.userAction==='password'&&window.ITUI)ITUI.modal('Şifre Değiştir','<div class="row g-3"><div class="col-12"><label class="form-label">Mevcut Şifre</label><input class="form-control" type="password"></div><div class="col-md-6"><label class="form-label">Yeni Şifre</label><input class="form-control" type="password"></div><div class="col-md-6"><label class="form-label">Yeni Şifre Tekrar</label><input class="form-control" type="password"></div></div>'); if(ua.dataset.userAction==='logout') alert('Çıkış işlemi backend/auth bağlantısı tamamlandığında aktif olacaktır.');return;}
    const masterAdd=e.target.closest('[data-master-add]'); if(masterAdd){const module=masterAdd.dataset.module,group=masterAdd.dataset.group,data=getStore('masterData',{}),input=document.querySelector(`#master-${CSS.escape(module)}-${CSS.escape(group)}`);if(input?.value.trim()){data[module]=data[module]||{};data[module][group]=data[module][group]||[];data[module][group].push(input.value.trim());setStore('masterData',data);adminView('products');}return;}
    const masterDel=e.target.closest('[data-master-delete]'); if(masterDel){const data=getStore('masterData',{}),a=data[masterDel.dataset.module]?.[masterDel.dataset.group];if(a){a.splice(Number(masterDel.dataset.index),1);setStore('masterData',data);adminView('products');}return;}
    const conn=e.target.closest('[data-connection-save]'); if(conn){const name=conn.dataset.connectionSave,data=getStore('connections',{});data[name]=data[name]||{};document.querySelectorAll(`[data-conn="${CSS.escape(name)}"]`).forEach(x=>data[name][x.dataset.key]=x.value);setStore('connections',data);alert(`${name} ayarları kaydedildi. Backend bağlantısı ayrıca test edilecektir.`);return;}
    if(e.target.closest('#backupDatabase')){const data={exportedAt:new Date().toISOString(),note:'Frontend demo export; gerçek PostgreSQL pg_dump backend ile çalışacaktır.',masterData:getStore('masterData',{})};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='itmanager-backup.json';a.click();URL.revokeObjectURL(a.href);return;}
    if(e.target.closest('#restoreDatabase')){const f=document.querySelector('#restoreFile')?.files?.[0];if(!f){alert('Önce bir yedek dosyası seçin.');return;}alert('Dosya alındı. Gerçek PostgreSQL geri yükleme işlemi backend ile yapılacaktır.');return;}
    const del=e.target.closest('[data-user-delete]');if(del){const users=getStore('users',[]);users.splice(Number(del.dataset.userDelete),1);setStore('users',users);adminView('users');return;}
    if(e.target.closest('[data-admin-add-user]')&&window.ITUI){ITUI.modal('Kullanıcı Ekle','<form><div class="row g-3"><div class="col-md-6"><label class="form-label">Ad Soyad</label><input class="form-control"></div><div class="col-md-6"><label class="form-label">E-posta</label><input class="form-control" type="email"></div><div class="col-md-6"><label class="form-label">Rol</label><select class="form-select"><option>Sistem Yöneticisi</option><option>IT Uzmanı</option><option>Salt Okunur</option></select></div><div class="col-md-6"><label class="form-label">Durum</label><select class="form-select"><option>Aktif</option><option>Pasif</option></select></div></div></form>');return;}
  });

  // Existing navigation buttons have text rather than a stable data attribute; bridge them into the modal system.
  document.addEventListener('click',e=>{
    const b=e.target.closest('.page-actions .btn'); if(!b)return; const t=b.textContent.trim(); const map={'Yeni Envanter':'inventory','Yeni Lisans':'licenses','Stok Girişi':'stock','Yeni Talep':'requests','Yeni Satın Alma Talebi':'requests','Yeni Makale':'knowledge','Yeni Bilgi':'knowledge'}; const p=map[t]; if(p){e.preventDefault();e.stopPropagation();openForm(p,t);}
  },true);

  document.addEventListener('DOMContentLoaded',()=>{setupAdminMenu();setupUserMenu();});
})();