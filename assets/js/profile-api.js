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

let profileLogPage=1;
let profileLogMeta={actions:[],entity_types:[]};
let profileLogMaps={};

const profileActionLabels={
 'created':'Oluşturuldu','updated':'Güncellendi','deleted':'Silindi','assigned':'Atandı','unassigned':'Atama kaldırıldı',
 'scrapped':'Hurdaya ayrıldı','faulty':'Arızalı işaretlendi','sent_to_it':'Bilgi İşleme gönderildi',
 'inventory.created':'Envanter oluşturuldu','inventory.updated':'Envanter güncellendi','inventory.assigned':'Envanter zimmetlendi',
 'inventory.sent_to_it':'Envanter Bilgi İşleme gönderildi','inventory.scrapped':'Envanter hurdaya ayrıldı',
 'stock.created':'Stok oluşturuldu','stock.updated':'Stok güncellendi','stock.movement':'Stok hareketi',
 'license.created':'Lisans oluşturuldu','license.updated':'Lisans güncellendi','license.assigned':'Lisans atandı',
 'license.unassigned':'Lisans ataması kaldırıldı','maintenance.created':'Bakım kaydı oluşturuldu',
 'maintenance.updated':'Bakım kaydı güncellendi','request.created':'Satın alma talebi oluşturuldu'
};
const profileEntityLabels={inventory:'Envanter',stock:'Stok',stock_item:'Stok',license:'Lisans',licenses:'Lisans',personnel:'Personel',people:'Personel',maintenance:'Bakım',maintenance_record:'Bakım',scrap:'Hurda',request:'Satın Alma Talebi',purchase_request:'Satın Alma Talebi',settings:'Ayarlar',user:'Kullanıcı',product_model:'Model',brand:'Marka',factory:'Fabrika',department:'Departman'};
const profileValueLabels={active:'Aktif',faulty:'Arızalı',maintenance:'Bakım / Servis',scrapped:'Hurda',it:'Bilgi İşlem',pending:'Bekliyor',approved:'Onaylandı',ordered:'Sipariş Verildi',completed:'Tamamlandı',cancelled:'İptal'};
const profileDetailLabels={personnel_id:'Personel',brand_id:'Marka',model_id:'Model',product_type_id:'Donanım Tipi',factory_id:'Fabrika',department_id:'Departman',inventory_id:'Envanter',stock_item_id:'Stok',license_id:'Lisans',status:'Durum',old_status:'Eski durum',new_status:'Yeni durum',reason:'Neden',note:'Not',name:'Ad',title:'Başlık',serial_no:'Seri No',inventory_no:'Envanter No',barcode:'Barkod'};

const profileLabel=v=>{
 const s=String(v??'—');
 return profileActionLabels[s]||profileEntityLabels[s]||profileValueLabels[s]||s.replaceAll('_',' ');
};
const profileIdName=(key,value)=>{
 const mapKey=String(key||'').replace(/_id$/,'');
 const map=profileLogMaps[mapKey];
 if(map&&map[String(value)])return map[String(value)];
 return null;
};
const profileDetailValue=(v,key='')=>{
 if(v===null||v===undefined||v==='')return '—';
 if(typeof v==='boolean')return v?'Evet':'Hayır';
 if(Array.isArray(v))return v.map(x=>profileDetailValue(x)).join(', ');
 if(typeof v==='object')return Object.entries(v).map(([k,val])=>profileDetailValue(val,k)==='—'?'':(profileDetailLabels[k]||profileLabel(k))+': '+profileDetailValue(val,k)).filter(Boolean).join(' · ');
 const resolved=profileIdName(key,v);
 if(resolved)return resolved;
 return profileValueLabels[String(v)]||String(v);
};
const profileActionClass=v=>{
 const s=String(v||'');
 if(s.includes('scrap')||s.includes('delete'))return 'soft-danger';
 if(s.includes('faulty')||s.includes('maintenance'))return 'soft-warning';
 if(s.includes('assign'))return 'soft-primary';
 if(s.includes('create'))return 'soft-success';
 if(s.includes('update'))return 'soft-info';
 return 'soft-secondary';
};

