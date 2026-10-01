(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const n=v=>Number(v||0).toLocaleString('tr-TR');
const statusLabel=v=>({active:'Aktif',inactive:'Pasif',faulty:'Arızalı',arizali:'Arızalı',broken:'Arızalı',maintenance:'Bakımda',service:'Serviste',scrapped:'Hurda',pending:'Bekliyor',in_progress:'İşlemde',completed:'Tamamlandı',cancelled:'İptal',draft:'Taslak',approved:'Onaylandı',ordered:'Sipariş Verildi',rejected:'Reddedildi',expired:'Süresi Doldu',expiring:'Süresi Yaklaşıyor',available:'Mevcut',unavailable:'Mevcut Değil'}[v]||v||'Bilinmiyor');
async function load(){
 if(location.hash.slice(1)!=='reports')return;
 const c=document.querySelector('#pageContent'); if(!c)return;
 c.innerHTML='<div class="text-center text-secondary py-5">Raporlar yükleniyor...</div>';
 try{
  const res=await fetch('/api/reports/summary');
  if(!res.ok)throw Error('Rapor verileri alınamadı');
  const d=await res.json();
  const card=(title,value,sub)=>'<div class="col-md-3"><div class="stat-card"><div><span>'+esc(title)+'</span><h2>'+n(value)+'</h2><small>'+esc(sub||'')+'</small></div></div></div>';
  const bars=(arr)=>{const items=(arr||[]).slice(0,8);if(!items.length)return '<div class="text-secondary">Veri yok</div>';const max=Math.max(1,...items.map(x=>Number(x.count||0)));return '<div class="simple-bars">'+items.map(x=>'<div><span>'+esc(statusLabel(x.label))+'</span><b style="width:'+Math.min(100,(Number(x.count||0)/max)*100)+'%"></b><strong>'+n(x.count)+'</strong></div>').join('')+'</div>';};
  const inv=d.inventory||{},lic=d.licenses||{},st=d.stock||{},m=d.maintenance||{},r=d.requests||{},p=d.people||{},s=d.scrap||{};
  const typeBars=bars(inv.by_type);
  const scrapBars=bars([{label:'Envanter',count:s.inventory},{label:'Lisans',count:s.license},{label:'Stok',count:s.stock}]);
  c.innerHTML=`
   <div class="page-head"><div><h1>Raporlar</h1><p>Sistemdeki IT varlıkları ve operasyonların güncel özet görünümü.</p></div><div class="page-actions"><div class="dropdown"><button class="btn btn-outline-primary dropdown-toggle" data-bs-toggle="dropdown"><i class="ti ti-file-spreadsheet me-1"></i>Excel Dışa Aktar (XLS)</button><div class="dropdown-menu dropdown-menu-end p-2" style="min-width:240px"><div class="small text-secondary px-2 py-1">Aktarılacak bölümü seçin</div><button class="dropdown-item" data-report-export="inventory">Envanter</button><button class="dropdown-item" data-report-export="licenses">Lisanslar</button><button class="dropdown-item" data-report-export="stock">Stok</button><button class="dropdown-item" data-report-export="people">Personeller</button><button class="dropdown-item" data-report-export="all">Tüm rapor özeti</button></div></div><button class="btn btn-outline-secondary" id="reportsPrint"><i class="ti ti-printer me-1"></i>Yazdır</button><button class="btn btn-outline-secondary" id="reportsRefresh"><i class="ti ti-refresh me-1"></i>Yenile</button></div></div>
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
  document.querySelectorAll('[data-report-export]').forEach(b=>b.addEventListener('click',()=>exportReport(b.dataset.reportExport,d)));
  function exportReport(kind,data){const rows=[['Kategori','Alan','Değer']];if(kind==='inventory'||kind==='all')rows.push(['Envanter','Toplam',data.inventory?.total||0],['Envanter','Aktif',data.inventory?.active||0],['Envanter','Hurda',data.inventory?.scrapped||0]);if(kind==='licenses'||kind==='all')rows.push(['Lisans','Toplam',data.licenses?.total||0],['Lisans','Aktif',data.licenses?.active||0],['Lisans','Süresi yaklaşan',data.licenses?.expiring||0]);if(kind==='stock'||kind==='all')rows.push(['Stok','Kalem',data.stock?.items||0],['Stok','Toplam miktar',data.stock?.total_quantity||0]);if(kind==='people'||kind==='all')rows.push(['Personel','Toplam',data.people?.total||0],['Personel','Aktif',data.people?.active||0]);if(rows.length<2)return;const escXml=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');const sheetRows=rows.map((r,n)=>'<Row>'+r.map(v=>'<Cell'+(n===0?' ss:StyleID="header"':'')+'><Data ss:Type="'+(typeof v==='number'?'Number':'String')+'">'+escXml(v)+'</Data></Cell>').join('')+'</Row>').join('');const xml='<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="header"><Font ss:Bold="1"/></Style></Styles><Worksheet ss:Name="Rapor"><Table>'+sheetRows+'</Table></Worksheet></Workbook>';const blob=new Blob([xml],{type:'application/vnd.ms-excel'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='itmanager-rapor-'+kind+'.xls';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  document.querySelector('#reportsRefresh')?.addEventListener('click',load);
 }catch(e){
  console.error(e);
  c.innerHTML='<div class="alert alert-danger">Rapor verileri yüklenemedi. Lütfen sayfayı yenileyin.</div>';
 }
}
window.addEventListener('hashchange',()=>setTimeout(load,80));

window.IT_REPORTS_API={load};
})();