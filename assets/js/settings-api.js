(function () {
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const api=()=>window.IT_AUTH;
  const req=(p,o)=>api().request(p,o);
  function shell(title,sub,body){return `<div class="page-header"><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div></div>${body}`;}
  async function render(root){
    if(!root)return;
    try{
      const [summary,conn,health]=await Promise.all([req('/settings/summary'),req('/settings/connections'),req('/health/db')]);
      const resourceLabels={factories:'Fabrika',departments:'Departman', 'product-types':'Donanım Tipi',brands:'Marka','license-names':'Lisans Adı',models:'Model'};
      const masterTotal=Object.values(summary).reduce((n,x)=>n+(Number(x?.total)||0),0);
      root.innerHTML=shell('Sistem Ayarları','Sistemin genel çalışma bilgilerini ve bağlantı durumlarını yönetin.',`
        <div class="row g-3 mb-4">
          <div class="col-xl-3 col-md-6"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Sistem Durumu</div><div class="fs-3 fw-bold text-success">Çalışıyor</div><div class="small text-secondary">IT Manager</div></div></div></div>
          <div class="col-xl-3 col-md-6"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Veritabanı</div><div class="fs-3 fw-bold ${health.status==='ok'?'text-success':'text-danger'}">${health.status==='ok'?'Bağlı':'Hata'}</div><div class="small text-secondary">PostgreSQL</div></div></div></div>
          <div class="col-xl-3 col-md-6"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Backend API</div><div class="fs-3 fw-bold text-success">Aktif</div><div class="small text-secondary">Flask API</div></div></div></div>
          <div class="col-xl-3 col-md-6"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary small">Ana Veri</div><div class="fs-3 fw-bold">${masterTotal}</div><div class="small text-secondary">Admin Panelinden yönetilir</div></div></div></div>
        </div>
        <div class="row g-3">
          <div class="col-xl-7">
            <div class="card border-0 shadow-sm h-100"><div class="card-body">
              <div class="d-flex justify-content-between align-items-center mb-3"><div><h5 class="mb-1">Sistem Bilgileri</h5><div class="small text-secondary">Uygulamanın çalışma ortamı ve servis bilgileri.</div></div><button id="settingsRefresh" class="btn btn-outline-secondary btn-sm"><i class="ti ti-refresh me-1"></i>Yenile</button></div>
              <div class="row g-3">
                <div class="col-md-6"><div class="border rounded-3 p-3"><div class="small text-secondary">Uygulama</div><strong>IT Manager</strong></div></div>
                <div class="col-md-6"><div class="border rounded-3 p-3"><div class="small text-secondary">Ortam</div><strong>${esc(conn.environment||'production')}</strong></div></div>
                <div class="col-md-6"><div class="border rounded-3 p-3"><div class="small text-secondary">Backend</div><strong>${esc(conn.backend?.status==='ok'?'Flask API aktif':'Kontrol edilemedi')}</strong></div></div>
                <div class="col-md-6"><div class="border rounded-3 p-3"><div class="small text-secondary">Veritabanı</div><strong>PostgreSQL</strong></div></div>
              </div>
            </div></div>
          </div>
          <div class="col-xl-5">
            <div class="card border-0 shadow-sm h-100"><div class="card-body">
              <h5>Yönetim Alanları</h5><p class="small text-secondary">Ana veri ekleme, düzenleme ve pasifleştirme işlemleri artık Admin Paneli üzerinden yapılır.</p>
              <div class="list-group list-group-flush">
                <div class="list-group-item bg-transparent px-0 d-flex justify-content-between"><span>Ürün / Model</span><span class="text-secondary">Admin → Ürün Ekle</span></div>
                <div class="list-group-item bg-transparent px-0 d-flex justify-content-between"><span>Marka / Donanım Tipi</span><span class="text-secondary">Admin → Ürün Ekle</span></div>
                <div class="list-group-item bg-transparent px-0 d-flex justify-content-between"><span>Lisans ana verileri</span><span class="text-secondary">Admin / ilgili modül</span></div>
                <div class="list-group-item bg-transparent px-0 d-flex justify-content-between"><span>Kullanıcı / Rol / Yetki</span><span class="text-secondary">Admin Paneli</span></div>
              </div>
            </div></div>
          </div>
        </div>
        <div class="card border-0 shadow-sm mt-3"><div class="card-body">
          <h5 class="mb-1">Ana Veri Özeti</h5><div class="small text-secondary mb-3">Bu bölüm sadece görüntüleme amaçlıdır. Değişiklikler Admin Paneli üzerinden yapılır.</div>
          <div class="row g-3">${Object.entries(summary).map(([k,v])=>`<div class="col-xl-2 col-lg-3 col-md-4 col-6"><div class="border rounded-3 p-3"><div class="small text-secondary">${esc(resourceLabels[k]||k)}</div><div class="fs-4 fw-bold">${v.total||0}</div><div class="small"><span class="text-success">${v.active||0} aktif</span> · <span class="text-secondary">${v.inactive||0} pasif</span></div></div></div>`).join('')}</div>
        </div></div>`);
      root.querySelector('#settingsRefresh').onclick=()=>render(root);
    }catch(err){root.innerHTML=shell('Sistem Ayarları','Ayarlar yüklenemedi.',`<div class="alert alert-danger">${esc(err.message)}</div>`);}
  }
  window.IT_SETTINGS={render:()=>render(document.getElementById('pageContent'))};
  window.addEventListener('hashchange',()=>{if(location.hash.replace('#','').split('?')[0]==='settings')window.IT_SETTINGS.render();});
  window.addEventListener('itmanager:auth',()=>{if(location.hash.replace('#','').split('?')[0]==='settings')window.IT_SETTINGS.render();});

})();