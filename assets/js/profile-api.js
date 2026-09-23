(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const date=v=>v?new Date(v).toLocaleString('tr-TR'):'—';
const label=v=>String(v||'—').replaceAll('_',' ');
const req=(u,o={})=>window.IT_AUTH.request(u,o);
let loaded=false;

function shell(c){
 c.innerHTML=`
 <div class="page-head"><div><h1>Profil</h1><p>Hesap, güvenlik ve kişisel işlem geçmişinizi yönetin.</p></div><div class="page-actions"><button class="btn btn-outline-secondary" id="profileRefresh"><i class="ti ti-refresh me-1"></i>Yenile</button></div></div>
 <div id="profileAlert"></div>
 <div class="row g-3">
   <div class="col-xl-5">
     <div class="panel h-100"><div class="panel-head"><div><h3>Hesap Bilgileri</h3><p>Oturum açan kullanıcıya ait bilgiler.</p></div></div>
       <div id="profileSummary" class="p-3">Yükleniyor...</div>
     </div>
   </div>
   <div class="col-xl-7">
     <div class="panel"><div class="panel-head"><div><h3>Kişisel Bilgiler</h3><p>E-posta adresinizi güncelleyebilirsiniz.</p></div></div>
       <form id="profileForm" class="p-3"><div class="row g-3">
         <div class="col-md-6"><label class="form-label">Kullanıcı Adı</label><input id="profileUsername" class="form-control" readonly></div>
         <div class="col-md-6"><label class="form-label">E-posta</label><input id="profileEmail" type="email" class="form-control" maxlength="255"></div>
       </div><div class="mt-3"><button class="btn btn-primary" type="submit"><i class="ti ti-device-floppy me-1"></i>Bilgileri Kaydet</button></div></form>
     </div>
     <div class="panel mt-3"><div class="panel-head"><div><h3>Şifre Değiştir</h3><p>Mevcut şifrenizi doğrulayarak yeni bir şifre belirleyin.</p></div></div>
       <form id="passwordForm" class="p-3"><div class="row g-3">
         <div class="col-md-4"><label class="form-label">Mevcut Şifre</label><input id="currentPassword" type="password" class="form-control" autocomplete="current-password" required></div>
         <div class="col-md-4"><label class="form-label">Yeni Şifre</label><input id="newPassword" type="password" class="form-control" minlength="8" autocomplete="new-password" required></div>
         <div class="col-md-4"><label class="form-label">Yeni Şifre Tekrar</label><input id="newPassword2" type="password" class="form-control" minlength="8" autocomplete="new-password" required></div>
       </div><div class="mt-3"><small class="text-secondary">En az 8 karakter olmalıdır.</small> <button class="btn btn-outline-primary float-end" type="submit"><i class="ti ti-key me-1"></i>Şifreyi Güncelle</button></div></form>
     </div>
   </div>
   <div class="col-xl-5">
     <div class="panel"><div class="panel-head"><div><h3>Rol ve Yetkiler</h3><p>Hesabınıza tanımlı erişimler.</p></div></div><div id="profilePermissions" class="p-3">Yükleniyor...</div></div>
   </div>
   <div class="col-xl-7">
     <div class="panel"><div class="panel-head"><div><h3>Güvenlik Bilgileri</h3><p>Oturum ve hesap durumunuz.</p></div></div><div id="profileSecurity" class="p-3">Yükleniyor...</div></div>
   </div>
   <div class="col-12">
     <div class="panel"><div class="panel-head"><div><h3>Kendi İşlem Kayıtlarım</h3><p>Hesabınızla gerçekleştirilen son sistem hareketleri.</p></div><span id="profileLogCount" class="small text-secondary"></span></div><div id="profileLogs" class="table-responsive"><div class="p-4 text-secondary">Yükleniyor...</div></div></div>
   </div>
 </div>`;
 document.querySelector('#profileRefresh').onclick=load;
 document.querySelector('#profileForm').onsubmit=saveProfile;
 document.querySelector('#passwordForm').onsubmit=changePassword;
}

function notice(message,type='success'){
 const el=document.querySelector('#profileAlert'); if(!el)return;
 el.innerHTML=`<div class="alert alert-${type} d-flex align-items-center justify-content-between" role="alert"><span>${esc(message)}</span><button type="button" class="btn-close" data-close-alert></button></div>`;
 el.querySelector('[data-close-alert]').onclick=()=>el.innerHTML='';
}

function renderUser(user){
 document.querySelector('#profileUsername').value=user.username||'';
 document.querySelector('#profileEmail').value=user.email||'';
 const personnel=user.personnel?.name||'Atanmamış';
 const role=user.role?.name||'Rol yok';
 document.querySelector('#profileSummary').innerHTML=`
 <div class="d-flex align-items-center gap-3 mb-4"><div class="avatar" style="width:56px;height:56px;font-size:18px">${esc((user.personnel?.name||user.username||'IT').split(/\\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase())}</div><div><h4 class="mb-1">${esc(personnel)}</h4><div class="text-secondary">${esc(user.username)}</div></div></div>
 <div class="detail-grid"><div><span>Personel</span><strong>${esc(personnel)}</strong></div><div><span>Rol</span><strong>${esc(role)}</strong></div><div><span>E-posta</span><strong>${esc(user.email||'—')}</strong></div><div><span>Durum</span><strong>${user.active?'<span class="status success">Aktif</span>':'<span class="status danger">Pasif</span>'}</strong></div></div>`;
 const perms=user.permissions||[];
 document.querySelector('#profilePermissions').innerHTML=`<div class="mb-3"><strong>${esc(role)}</strong> <span class="text-secondary">· ${perms.length} yetki</span></div><div class="d-flex flex-wrap gap-2">${perms.map(p=>`<span class="badge text-bg-dark border">${esc(label(p))}</span>`).join('')||'<span class="text-secondary">Tanımlı yetki bulunmuyor.</span>'}</div>`;
 document.querySelector('#profileSecurity').innerHTML=`<div class="detail-grid"><div><span>Hesap Durumu</span><strong>${user.active?'Aktif':'Pasif'}</strong></div><div><span>Son Giriş</span><strong>${esc(date(user.last_login_at))}</strong></div><div><span>Kullanıcı ID</span><strong>#${esc(user.id)}</strong></div><div><span>Personel Bağlantısı</span><strong>${user.personnel?'Bağlı':'Bağlı değil'}</strong></div></div>`;
}

async function loadLogs(){
 const el=document.querySelector('#profileLogs'); if(!el)return;
 if(!window.IT_AUTH_USER?.permissions?.includes('logs.view')){
   el.innerHTML='<div class="p-4 text-secondary">İşlem kayıtlarını görüntüleme yetkiniz bulunmuyor.</div>';return;
 }
 try{
   const id=window.IT_AUTH_USER.id;
   const d=await req('/logs?actor_id='+encodeURIComponent(id)+'&page=1&per_page=10');
   document.querySelector('#profileLogCount').textContent=`${d.pagination.total.toLocaleString('tr-TR')} kayıt`;
   el.innerHTML=`<table class="table align-middle mb-0"><thead><tr><th>TARİH</th><th>İŞLEM</th><th>MODÜL</th><th>VARLIK</th><th>DETAY</th></tr></thead><tbody>${d.items.map(x=>`<tr><td class="text-nowrap">${esc(date(x.created_at))}</td><td><span class="badge text-bg-dark border">${esc(label(x.action))}</span></td><td>${esc(label(x.entity_type))}</td><td>${x.entity_id??'—'}</td><td>${esc(Object.entries(x.details||{}).map(([k,v])=>k+': '+(typeof v==='object'?JSON.stringify(v):v)).join(' · ')||'—')}</td></tr>`).join('')||'<tr><td colspan="5" class="text-center text-secondary py-4">Henüz işlem kaydı yok.</td></tr>'}</tbody></table>`;
 }catch(e){el.innerHTML=`<div class="p-4 text-danger">${esc(e.message)}</div>`}
}

async function load(){
 if(location.hash.slice(1)!=='profile')return;
 const c=document.querySelector('#pageContent');if(!c)return;
 shell(c);
 try{
   const d=await req('/profile');window.IT_AUTH_USER=d.user;renderUser(d.user);loaded=true;loadLogs();
 }catch(e){notice(e.message,'danger')}
}

async function saveProfile(e){
 e.preventDefault();
 try{const d=await req('/profile',{method:'PATCH',body:JSON.stringify({email:document.querySelector('#profileEmail').value.trim()})});window.IT_AUTH_USER=d.user;renderUser(d.user);notice('Profil bilgileriniz güncellendi.')}
 catch(e){notice(e.message,'danger')}
}

async function changePassword(e){
 e.preventDefault();
 const a=document.querySelector('#currentPassword').value,b=document.querySelector('#newPassword').value,c=document.querySelector('#newPassword2').value;
 if(b!==c){notice('Yeni şifreler aynı olmalı.','danger');return}
 try{await req('/profile/password',{method:'POST',body:JSON.stringify({current_password:a,new_password:b})});e.target.reset();notice('Şifreniz başarıyla değiştirildi.')}
 catch(e){notice(e.message==='current_password_invalid'?'Mevcut şifreniz hatalı.':e.message,'danger')}
}

window.addEventListener('hashchange',()=>setTimeout(load,80));
document.addEventListener('DOMContentLoaded',()=>setTimeout(load,350));
window.IT_PROFILE_API={load};
})();