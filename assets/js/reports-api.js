(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const n=v=>Number(v||0).toLocaleString('tr-TR');
const statusLabel=v=>({active:'Aktif',inactive:'Pasif',faulty:'Arızalı',arizali:'Arızalı',broken:'Arızalı',maintenance:'Bakımda',service:'Serviste',scrapped:'Hurda',pending:'Bekliyor',in_progress:'İşlemde',completed:'Tamamlandı',cancelled:'İptal',draft:'Taslak',approved:'Onaylandı',ordered:'Sipariş Verildi',rejected:'Reddedildi',expired:'Süresi Doldu',expiring:'Süresi Yaklaşıyor',available:'Mevcut',unavailable:'Mevcut Değil'}[v]||v||'Bilinmiyor');
let reportController=null;
async function load(){
 if(location.hash.slice(1)!=='reports')return;
 reportController?.abort();
 reportController=new AbortController();
 const signal=reportController.signal;
 const c=document.querySelector('#pageContent'); if(!c)return;
 c.innerHTML='<div class="text-center text-secondary py-5">Raporlar yükleniyor...</div>';
 try{
  const res=await fetch('/api/reports/summary',{signal});
  if(!res.ok)throw Error('Rapor verileri alınamadı');
  const d=await res.json();
  const card=(title,value,sub)=>'<div class="col-md-3"><div class="stat-card"><div><span>'+esc(title)+'</span><h2>'+n(value)+'</h2><small>'+esc(sub||'')+'</small></div></div></div>';
  const bars=(arr)=>{const items=(arr||[]).slice(0,8);if(!items.length)return '<div class="text-secondary">Veri yok</div>';const max=Math.max(1,...items.map(x=>Number(x.count||0)));return '<div class="simple-bars">'+items.map(x=>'<div><span>'+esc(statusLabel(x.label))+'</span><b style="width:'+Math.min(100,(Number(x.count||0)/max)*100)+'%"></b><strong>'+n(x.count)+'</strong></div>').join('')+'</div>';};
  const inv=d.inventory||{},lic=d.licenses||{},st=d.stock||{},m=d.maintenance||{},r=d.requests||{},p=d.people||{},s=d.scrap||{};
  const typeBars=bars(inv.by_type);
  const scrapBars=bars([{label:'Envanter',count:s.inventory},{label:'Lisans',count:s.license},{label:'Stok',count:s.stock}]);
  c.innerHTML=`
   <div class="page-head"><div><h1>Raporlar</h1><p>Sistemdeki IT varlıkları ve operasyonların güncel özet görünümü.</p></div><div class="page-actions"><div class="dropdown"><button class="btn btn-outline-primary dropdown-toggle" data-bs-toggle="dropdown"><i class="ti ti-file-spreadsheet me-1"></i>Dışa Aktar</button><div class="dropdown-menu dropdown-menu-end p-2" style="min-width:250px"><div class="small text-secondary px-2 py-1">Tüm kayıtlar ve işlem geçmişi</div><label class="form-label small px-2 mt-1 mb-1" for="reportExportSearch">Arama filtresi</label><input class="form-control form-control-sm mb-2" id="reportExportSearch" placeholder="Envanter no, seri no, barkod..."><label class="form-label small px-2 mb-1" for="reportExportStatus">Durum filtresi</label><select class="form-select form-select-sm mb-2" id="reportExportStatus"><option value="">Tüm durumlar</option><option value="active">Aktif</option><option value="available">Mevcut</option><option value="assigned">Atanmış</option><option value="inactive">Pasif</option><option value="faulty">Arızalı</option><option value="maintenance">Bakımda</option><option value="scrapped">Hurda</option><option value="pending">Bekliyor</option><option value="completed">Tamamlandı</option></select><div class="dropdown-divider"></div><button class="dropdown-item" data-report-format="xlsx"><i class="ti ti-file-spreadsheet me-2"></i>Excel (.xlsx) — ayrı sayfalar</button><button class="dropdown-item" data-report-format="csv"><i class="ti ti-file-text me-2"></i>CSV (.csv) — tüm modüller</button></div></div><button class="btn btn-outline-secondary" id="reportsPrint"><i class="ti ti-printer me-1"></i>Yazdır</button><button class="btn btn-outline-secondary" id="reportsRefresh"><i class="ti ti-refresh me-1"></i>Yenile</button></div></div>
   <div class="row g-3 mb-4">
    ${card('Toplam Envanter',inv.total,`${n(inv.active)} aktif · ${n(inv.scrapped)} hurda`)}
    ${card('Toplam Lisans',lic.total,`${n(lic.active)} aktif · ${n(lic.expiring)} süresi yaklaşıyor`)}
    ${card('Stok Kalemi',st.items,`${n(st.total_quantity)} toplam miktar`)}
    ${card('Aktif Personel',p.active,`${n(p.total)} toplam personel`)}
   </div>
   <div class="row g-3">
    <div class="col-xl-6"><div class="panel"><div class="panel-head"><div><h3>Envanter Durumu</h3><p>Demirbaşların mevcut durum dağılımı</p></div></div><div class="p-3">${bars(inv.by_status)}</div></div></div>
    <div class="col-xl-6"><div class="panel"><div class="panel-head"><div><h3>Envanter Türleri</h3><p>Cihaz ve demirbaş türlerine göre dağılım</p></div></div><div class="p-3">${typeBars}</div></div></div>
    <div class="col-xl-6"><div class="panel"><div class="panel-head"><div><h3>Lisans Durumu</h3><p>Aktif, yaklaşan ve süresi dolmuş lisanslar</p></div></div><div class="p-3">${bars(lic.by_status)}</div></div></div>
    <div class="col-xl-6"><div class="panel"><div class="panel-head"><div><h3>Bakım / Servis</h3><p>Toplam bakım maliyeti: ${n(m.total_cost)} ₺</p></div></div><div class="p-3">${bars(m.by_status)}</div></div></div>
    <div class="col-xl-6"><div class="panel"><div class="panel-head"><div><h3>Satın Alma Talepleri</h3><p>Talep durumlarının dağılımı</p></div></div><div class="p-3">${bars(r.by_status)}</div></div></div>
    <div class="col-xl-6"><div class="panel"><div class="panel-head"><div><h3>Hurda Dağılımı</h3><p>Hurdaya ayrılmış kayıtların kaynağı</p></div></div><div class="p-3">${scrapBars}</div></div></div>
    <div class="col-xl-6"><div class="panel"><div class="panel-head"><div><h3>Stok Durumu</h3><p>Stok kalemlerinin durum dağılımı</p></div></div><div class="p-3">${bars(st.by_status)}</div></div></div>
    <div class="col-xl-6"><div class="panel"><div class="panel-head"><div><h3>Operasyon Özeti</h3><p>Öne çıkan güncel sayılar</p></div></div><div class="p-3"><div class="row g-2">
      <div class="col-6"><div class="flow-note">Arızalı: <strong>${n(inv.faulty)}</strong></div></div>
      <div class="col-6"><div class="flow-note">Bakımda: <strong>${n(inv.maintenance)}</strong></div></div>
      <div class="col-6"><div class="flow-note">Bekleyen talep: <strong>${n(r.pending)}</strong></div></div>
      <div class="col-6"><div class="flow-note">Tamamlanan bakım: <strong>${n(m.completed)}</strong></div></div>
      <div class="col-6"><div class="flow-note">Toplam hurda: <strong>${n(s.total)}</strong></div></div>
      <div class="col-6"><div class="flow-note">Pasif personel: <strong>${n(p.inactive)}</strong></div></div>
    </div></div></div></div>
   </div>`;
  document.querySelector('#reportsPrint')?.addEventListener('click',()=>window.print());
  document.querySelectorAll('[data-report-format]').forEach(b=>b.addEventListener('click',()=>exportReport(b.dataset.reportFormat)));
  async function exportReport(format){
   const params=new URLSearchParams({format,scope:'all'});
   const search=document.querySelector('#reportExportSearch')?.value.trim();
   const status=document.querySelector('#reportExportStatus')?.value;
   if(search)params.set('search',search);
   if(status)params.set('status',status);
   try{
    const response=await fetch('/api/reports/export?'+params.toString());
    if(!response.ok){let message='Dışa aktarma başarısız';try{message=(await response.json()).error||message}catch(_){}throw Error(message)}
    const blob=await response.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=format==='xlsx'?'itmanager-rapor.xlsx':'itmanager-rapor.csv';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
   }catch(error){console.error(error);alert(error.message||'Dışa aktarma başarısız');}
  }
  document.querySelector('#reportsRefresh')?.addEventListener('click',load);
 }catch(e){
  console.error(e);
  c.innerHTML='<div class="alert alert-danger">Rapor verileri yüklenemedi. Lütfen sayfayı yenileyin.</div>';
 }
}
window.addEventListener('hashchange',()=>setTimeout(load,80));

window.IT_REPORTS_API={load};
})();