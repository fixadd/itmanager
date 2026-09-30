document.addEventListener('DOMContentLoaded',()=>{
const content=document.querySelector('#pageContent'),crumb=document.querySelector('#crumb');
const pages={dashboard:['Ana Sayfa','IT varlıklarının ve devam eden süreçlerin sade özeti.'],barcode:['Barkod Ara','Barkod, envanter numarası veya seri numarası ile cihaz bulun.'],inventory:['Envanter Takip','Kalıcı demirbaşları, zimmetleri ve cihaz hareketlerini yönetin.'],licenses:['Lisans Takip','Yazılım lisanslarını, atamaları ve sürelerini yönetin.'],stock:['Stok Takip','Sarf malzeme ve aksesuar stoklarını yönetin.'],maintenance:['Tamir / Bakım Takibi','İç bakım ve dış servis süreçlerini tek ekrandan takip edin.'],requests:['Satın Alma Talepleri','Envanter, lisans ve sarf satın alma taleplerini yönetin.'],people:['Personeller','Personel, zimmet, lisans ve sarf geçmişini görüntüleyin.'],knowledge:['Bilgi Bankası','IT ekipleri için teknik doküman ve çözüm merkezi.'],scrap:['Hurdalar','Hurdaya ayrılmış demirbaşların arşivini yönetin.'],reports:['Raporlar','Demirbaş, stok, bakım/tamir ve lisans raporları.'],profile:['Profil','Hesap, güvenlik ve bildirim tercihleri.'],admin:['Admin Paneli','Kullanıcı, rol ve yetki yönetimi.'],settings:['Sistem Ayarları','Şirket, organizasyon ve modül ayarları.'],logs:['Kayıtlar','Tüm sistem hareketleri ve denetim geçmişi.']};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const btn=(text,icon='plus')=>`<button class="btn btn-primary"><i class="ti ti-${icon} me-1"></i>${text}</button>`;
const status=(text,type='success')=>`<span class="status ${type}">${text}</span>`;
const panel=(title,body,sub='')=>`<div class="panel"><div class="panel-head"><div><h3>${title}</h3>${sub?`<p>${sub}</p>`:''}</div></div>${body}</div>`;
function head(k,actions=''){const [t,s]=pages[k];return `<div class="page-head"><div><h1>${t}</h1><p>${s}</p></div><div class="page-actions">${actions}</div></div>`}
function filters(labels=['Ara...','Tüm Durumlar','Tüm Departmanlar']){return `<div class="filter-bar"><input placeholder="${labels[0]}">${labels.slice(1).map(x=>`<select><option>${x}</option><option>Aktif</option><option>Pasif</option></select>`).join('')}<button class="btn btn-outline-secondary"><i class="ti ti-filter me-1"></i>Filtrele</button></div>`}
function table(headers,rows){return `<div class="table-responsive"><table class="table align-middle"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}<th>İŞLEM</th></tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join('')}<td><button class="btn btn-sm btn-light"><i class="ti ti-eye"></i></button><button class="btn btn-sm btn-light ms-1"><i class="ti ti-dots"></i></button></td></tr>`).join('')}</tbody></table></div>`}
function miniBars(items){return `<div class="simple-bars">${items.map(x=>`<div><span>${x[0]}</span><b style="width:${x[2]}%"></b><strong>${x[1]}</strong></div>`).join('')}</div>`}
function dashboard(){return head('dashboard')+`
<div id="dashboardLive" class="text-secondary small mb-3">Veriler yükleniyor...</div>
<div class="row g-3 mb-4">
  <div class="col-md-4"><div class="stat-card"><div class="stat-icon"><i class="ti ti-devices"></i></div><div><span>Toplam Envanter</span><h2 id="dashInventoryTotal">-</h2><small id="dashInventoryMeta">-</small></div></div></div>
  <div class="col-md-4"><div class="stat-card"><div class="stat-icon orange"><i class="ti ti-alert-triangle"></i></div><div><span>Arızalı Cihazlar</span><h2 id="dashFaulty">-</h2><small id="dashMaintenance">-</small></div></div></div>
  <div class="col-md-4"><div class="stat-card"><div class="stat-icon purple"><i class="ti ti-file-invoice"></i></div><div><span>Açık Talepler</span><h2 id="dashRequests">-</h2><small id="dashRequestMeta">-</small></div></div></div>
</div>
<div class="row g-3">
  <div class="col-xl-7">${panel('Envanter Durum Dağılımı',`<div class="chart-area"><div class="legend" id="dashInventoryStatus"><span class="text-secondary">Yükleniyor...</span></div></div>`,'Canlı veritabanı özeti')}</div>
  <div class="col-xl-5">${panel('Cihaz Türleri',`<div id="dashTypes" class="simple-bars"><span class="text-secondary">Yükleniyor...</span></div>`,'Envanter dağılımı')}</div>
  <div class="col-xl-6">${panel('Aylık Sistem İşlemleri',`<div id="dashMonthly" class="simple-bars"><span class="text-secondary">Yükleniyor...</span></div>`,'Son dört ay')}</div>
  <div class="col-xl-6">${panel('Stok Giriş / Çıkış',`<div id="dashStock" class="simple-bars"><span class="text-secondary">Yükleniyor...</span></div>`,'Toplam hareket miktarı')}</div>
  <div class="col-xl-6">${panel('Bakım Durumu',`<div id="dashMaintenanceStatus" class="simple-bars"><span class="text-secondary">Yükleniyor...</span></div>`,'Mevcut bakım kayıtları')}</div>
  <div class="col-xl-6">${panel('Talep Durumu',`<div id="dashRequestStatus" class="simple-bars"><span class="text-secondary">Yükleniyor...</span></div>`,'Satın alma talepleri')}</div>
  <div class="col-12">${panel('Son İşlemler',`<div id="dashRecent" class="activity-list"><span class="text-secondary">Yükleniyor...</span></div>`,'Audit kayıtlarından son hareketler')}</div>
</div>`}

async function loadDashboard(){
  const box=document.getElementById('dashboardLive');if(!box)return;
  try{
    const r=await fetch('/api/dashboard/summary',{headers:{Accept:'application/json'}});
    const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Dashboard verileri alınamadı');
    const inv=d.inventory||{}, req=d.requests||{}, m=d.maintenance||{}, stock=d.stock||{};
    const fmt=n=>Number(n||0).toLocaleString('tr-TR');
    document.getElementById('dashInventoryTotal').textContent=fmt(inv.total);
    document.getElementById('dashInventoryMeta').textContent=`Aktif ${fmt(inv.active)} · Hurda ${fmt(inv.scrapped)}`;
    document.getElementById('dashFaulty').textContent=fmt(inv.faulty);
    document.getElementById('dashMaintenance').textContent=`Bakım / servis: ${fmt(inv.maintenance)}`;
    document.getElementById('dashRequests').textContent=fmt((req.pending||0)+(req.approved||0)+(req.ordered||0));
    document.getElementById('dashRequestMeta').textContent=`Bekleyen ${fmt(req.pending)} · Onaylı ${fmt(req.approved)}`;
    const maxType=Math.max(1,...(inv.by_type||[]).map(x=>x.count));
    document.getElementById('dashTypes').innerHTML=(inv.by_type||[]).map(x=>`<div><span>${esc(x.label)}</span><b style="width:${Math.round(x.count/maxType*100)}%"></b><strong>${fmt(x.count)}</strong></div>`).join('')||'<span class="text-secondary">Kayıt yok.</span>';
    const labels={active:'Aktif',faulty:'Arızalı',maintenance:'Bakım / Servis',scrapped:'Hurda',it:'Bilgi İşlem',service:'Servis'};
    document.getElementById('dashInventoryStatus').innerHTML=(inv.by_status||[]).map(x=>`<div class="mb-2 d-flex justify-content-between"><span>${esc(labels[x.label]||x.label)}</span><strong>${fmt(x.count)}</strong></div>`).join('')||'<span class="text-secondary">Kayıt yok.</span>';
    const maxMonth=Math.max(1,...(d.monthly_activity||[]).map(x=>x.count));
    document.getElementById('dashMonthly').innerHTML=(d.monthly_activity||[]).map(x=>`<div><span>${new Date(x.month).toLocaleDateString('tr-TR',{month:'long',year:'numeric'})}</span><b style="width:${Math.round(x.count/maxMonth*100)}%"></b><strong>${fmt(x.count)}</strong></div>`).join('')||'<span class="text-secondary">Kayıt yok.</span>';
    document.getElementById('dashStock').innerHTML=`<div><span>Giriş</span><b style="width:${stock.in?100:0}%"></b><strong>${fmt(stock.in)}</strong></div><div><span>Çıkış</span><b style="width:${stock.out?Math.min(100,Math.round(stock.out/Math.max(stock.in,1)*100)):0}%"></b><strong>${fmt(stock.out)}</strong></div><div><span>Mevcut</span><b style="width:${stock.total_quantity?100:0}%"></b><strong>${fmt(stock.total_quantity)}</strong></div>`;
    const maint=[['Bekleyen',m.pending],['İşlemde',m.in_progress],['Serviste',m.service],['Tamamlanan',m.completed]];
    document.getElementById('dashMaintenanceStatus').innerHTML=maint.map(x=>`<div><span>${x[0]}</span><b style="width:${x[1]?Math.min(100,x[1]*10):0}%"></b><strong>${fmt(x[1])}</strong></div>`).join('');
    const requests=[['Bekleyen',req.pending],['Onaylandı',req.approved],['Sipariş',req.ordered],['Tamamlandı',req.completed]];
    document.getElementById('dashRequestStatus').innerHTML=requests.map(x=>`<div><span>${x[0]}</span><b style="width:${x[1]?Math.min(100,x[1]*10):0}%"></b><strong>${fmt(x[1])}</strong></div>`).join('');
    const actionNames={'inventory.created':'Envanter oluşturuldu','inventory.assigned':'Envanter zimmetlendi','inventory.sent_to_it':'Envanter Bilgi İşleme gönderildi','inventory.scrapped':'Envanter hurdaya ayrıldı','stock.created':'Stok oluşturuldu','stock.movement':'Stok hareketi','maintenance.created':'Bakım kaydı oluşturuldu','maintenance.updated':'Bakım kaydı güncellendi','request.created':'Satın alma talebi oluşturuldu','settings.catalog_model_created':'Model oluşturuldu'};
    document.getElementById('dashRecent').innerHTML=(d.recent_activity||[]).map(x=>`<div class="activity"><div class="activity-icon"><i class="ti ti-history"></i></div><div><strong>${esc(actionNames[x.action]||x.action||'İşlem')}</strong><span>${esc(x.actor)} · ${x.created_at?new Date(x.created_at).toLocaleString('tr-TR'):'-'}</span></div></div>`).join('')||'<span class="text-secondary">Henüz işlem kaydı yok.</span>';
    box.textContent='Veriler güncel.';
  }catch(e){box.textContent='Dashboard verileri yüklenemedi: '+e.message;box.className='alert alert-warning mb-3';}
}
function barcode(){return head('barcode')+`<div class="barcode-hero"><i class="ti ti-barcode"></i><h3>Barkod Ara</h3><p>Stok, envanter veya lisans barkodunu okutun ya da barkod numarasını girin.</p><div class="barcode-search"><input id="navBarcode" autofocus placeholder="STK-000001 / ENV-000001 / LIC-000001" autocomplete="off"><button class="btn btn-primary" id="navBarcodeBtn"><i class="ti ti-search me-1"></i>Ara</button></div><small class="text-muted d-block mt-3">USB barkod okuyucu klavye gibi çalışır; okutma sonrası Enter yeterlidir.</small></div><div id="navBarcodeResult"></div>`}
function inventory(){return '<div id="inventoryScreen"></div>'}
function licenses(){return '<div id="licensesScreen"></div>'}
function stock(){return '<div id="stockScreen"></div>'}
function maintenance(){return head('maintenance',`<button class="btn btn-primary" id="maintenanceNew"><i class="ti ti-tool me-1"></i>Bakım Kaydı</button>`)+`<div class="tabs-bar"><button class="active" data-maint-tab="all">Tümü</button><button data-maint-tab="service">Dış Servis / Tamir</button><button data-maint-tab="completed">Tamamlanan</button></div><div class="row g-3 mb-3"><div class="col-md-4"><div class="stat-card"><div><span>Serviste</span><h2 id="maintenanceStatService">0</h2></div></div></div><div class="col-md-4"><div class="stat-card"><div><span>Bakım Bekleyen</span><h2 id="maintenanceStatPending">0</h2></div></div></div><div class="col-md-4"><div class="stat-card"><div><span>Tamamlanan</span><h2 id="maintenanceStatCompleted">0</h2></div></div></div></div><div class="filter-bar"><input id="maintenanceSearch" placeholder="Cihaz / Envanter No / arıza ara..."><select id="maintenanceStatus"><option value="">Tüm Durumlar</option><option value="pending">Bekliyor</option><option value="in_progress">İşlemde</option><option value="service">Serviste</option><option value="completed">Tamamlandı</option><option value="cancelled">İptal</option></select><button class="btn btn-outline-secondary" id="maintenanceRefresh"><i class="ti ti-refresh me-1"></i>Yenile</button></div>`+panel('Bakım ve Servis Kayıtları',`<div class="table-responsive"><table class="table align-middle"><thead><tr><th>CİHAZ</th><th>PERSONEL</th><th>ARIZA</th><th>SERVİS</th><th>BAŞLANGIÇ</th><th>BİTİŞ</th><th>DURUM</th><th>İŞLEM</th></tr></thead><tbody><tr><td colspan="8" class="text-center text-secondary py-4">Yükleniyor...</td></tr></tbody></table></div>`,'PostgreSQL · bakım ve servis kayıtları')}
function requests(){return head('requests',`<button class="btn btn-primary" id="requestNew"><i class="ti ti-file-plus me-1"></i>Yeni Talep</button>`)+`<div class="row g-3 mb-3"><div class="col-md-3"><div class="stat-card"><div><span>Bekleyen</span><h2 id="requestStatPending">0</h2></div></div></div><div class="col-md-3"><div class="stat-card"><div><span>Onaylanan</span><h2 id="requestStatApproved">0</h2></div></div></div><div class="col-md-3"><div class="stat-card"><div><span>Sipariş Verildi</span><h2 id="requestStatOrdered">0</h2></div></div></div><div class="col-md-3"><div class="stat-card"><div><span>Tamamlanan</span><h2 id="requestStatCompleted">0</h2></div></div></div></div><div class="filter-bar"><input id="requestSearch" placeholder="Talep No / Talep Sahibi ara..."><select id="requestStatus"><option value="">Tüm Durumlar</option><option value="draft">Taslak</option><option value="pending">Bekliyor</option><option value="approved">Onaylandı</option><option value="ordered">Sipariş Verildi</option><option value="completed">Tamamlandı</option><option value="rejected">Reddedildi</option><option value="cancelled">İptal</option></select><select id="requestPriority"><option value="">Tüm Öncelikler</option><option value="urgent">Acil</option><option value="high">Yüksek</option><option value="normal">Normal</option><option value="low">Düşük</option></select><button class="btn btn-outline-secondary" id="requestRefresh"><i class="ti ti-refresh me-1"></i>Yenile</button></div>`+panel('Satın Alma Talepleri',`<div class="table-responsive"><table class="table align-middle" id="requestsTable"><thead><tr><th>TALEP NO</th><th>TALEP SAHİBİ</th><th>KALEMLER</th><th>ÖNCELİK</th><th>DURUM</th><th>TARİH</th><th>İŞLEM</th></tr></thead><tbody><tr><td colspan="7" class="text-center text-secondary py-4">Yükleniyor...</td></tr></tbody></table></div>`,'PostgreSQL · satın alma talepleri')}
function people(){return head('people',`<button class="btn btn-outline-secondary" id="personnelRefresh"><i class="ti ti-refresh me-1"></i>Yenile</button><button class="btn btn-primary" id="personnelNew"><i class="ti ti-plus me-1"></i>Yeni Personel</button>`)+`<div class="filter-bar personnel-filter-bar"><input id="personnelSearch" placeholder="Personel no, ad soyad veya e-posta ara..."><select id="personnelStatus"><option value="">Tüm Durumlar</option><option value="active">Aktif</option><option value="inactive">Pasif</option></select><select id="personnelDepartment"><option value="">Tüm Departmanlar</option></select><button class="btn btn-outline-secondary" id="personnelFilterReset"><i class="ti ti-filter-off me-1"></i>Temizle</button></div>`+`<div id="personnelPanel">`+panel('Personel Listesi',`<div class="table-responsive"><table class="table align-middle" id="personnelTable"><thead><tr><th>PERSONEL NO</th><th>AD SOYAD</th><th>E-POSTA</th><th>DEPARTMAN</th><th>DURUM</th><th>VARLIK</th><th>İŞLEM</th></tr></thead><tbody><tr><td colspan="7" class="text-center text-secondary py-4">Yükleniyor...</td></tr></tbody></table></div>`,'PostgreSQL · personel kayıtları')+`</div>`}
function knowledge(){return '<div id="knowledgeScreen"></div>'}
function scrap(){return '<div id="scrapScreen"></div>'}
function reports(){return '<div id="reportsScreen"></div>'}
function profile(){return '<div id="profileScreen"></div>'}
function admin(){return '<div id="adminScreen"></div>'}
function settings(){return '<div id="settingsScreen"></div>'}
function logs(){return '<div id="logsScreen"></div>'}
function generic(k){return head(k,btn('Yeni Kayıt'))+filters()+panel(pages[k][0]+' Kayıtları',table(['KAYIT','AÇIKLAMA','SORUMLU','DURUM','TARİH'],[['#1001',pages[k][0]+' örnek kaydı','IT Manager',status('Aktif'),'04.09.2026'],['#1002','Örnek ikinci kayıt','IT Manager',status('İşlemde','info'),'03.09.2026']]))}
function layout(k){return ({dashboard,barcode,inventory,licenses,stock,maintenance,requests,people,knowledge,scrap,reports,profile,admin,settings,logs}[k]||(()=>generic(k)))()}
let renderedPage=null;
function go(k){
  if(!pages[k])return;
  const pageChanged=renderedPage!==k;
  renderedPage=k;
  document.querySelectorAll('.nav-link').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.admin-submenu-link').forEach(x=>x.classList.remove('active'));
  document.querySelector('.nav-link[data-page="'+k+'"]')?.classList.add('active');
  const detailRoute=(k==='inventory'||k==='stock'||k==='licenses') && new RegExp('^#'+k+'/(\\d+)$').test(location.hash);
  if(k!=='admin'&&!detailRoute)history.replaceState(null,'',location.pathname+location.search+'#'+k);
  crumb.textContent=pages[k][0];
  content.innerHTML=layout(k);
  window.scrollTo(0,0);
  if(k==='inventory')setTimeout(()=>window.IT_INVENTORY_INIT?.(),0);
  if(k==='dashboard')setTimeout(loadDashboard,0);
  if(k==='barcode'){
    const run=async()=>{
      const input=document.querySelector('#navBarcode'),box=document.querySelector('#navBarcodeResult'),q=input?.value.trim();
      if(!q){box.innerHTML='<div class="alert alert-warning">Barkod girin veya okutun.</div>';return;}
      try{
        const response=await fetch('/api/barcode/'+encodeURIComponent(q),{headers:{Accept:'application/json'}});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||'Barkod bulunamadı');
        if(data.detail_url)location.hash=data.detail_url.replace(/^#/,'');
      }catch(e){box.innerHTML='<div class="alert alert-danger">'+esc(e.message)+'</div>';}
    };
    document.querySelector('#navBarcodeBtn')?.addEventListener('click',run);
    document.querySelector('#navBarcode')?.addEventListener('keydown',e=>{if(e.key==='Enter')run();});
  }
}
function handleNavHash(){
  const raw=location.hash.replace(/^#/,'');
  const m=raw.match(/^([^/]+)(?:\/(\d+))?/);
  const page=m?.[1];
  if(!page||!pages[page])return;
  if(page==='inventory'&&m[2]){
    go('inventory');
    setTimeout(()=>window.IT_INVENTORY_API?.openDetail(Number(m[2])),0);
    return;
  }
  go(page);
}

document.addEventListener('click',e=>{
  const link=e.target.closest('.nav-link[data-page]');
  if(!link)return;
  e.preventDefault();
  const page=link.dataset.page;
  if(page==='admin'){
    const submenu=document.getElementById('adminSubmenu');
    const open=!submenu?.classList.contains('open');
    submenu?.classList.toggle('open',open);
    link.setAttribute('aria-expanded',String(open));
    if(location.hash!=='#admin')location.hash='#admin';else go('admin');
    return;
  }
  if(location.hash!=='#'+page)location.hash='#'+page;else go(page);
});
window.addEventListener('hashchange',handleNavHash);
window.IT_NAV={go,handleNavHash};
const initial=location.hash.replace(/^#/,'').match(/^([^/]+)/)?.[1];
if(initial&&pages[initial])setTimeout(handleNavHash,0);
});