async function loadProfileLogMeta(){
 try{
   const d=await req('/logs/meta');
   profileLogMeta=d||{actions:[],entity_types:[]};
 }catch(e){profileLogMeta={actions:[],entity_types:[]};}
 try{
   const d=await req('/master-data?scope=inventory');
   const toMap=items=>Object.fromEntries((items||[]).map(x=>[String(x.id),x.name]));
   profileLogMaps={
     personnel:toMap(d.personnel),factory:toMap(d.factories),department:toMap(d.departments),
     product_type:toMap(d.hardware_types),brand:toMap(d.brands),model:toMap(d.models),license:toMap(d.licenses)
   };
 }catch(e){profileLogMaps={};}
}

async function loadLogs(){
 const el=document.querySelector('#profileLogs'); if(!el)return;
 if(!window.IT_AUTH_USER?.permissions?.includes('logs.view')){
   el.innerHTML='<div class="p-4 text-secondary">İşlem kayıtlarını görüntüleme yetkiniz bulunmuyor.</div>';return;
 }
 try{
   await loadProfileLogMeta();
   el.innerHTML='<div class="profile-log-filters p-3 border-bottom"><div class="row g-2">'+
     '<div class="col-xl-4 col-lg-6"><input id="profileLogQ" class="form-control" placeholder="İşlem, modül, isim veya detay ara..."></div>'+
     '<div class="col-xl-2 col-lg-3"><select id="profileLogAction" class="form-select"><option value="">Tüm işlemler</option>'+profileLogMeta.actions.map(x=>'<option value="'+esc(x)+'">'+esc(profileLabel(x))+'</option>').join('')+'</select></div>'+
     '<div class="col-xl-2 col-lg-3"><select id="profileLogEntity" class="form-select"><option value="">Tüm modüller</option>'+profileLogMeta.entity_types.map(x=>'<option value="'+esc(x)+'">'+esc(profileLabel(x))+'</option>').join('')+'</select></div>'+
     '<div class="col-xl-2 col-lg-3"><input id="profileLogFrom" type="date" class="form-control" title="Başlangıç tarihi"></div>'+
     '<div class="col-xl-2 col-lg-3"><input id="profileLogTo" type="date" class="form-control" title="Bitiş tarihi"></div>'+
     '<div class="col-12 d-flex gap-2"><button class="btn btn-primary btn-sm" id="profileLogFilter"><i class="ti ti-filter me-1"></i>Filtrele</button><button class="btn btn-outline-secondary btn-sm" id="profileLogClear">Temizle</button></div>'+
   '</div></div><div id="profileLogTable"></div><div id="profileLogPager" class="p-3"></div>';

   const refresh=async()=>{
     const p=new URLSearchParams({actor_id:String(window.IT_AUTH_USER.id),page:String(profileLogPage),per_page:'20'});
     const map={q:'profileLogQ',action:'profileLogAction',entity_type:'profileLogEntity',date_from:'profileLogFrom',date_to:'profileLogTo'};
     Object.entries(map).forEach(([k,id])=>{const v=document.querySelector('#'+id)?.value;if(v)p.set(k,v)});
     try{
       const d=await req('/logs?'+p.toString());
       document.querySelector('#profileLogCount').textContent=d.pagination.total.toLocaleString('tr-TR')+' kayıt';
       const rows=(d.items||[]).map(x=>{
         const detail=Object.entries(x.details||{}).filter(([k])=>!k.endsWith('_id')).map(([k,v])=>(profileDetailLabels[k]||profileLabel(k))+': '+profileDetailValue(v,k)).join(' · ');
         return '<tr><td class="text-nowrap">'+esc(date(x.created_at))+'</td><td><span class="audit-action '+profileActionClass(x.action)+'">'+esc(profileLabel(x.action))+'</span></td><td>'+esc(profileEntityLabels[x.entity_type]||profileLabel(x.entity_type))+'</td><td>'+(x.entity_id??'—')+'</td><td>'+esc(detail||'—')+'</td></tr>';
       }).join('');
       document.querySelector('#profileLogTable').innerHTML='<style>.profile-log-filters{background:var(--bs-body-bg)}.profile-log-filters .form-control,.profile-log-filters .form-select{min-height:38px}.profile-log-table td{vertical-align:middle}</style><div class="table-responsive"><table class="table align-middle mb-0 profile-log-table"><thead><tr><th>TARİH</th><th>İŞLEM</th><th>MODÜL</th><th>VARLIK</th><th>DETAY</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5" class="text-center text-secondary py-4">Kayıt bulunamadı.</td></tr>')+'</tbody></table></div>';
       const pg=d.pagination,pager=document.querySelector('#profileLogPager');
       if(pg.pages<=1){pager.innerHTML='';return;}
       pager.innerHTML='<div class="d-flex justify-content-between align-items-center"><small class="text-secondary">Sayfa '+pg.page+' / '+pg.pages+' · '+pg.total.toLocaleString('tr-TR')+' kayıt · 20 / sayfa</small><div class="btn-group"><button class="btn btn-sm btn-outline-secondary" id="profileLogPrev" '+(pg.page<=1?'disabled':'')+'>Önceki</button><button class="btn btn-sm btn-outline-secondary" id="profileLogNext" '+(pg.page>=pg.pages?'disabled':'')+'>Sonraki</button></div></div>';
       const prev=document.querySelector('#profileLogPrev'),next=document.querySelector('#profileLogNext');
       if(prev)prev.onclick=()=>{profileLogPage--;refresh()};
       if(next)next.onclick=()=>{profileLogPage++;refresh()};
     }catch(e){document.querySelector('#profileLogTable').innerHTML='<div class="p-4 text-danger">'+esc(e.message)+'</div>'}
   };
   const apply=()=>{profileLogPage=1;refresh()};
   document.querySelector('#profileLogFilter').onclick=apply;
   document.querySelector('#profileLogClear').onclick=()=>{['profileLogQ','profileLogAction','profileLogEntity','profileLogFrom','profileLogTo'].forEach(id=>{const node=document.querySelector('#'+id);if(node)node.value=''});apply()};
   ['profileLogQ','profileLogAction','profileLogEntity','profileLogFrom','profileLogTo'].forEach(id=>document.querySelector('#'+id)?.addEventListener('keydown',e=>{if(e.key==='Enter')apply()}));
   await refresh();
 }catch(e){el.innerHTML='<div class="p-4 text-danger">'+esc(e.message)+'</div>'}
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
 if(!e.currentTarget.reportValidity())return;
 try{const d=await req('/profile',{method:'PATCH',body:JSON.stringify({email:document.querySelector('#profileEmail').value.trim()})});window.IT_AUTH_USER=d.user;renderUser(d.user);notice('Profil bilgileriniz güncellendi.')}
 catch(e){notice(e.message,'danger')}
}

async function changePassword(e){
 e.preventDefault();
 if(!e.currentTarget.reportValidity())return;
 const a=document.querySelector('#currentPassword').value,b=document.querySelector('#newPassword').value,c=document.querySelector('#newPassword2').value;
 if(b!==c){notice('Yeni şifreler aynı olmalı.','danger');return}
 try{await req('/profile/password',{method:'POST',body:JSON.stringify({current_password:a,new_password:b})});e.target.reset();notice('Şifreniz başarıyla değiştirildi.')}
 catch(e){notice(e.message==='current_password_invalid'?'Mevcut şifreniz hatalı.':e.message,'danger')}
}

window.addEventListener('hashchange',()=>setTimeout(load,80));

window.IT_PROFILE_API={load};
})();