(function () {
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  const can=k=>(window.IT_AUTH_USER?.permissions||[]).includes(k);
  const shell=(t,s,b)=>`<div class="page-header"><div><h1>${esc(t)}</h1><p>${esc(s)}</p></div></div><div class="card border-0 shadow-sm"><div class="card-body">${b}</div></div>`;
  const req=(p,o)=>window.IT_AUTH.request(p,o);
  async function usersView(root){
    if(!can('users.manage')){root.innerHTML=shell('Yetkisiz','Bu bölümü görüntülemek için erişiminiz bulunmuyor.','<div class="alert alert-danger mb-0">users.manage yetkisi gerekli.</div>');return;}
    const [{items:users},{items:roles},personnelData]=await Promise.all([req('/users'),req('/roles'),req('/personnel?per_page=100')]);
    const personnel=personnelData.items||[];
    root.innerHTML=shell('Kullanıcılar','Sistem kullanıcılarını, rollerini, personel bağlantılarını ve erişim durumlarını yönetin.',`
      <div class="d-flex justify-content-between gap-2 mb-3">
        <div class="input-group" style="max-width:380px"><span class="input-group-text"><i class="ti ti-search"></i></span><input id="adminUserSearch" class="form-control" placeholder="Kullanıcı, e-posta veya personel"></div>
        <button id="addUserBtn" class="btn btn-primary"><i class="ti ti-plus me-1"></i>Kullanıcı Ekle</button>
      </div>
      <div class="table-responsive"><table class="table table-dark table-hover align-middle mb-0"><thead><tr><th>Kullanıcı</th><th>Personel</th><th>E-posta</th><th>Rol</th><th>Durum</th><th>Son Giriş</th><th class="text-end">İşlem</th></tr></thead><tbody id="adminUsersBody">${userRows(users)}</tbody></table></div>`);
    const body=root.querySelector('#adminUsersBody');
    root.querySelector('#adminUserSearch').oninput=e=>{const q=e.target.value.toLowerCase();body.innerHTML=userRows(users.filter(u=>`${u.username} ${u.email||''} ${u.personnel?.name||''}`.toLowerCase().includes(q)));};
    root.querySelector('#addUserBtn').onclick=()=>userModal(roles,personnel);
    body.onclick=async e=>{const b=e.target.closest('[data-user-edit],[data-user-detail],[data-user-toggle]');if(!b)return;try{if(b.dataset.userDetail)return userDetailModal(users.find(u=>String(u.id)===b.dataset.userDetail));if(b.dataset.userEdit)return userModal(roles,personnel,users.find(u=>String(u.id)===b.dataset.userEdit));await req(`/users/${b.dataset.userToggle}/toggle`,{method:'POST'});usersView(root);}catch(err){alert(err.message);}};
  }
  function userRows(users){return users.map(u=>`<tr><td><strong>${esc(u.username)}</strong></td><td>${esc(u.personnel?.name||'-')}</td><td>${esc(u.email||'-')}</td><td>${esc(u.role?.name||'Rol yok')}</td><td><span class="badge ${u.active?'text-bg-success':'text-bg-secondary'}">${u.active?'Aktif':'Pasif'}</span></td><td>${u.last_login_at?new Date(u.last_login_at).toLocaleString('tr-TR'):'-'}</td><td class="text-end"><button class="btn btn-sm btn-outline-primary me-1" data-user-edit="${u.id}"><i class="ti ti-edit"></i></button><button class="btn btn-sm btn-outline-info me-1" data-user-detail="${u.id}" title="Detay"><i class="ti ti-eye"></i></button><button class="btn btn-sm btn-outline-${u.active?'warning':'success'}" data-user-toggle="${u.id}">${u.active?'Pasifleştir':'Aktifleştir'}</button></td></tr>`).join('')||'<tr><td colspan="7" class="text-center text-secondary py-4">Kullanıcı bulunamadı.</td></tr>';}
  function userDetailModal(item){
    if(!item)return;
    const old=document.getElementById("adminUserDetailModal");if(old)old.remove();
    const el=document.createElement("div");el.id="adminUserDetailModal";el.className="modal fade";
    const perms=item.permissions||[];
    el.innerHTML=`<div class="modal-dialog modal-lg"><div class="modal-content bg-dark text-light"><div class="modal-header"><div><h5 class="modal-title">Kullanıcı Detayı</h5><div class="small text-secondary">${esc(item.username)}</div></div><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="row g-3"><div class="col-md-6"><div class="border rounded-3 p-3 h-100"><div class="small text-secondary">Kullanıcı</div><div class="fs-5 fw-semibold">${esc(item.username)}</div><div class="mt-2">${esc(item.email||"E-posta tanımlı değil")}</div></div></div><div class="col-md-6"><div class="border rounded-3 p-3 h-100"><div class="small text-secondary">Personel</div><div class="fs-5 fw-semibold">${esc(item.personnel?.name||"Bağlı personel yok")}</div><div class="mt-2">Rol: ${esc(item.role?.name||"Rol yok")}</div></div></div><div class="col-md-6"><div class="border rounded-3 p-3"><div class="small text-secondary">Hesap Durumu</div><div class="mt-1"><span class="badge ${item.active?"text-bg-success":"text-bg-secondary"}">${item.active?"Aktif":"Pasif"}</span></div><div class="small text-secondary mt-2">Son giriş: ${item.last_login_at?new Date(item.last_login_at).toLocaleString("tr-TR"):"Henüz giriş yapılmadı"}</div></div></div><div class="col-md-6"><div class="border rounded-3 p-3"><div class="small text-secondary">Güvenlik</div><div class="small mt-2">Şifre: <strong>Hash olarak saklanıyor</strong></div><div class="small text-secondary mt-1">Şifre değişimi kullanıcı düzenleme ekranından yapılabilir.</div></div></div><div class="col-12"><div class="border rounded-3 p-3"><div class="small text-secondary mb-2">Rol Yetkileri (${perms.length})</div><div>${perms.map(p=>`<span class="badge text-bg-dark border me-1 mb-1">${esc(p)}</span>`).join("")||"<span class=\"text-secondary\">Tanımlı yetki yok.</span>"}</div></div></div></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Kapat</button><button type="button" class="btn btn-primary" id="detailEditUser">Düzenle</button></div></div></div>`;
    document.body.appendChild(el);const modal=new bootstrap.Modal(el);modal.show();
    el.querySelector("#detailEditUser").onclick=()=>{modal.hide();const root=document.getElementById("pageContent");if(root)usersView(root).then(()=>{const active=document.querySelector(`[data-user-edit="${item.id}"]`);if(active)active.click();});};
    el.addEventListener("hidden.bs.modal",()=>el.remove());
  }
  function userModal(roles,personnel,item=null){
    const old=document.getElementById('adminUserModal');if(old)old.remove();
    const el=document.createElement('div');el.id='adminUserModal';el.className='modal fade';
    const roleOptions=roles.filter(r=>r.active).map(r=>`<option value="${r.id}" ${item?.role?.id===r.id?'selected':''}>${esc(r.name)}</option>`).join('');
    const personOptions='<option value="">Personel seçilmedi</option>'+personnel.filter(p=>p.active||p.id===item?.personnel?.id).map(p=>`<option value="${p.id}" ${item?.personnel?.id===p.id?'selected':''}>${esc(p.employee_no? p.employee_no+' · '+p.name:p.name)}</option>`).join('');
    el.innerHTML=`<div class="modal-dialog modal-lg"><div class="modal-content bg-dark text-light"><form><div class="modal-header"><h5 class="modal-title">${item?'Kullanıcı Düzenle':'Yeni Kullanıcı'}</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="row g-3">
      <div class="col-md-6"><label class="form-label">Kullanıcı Adı</label><input name="username" class="form-control" required value="${esc(item?.username||'')}"></div>
      <div class="col-md-6"><label class="form-label">E-posta</label><input name="email" type="email" class="form-control" value="${esc(item?.email||'')}"></div>
      <div class="col-md-6"><label class="form-label">Personel</label><select name="personnel_id" class="form-select">${personOptions}</select></div>
      <div class="col-md-6"><label class="form-label">Rol</label><select name="role_id" class="form-select"><option value="">Rol seçin</option>${roleOptions}</select></div>
      <div class="col-md-6"><label class="form-label">${item?'Yeni Şifre':'Şifre'}</label><input name="password" type="password" minlength="8" class="form-control" ${item?'placeholder="Değiştirmek istemiyorsanız boş bırakın"':'required'}></div>
      <div class="col-md-6 d-flex align-items-end"><div class="form-check mb-2"><input name="active" type="checkbox" class="form-check-input" ${item?.active!==false?'checked':''}><label class="form-check-label">Hesap aktif</label></div></div>
    </div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary">Kaydet</button></div></form></div></div>`;
    document.body.appendChild(el);const modal=new bootstrap.Modal(el);modal.show();
    el.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;const payload={username:f.username.value,email:f.email.value,personnel_id:f.personnel_id.value?Number(f.personnel_id.value):null,role_id:f.role_id.value?Number(f.role_id.value):null,active:f.active.checked};if(f.password.value)payload.password=f.password.value;try{await req(`/users${item?'/'+item.id:''}`,{method:item?'PATCH':'POST',body:JSON.stringify(payload)});modal.hide();const root=document.getElementById('pageContent');if(root)usersView(root);}catch(err){alert(err.message);}};
    el.addEventListener('hidden.bs.modal',()=>el.remove());
  }

  async function rolesView(root){
    if(!can('roles.manage')){root.innerHTML=shell('Yetkisiz','Rol ve yetki yönetimi için erişiminiz yok.','<div class="alert alert-danger mb-0">roles.manage yetkisi gerekli.</div>');return;}
    const [{items:roles},{items:permissions}]=await Promise.all([req('/roles'),req('/permissions')]);
    root.innerHTML=shell('Roller & Yetkiler','Rolleri, açıklamalarını ve hangi sistem yetkilerine sahip olduklarını yönetin.',
      `<div class="d-flex justify-content-between align-items-center gap-2 mb-3"><div class="text-secondary small">${roles.length} rol · ${permissions.length} tanımlı yetki</div><button id="addRoleBtn" class="btn btn-primary"><i class="ti ti-plus me-1"></i>Yeni Rol</button></div>
      <div class="row g-3">${roles.map(r=>roleCard(r)).join('')||'<div class="col-12"><div class="alert alert-secondary">Henüz rol tanımlanmamış.</div></div>'}</div>
      <hr class="my-4"><h5>Tanımlı Yetkiler</h5><div class="row g-2">${permissions.map(p=>`<div class="col-xl-3 col-lg-4 col-md-6"><div class="border rounded p-2 h-100"><strong class="small">${esc(p.key)}</strong><div class="small mt-1">${esc(p.name||'-')}</div><div class="small text-secondary mt-1">${esc(p.description||'')}</div></div></div>`).join('')||'<div class="col-12 text-secondary">Yetki bulunamadı.</div>'}</div>`);
    root.querySelector('#addRoleBtn').onclick=()=>roleModal(permissions);
    root.querySelectorAll('[data-role-edit]').forEach(b=>b.onclick=()=>roleModal(permissions,roles.find(r=>String(r.id)===b.dataset.roleEdit)));
    root.querySelectorAll('[data-role-toggle]').forEach(b=>b.onclick=async()=>{try{await req('/roles/'+b.dataset.roleToggle,{method:'PATCH',body:JSON.stringify({active:b.dataset.active!=='true'})});rolesView(root);}catch(err){alert(err.message);}});
  }
  function roleCard(r){return `<div class="col-xl-4 col-lg-6"><div class="border rounded-3 p-3 h-100"><div class="d-flex justify-content-between align-items-start gap-2"><div><h5 class="mb-1">${esc(r.name)}</h5><div class="small text-secondary">${esc(r.description||'Açıklama yok')}</div></div><span class="badge ${r.active?'text-bg-success':'text-bg-secondary'}">${r.active?'Aktif':'Pasif'}</span></div><hr><div class="small text-secondary mb-2">Yetkiler (${r.permissions?.length||0})</div><div class="mb-3">${(r.permissions||[]).map(p=>`<span class="badge text-bg-dark border me-1 mb-1">${esc(p)}</span>`).join('')||'<span class="text-secondary small">Yetki yok</span>'}</div><div class="d-flex justify-content-end gap-2"><button class="btn btn-sm btn-outline-primary" data-role-edit="${r.id}"><i class="ti ti-edit me-1"></i>Düzenle</button><button class="btn btn-sm btn-outline-${r.active?'warning':'success'}" data-role-toggle="${r.id}" data-active="${r.active}">${r.active?'Pasifleştir':'Aktifleştir'}</button></div></div></div>`}
  function roleModal(permissions,item=null){
    const old=document.getElementById('adminRoleModal');if(old)old.remove();
    const el=document.createElement('div');el.id='adminRoleModal';el.className='modal fade';
    const selected=new Set(item?.permissions||[]);
    const groups={
      'Kullanıcı Yönetimi':permissions.filter(p=>p.key.startsWith('users.')),
      'Rol & Yetki':permissions.filter(p=>p.key.startsWith('roles.')),
      'Envanter / Varlık':permissions.filter(p=>p.key.startsWith('inventory.')||p.key.startsWith('assets.')),
      'Stok':permissions.filter(p=>p.key.startsWith('stock.')),
      'Lisans':permissions.filter(p=>p.key.startsWith('license.')),
      'Personel':permissions.filter(p=>p.key.startsWith('personnel.')),
      'Bakım / Servis':permissions.filter(p=>p.key.startsWith('maintenance.')),
      'Satın Alma':permissions.filter(p=>p.key.startsWith('request.')||p.key.startsWith('requests.')),
      'Diğer':permissions.filter(p=>!['users.','roles.','inventory.','assets.','stock.','license.','personnel.','maintenance.','request.','requests.'].some(x=>p.key.startsWith(x)))
    };
    const permissionHtml=Object.entries(groups).filter(([,items])=>items.length).map(([name,items])=>`<div class="border rounded-3 p-3 mb-3"><div class="fw-semibold mb-2">${esc(name)}</div><div class="row g-2">${items.map(p=>`<div class="col-md-6"><label class="border rounded p-2 d-flex gap-2 align-items-start h-100"><input class="form-check-input mt-1 role-permission" type="checkbox" value="${p.id}" ${selected.has(p.key)?'checked':''}><span><strong class="small">${esc(p.key)}</strong><span class="d-block small text-secondary">${esc(p.name||p.description||'')}</span></span></label></div>`).join('')}</div></div>`).join('');
    el.innerHTML=`<div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content bg-dark text-light"><form><div class="modal-header"><div><h5 class="modal-title">${item?'Rol Düzenle':'Yeni Rol'}</h5><div class="small text-secondary">Rolün kullanıcı erişim yetkilerini belirleyin.</div></div><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="row g-3 mb-3"><div class="col-md-6"><label class="form-label">Rol Adı</label><input name="name" class="form-control" required value="${esc(item?.name||'')}"></div><div class="col-md-6 d-flex align-items-end"><div class="form-check mb-2"><input name="active" type="checkbox" class="form-check-input" ${item?.active!==false?'checked':''}><label class="form-check-label">Rol aktif</label></div></div><div class="col-12"><label class="form-label">Açıklama</label><input name="description" class="form-control" value="${esc(item?.description||'')}"></div></div><h6 class="mb-3">Yetki Matrisi</h6>${permissionHtml||'<div class="text-secondary">Tanımlı yetki bulunamadı.</div>'}</div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary">Kaydet</button></div></form></div></div>`;
    document.body.appendChild(el);const modal=new bootstrap.Modal(el);modal.show();
    el.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;const permission_ids=[...el.querySelectorAll('.role-permission:checked')].map(x=>Number(x.value));const payload={name:f.name.value.trim(),description:f.description.value.trim(),active:f.active.checked,permission_ids};try{await req(item?'/roles/'+item.id:'/roles',{method:item?'PATCH':'POST',body:JSON.stringify(payload)});modal.hide();const root=document.getElementById('pageContent');if(root)rolesView(root);}catch(err){alert(err.message);}};
    el.addEventListener('hidden.bs.modal',()=>el.remove());
  }
  async function productsView(root){
    if(!can('settings.manage')){
      root.innerHTML=shell('Yetkisiz','Ürün ana verisi için erişiminiz yok.','<div class="alert alert-danger">settings.manage yetkisi gerekli.</div>');
      return;
    }
    const [brands,types,models]=await Promise.all([req('/settings/brands'),req('/settings/product-types'),req('/settings/models')]);
    const activeTypes=types.items.filter(x=>x.active);
    const activeBrands=brands.items.filter(x=>x.active);

    const typeRows=types.items.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td><span class="badge ${x.active?'text-bg-success':'text-bg-secondary'}">${x.active?'Aktif':'Pasif'}</span></td><td class="text-end"><button class="btn btn-sm btn-outline-primary me-1" data-type-edit="${x.id}"><i class="ti ti-edit"></i></button><button class="btn btn-sm btn-outline-${x.active?'warning':'success'}" data-type-toggle="${x.id}" data-active="${x.active}">${x.active?'Pasifleştir':'Aktifleştir'}</button></td></tr>`).join('')||'<tr><td colspan="3" class="text-secondary">Donanım tipi yok.</td></tr>';
    const brandRows=brands.items.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${(x.product_type_ids||[]).map(id=>{const t=types.items.find(v=>v.id===id);return t?'<span class="badge text-bg-dark border me-1">'+esc(t.name)+'</span>':''}).join('')||'<span class="text-secondary">Bağlantı yok</span>'}</td><td><span class="badge ${x.active?'text-bg-success':'text-bg-secondary'}">${x.active?'Aktif':'Pasif'}</span></td><td class="text-end"><button class="btn btn-sm btn-outline-primary me-1" data-brand-edit="${x.id}"><i class="ti ti-edit"></i></button><button class="btn btn-sm btn-outline-${x.active?'warning':'success'}" data-brand-toggle="${x.id}" data-active="${x.active}">${x.active?'Pasifleştir':'Aktifleştir'}</button></td></tr>`).join('')||'<tr><td colspan="4" class="text-secondary">Marka yok.</td></tr>';
    const modelRows=models.items.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.brand?.name||'-')}</td><td>${esc(x.product_type?.name||'-')}</td><td><span class="badge ${x.active?'text-bg-success':'text-bg-secondary'}">${x.active?'Aktif':'Pasif'}</span></td><td class="text-end"><button class="btn btn-sm btn-outline-primary me-1" data-model-edit="${x.id}"><i class="ti ti-edit"></i></button><button class="btn btn-sm btn-outline-${x.active?'warning':'success'}" data-model-toggle="${x.id}" data-active="${x.active}">${x.active?'Pasifleştir':'Aktifleştir'}</button></td></tr>`).join('')||'<tr><td colspan="5" class="text-secondary">Model yok.</td></tr>';

    root.innerHTML=shell('Ürün Ekle','Donanım tipi, marka ve model ana verilerini buradan yönetin. Pasifleştirme, mevcut kayıtların geçmişini korur.',`
      <div class="alert alert-secondary"><i class="ti ti-info-circle me-1"></i>Bu bölümde ürün ana verileri eklenir, düzenlenir ve pasifleştirilir. Fiziksel envanter kaydı Envanter bölümünden oluşturulur.</div>
      <div class="row g-3 mb-4">
        <div class="col-md-4"><div class="border rounded-3 p-3"><div class="small text-secondary">Donanım Tipi</div><div class="fs-4 fw-bold">${types.items.length}</div><div class="small text-secondary">${activeTypes.length} aktif</div></div></div>
        <div class="col-md-4"><div class="border rounded-3 p-3"><div class="small text-secondary">Marka</div><div class="fs-4 fw-bold">${brands.items.length}</div><div class="small text-secondary">${activeBrands.length} aktif</div></div></div>
        <div class="col-md-4"><div class="border rounded-3 p-3"><div class="small text-secondary">Model</div><div class="fs-4 fw-bold">${models.items.length}</div><div class="small text-secondary">${models.items.filter(x=>x.active).length} aktif</div></div></div>
      </div>
      <div class="d-flex flex-wrap gap-2 mb-3">
        <button class="btn btn-primary" id="addTypeBtn"><i class="ti ti-plus me-1"></i>Donanım Tipi</button>
        <button class="btn btn-primary" id="addBrandBtn"><i class="ti ti-plus me-1"></i>Marka</button>
        <button class="btn btn-primary" id="addModelBtn"><i class="ti ti-plus me-1"></i>Model</button>
      </div>
      <div class="accordion" id="productMasterAccordion">
        <div class="accordion-item bg-dark text-light border-secondary"><h2 class="accordion-header"><button class="accordion-button bg-dark text-light" data-bs-toggle="collapse" data-bs-target="#typesPanel">Donanım Tipleri</button></h2><div id="typesPanel" class="accordion-collapse collapse show"><div class="accordion-body"><div class="table-responsive"><table class="table table-dark table-hover align-middle mb-0"><thead><tr><th>Ad</th><th>Durum</th><th class="text-end">İşlem</th></tr></thead><tbody>${typeRows}</tbody></table></div></div></div></div>
        <div class="accordion-item bg-dark text-light border-secondary"><h2 class="accordion-header"><button class="accordion-button collapsed bg-dark text-light" data-bs-toggle="collapse" data-bs-target="#brandsPanel">Markalar</button></h2><div id="brandsPanel" class="accordion-collapse collapse"><div class="accordion-body"><div class="table-responsive"><table class="table table-dark table-hover align-middle mb-0"><thead><tr><th>Marka</th><th>Donanım Tipleri</th><th>Durum</th><th class="text-end">İşlem</th></tr></thead><tbody>${brandRows}</tbody></table></div></div></div></div>
        <div class="accordion-item bg-dark text-light border-secondary"><h2 class="accordion-header"><button class="accordion-button collapsed bg-dark text-light" data-bs-toggle="collapse" data-bs-target="#modelsPanel">Modeller</button></h2><div id="modelsPanel" class="accordion-collapse collapse"><div class="accordion-body"><div class="table-responsive"><table class="table table-dark table-hover align-middle mb-0"><thead><tr><th>Model</th><th>Marka</th><th>Donanım Tipi</th><th>Durum</th><th class="text-end">İşlem</th></tr></thead><tbody>${modelRows}</tbody></table></div></div></div></div>
      </div>`);

    const refresh=()=>productsView(root);
    root.querySelector('#addTypeBtn').onclick=()=>masterDataModal('type',null,types.items,brands.items,root);
    root.querySelector('#addBrandBtn').onclick=()=>masterDataModal('brand',null,types.items,brands.items,root);
    root.querySelector('#addModelBtn').onclick=()=>masterDataModal('model',null,types.items,brands.items,root);
    root.querySelectorAll('[data-type-edit]').forEach(b=>b.onclick=()=>masterDataModal('type',types.items.find(x=>String(x.id)===b.dataset.typeEdit),types.items,brands.items,root));
    root.querySelectorAll('[data-brand-edit]').forEach(b=>b.onclick=()=>masterDataModal('brand',brands.items.find(x=>String(x.id)===b.dataset.brandEdit),types.items,brands.items,root));
    root.querySelectorAll('[data-model-edit]').forEach(b=>b.onclick=()=>masterDataModal('model',models.items.find(x=>String(x.id)===b.dataset.modelEdit),types.items,brands.items,root));
    root.querySelectorAll('[data-type-toggle]').forEach(b=>b.onclick=async()=>{try{await req('/settings/product-types/'+b.dataset.typeToggle,{method:'PATCH',body:JSON.stringify({active:b.dataset.active!=='true'})});refresh();}catch(err){alert(err.message);}});
    root.querySelectorAll('[data-brand-toggle]').forEach(b=>b.onclick=async()=>{try{await req('/settings/brands/'+b.dataset.brandToggle,{method:'PATCH',body:JSON.stringify({active:b.dataset.active!=='true'})});refresh();}catch(err){alert(err.message);}});
    root.querySelectorAll('[data-model-toggle]').forEach(b=>b.onclick=async()=>{try{await req('/settings/models/'+b.dataset.modelToggle,{method:'PATCH',body:JSON.stringify({active:b.dataset.active!=='true'})});refresh();}catch(err){alert(err.message);}});
  }

  function masterDataModal(kind,item,types,brands,root){
    const old=document.getElementById('adminMasterDataModal');if(old)old.remove();
    const labels={type:'Donanım Tipi',brand:'Marka',model:'Model'};const label=labels[kind];
    const el=document.createElement('div');el.id='adminMasterDataModal';el.className='modal fade';
    const typeOptions=types.filter(x=>x.active||item?.product_type_id===x.id).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
    const brandOptions=brands.filter(x=>x.active||item?.brand_id===x.id).map(x=>`<option value="${x.id}" ${item?.brand_id===x.id?'selected':''}>${esc(x.name)}</option>`).join('');
    let fields=`<div class="mb-3"><label class="form-label">Ad</label><input name="name" class="form-control" required value="${esc(item?.name||'')}"></div>`;
    if(kind==='brand'){
      fields+=`<div class="mb-3"><label class="form-label">Donanım Tipleri</label><select name="product_type_ids" class="form-select" multiple size="6">${types.filter(x=>x.active||item?.product_type_ids?.includes(x.id)).map(x=>`<option value="${x.id}" ${item?.product_type_ids?.includes(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}</select><div class="form-text">Ctrl ile birden fazla tip seçebilirsiniz.</div></div>`;
    }
    if(kind==='model'){
      fields+=`<div class="mb-3"><label class="form-label">Marka</label><select name="brand_id" class="form-select" required><option value="">Seçin</option>${brandOptions}</select></div><div class="mb-3"><label class="form-label">Donanım Tipi</label><select name="product_type_id" class="form-select" required><option value="">Seçin</option>${typeOptions}</select></div>`;
    }
    fields+=`<div class="form-check"><input name="active" type="checkbox" class="form-check-input" ${item?.active!==false?'checked':''}><label class="form-check-label">Aktif</label></div>`;
    el.innerHTML=`<div class="modal-dialog"><div class="modal-content bg-dark text-light"><form><div class="modal-header"><h5 class="modal-title">${item?label+' Düzenle':'Yeni '+label}</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body">${fields}</div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary">Kaydet</button></div></form></div></div>`;
    document.body.appendChild(el);const modal=new bootstrap.Modal(el);modal.show();
    el.querySelector('form').onsubmit=async e=>{
      e.preventDefault();const f=e.currentTarget;const name=f.name.value.trim();if(!name)return;
      try{
        let path,method,payload;
        if(kind==='type'){path='/settings/product-types'+(item?'/'+item.id:'');method=item?'PATCH':'POST';payload={name,active:f.active.checked};}
        if(kind==='brand'){const product_type_ids=[...f.product_type_ids.selectedOptions].map(x=>Number(x.value));if(!product_type_ids.length){alert('En az bir donanım tipi seçin.');return;}path='/settings/product-hierarchy/brand'+(item?'/'+item.id:'');method=item?'PATCH':'POST';payload={name,active:f.active.checked,product_type_ids};}
        if(kind==='model'){if(!f.brand_id.value||!f.product_type_id.value){alert('Marka ve donanım tipi seçin.');return;}path='/settings/product-hierarchy/model'+(item?'?edit='+item.id:'');if(item){path='/settings/models/'+item.id;method='PATCH';}else{path='/settings/product-hierarchy/model';method='POST';}payload={name,active:f.active.checked,brand_id:Number(f.brand_id.value),product_type_id:Number(f.product_type_id.value)};}
        await req(path,{method,body:JSON.stringify(payload)});modal.hide();productsView(root);
      }catch(err){alert(err.message);}
    };
    el.addEventListener('hidden.bs.modal',()=>el.remove());
  }

  async function connectionsView(root){const [db,conn]=await Promise.all([req('/health/db'),req('/settings/connections')]);const dbOk=db.status==='ok';root.innerHTML=shell('Bağlantılar','Sistem servislerinin erişilebilirlik durumunu görüntüleyin.',`<div class="row g-3"><div class="col-lg-4"><div class="border rounded-3 p-4 h-100"><div class="d-flex justify-content-between align-items-center"><h5 class="mb-0">PostgreSQL</h5><span class="badge ${dbOk?'text-bg-success':'text-bg-danger'}">${dbOk?'Bağlı':'Hata'}</span></div><div class="small text-secondary mt-3">Veritabanı: ${esc(db.database||conn.database?.type||'PostgreSQL')}</div><div class="small text-secondary">Kimlik bilgileri arayüzde gösterilmez.</div></div></div><div class="col-lg-4"><div class="border rounded-3 p-4 h-100"><div class="d-flex justify-content-between align-items-center"><h5 class="mb-0">Backend API</h5><span class="badge text-bg-success">Aktif</span></div><div class="small text-secondary mt-3">Flask API erişilebilir.</div><div class="small text-secondary">Ortam: ${esc(conn.environment||'production')}</div></div></div><div class="col-lg-4"><div class="border rounded-3 p-4 h-100"><div class="d-flex justify-content-between align-items-center"><h5 class="mb-0">Ana Veri</h5><span class="badge text-bg-info">Merkezi</span></div><div class="small text-secondary mt-3">Fabrika, departman, donanım tipi, marka ve model tanımları Admin → Ürün Ekle'den yönetilir.</div></div></div></div><div class="mt-3"><button class="btn btn-outline-primary" id="refreshConnections"><i class="ti ti-refresh me-1"></i>Kontrolleri Yenile</button></div>`);root.querySelector('#refreshConnections').onclick=()=>connectionsView(root);}
  async function dataView(root){const [summary,health]=await Promise.all([req('/settings/summary'),req('/health/db')]);const labels={'factories':'Fabrikalar','departments':'Departmanlar','product-types':'Donanım Tipleri','brands':'Markalar','license-names':'Lisans Adları','models':'Modeller'};const entries=Object.entries(summary);root.innerHTML=shell('Veriler','Sistemdeki ana veri kayıtlarının özetini görüntüleyin.',`<div class="alert ${health.status==='ok'?'alert-success':'alert-danger'}"><i class="ti ti-database me-1"></i> PostgreSQL: ${health.status==='ok'?'Bağlantı başarılı':'Bağlantı başarısız'}</div><div class="row g-3">${entries.map(([k,v])=>`<div class="col-xl-3 col-md-4 col-6"><div class="border rounded-3 p-3 h-100"><div class="small text-secondary">${esc(labels[k]||k)}</div><div class="fs-4 fw-bold">${Number(v.total||0)}</div><div class="small"><span class="text-success">${Number(v.active||0)} aktif</span> · <span class="text-secondary">${Number(v.inactive||0)} pasif</span></div></div></div>`).join('')}</div><div class="mt-3 d-flex justify-content-between align-items-center"><div class="text-secondary small">Tanımların yönetimi yalnızca Admin → Ürün Ekle üzerinden yapılır.</div><button class="btn btn-outline-primary" id="refreshData"><i class="ti ti-refresh me-1"></i>Yenile</button></div>`);root.querySelector('#refreshData').onclick=()=>dataView(root);}
  async function render(){const hash=location.hash.replace('#','').split('?')[0];if(hash!=='admin')return;const root=document.getElementById('pageContent');if(!root||!window.IT_AUTH)return;try{if(hash==='profile')return profileView(root);const sub=document.querySelector('.admin-submenu-link.active')?.dataset.adminView||'users';if(sub==='roles')return rolesView(root);if(sub==='products')return productsView(root);if(sub==='connections')return connectionsView(root);if(sub==='data')return dataView(root);return usersView(root);}catch(err){root.innerHTML=shell('Hata','Yönetim ekranı yüklenemedi.',`<div class="alert alert-danger">${esc(err.message)}</div>`);}}
  document.addEventListener('click',e=>{const b=e.target.closest('[data-admin-view]');if(!b)return;document.querySelectorAll('[data-admin-view]').forEach(x=>x.classList.remove('active'));b.classList.add('active');if(location.hash!=='#admin')location.hash='#admin';else render();});
  window.IT_ADMIN={render};window.addEventListener('hashchange',render);window.addEventListener('itmanager:auth',render);document.addEventListener('DOMContentLoaded',render);
})();
