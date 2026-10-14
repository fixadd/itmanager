(function () {
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const api=()=>window.IT_AUTH;
  const req=(p,o)=>api().request(p,o);
  const defaults={system_name:'Baylan IT Manager',company_name:'BAYLAN',subtitle:'IT MANAGER',logo_data:''};
  let branding={...defaults};
  function route(){return location.hash.replace(/^#/,'').split('?')[0]==='settings';}
  function applyBranding(value){
    branding={...defaults,...value};
    document.title=branding.system_name||defaults.system_name;
    document.querySelectorAll('.brand').forEach(el=>{
      const mark=el.querySelector('.brand-mark');
      const words=el.querySelector('.brand strong');
      const sub=el.querySelector('.brand span');
      if(words)words.textContent=branding.company_name||defaults.company_name;
      if(sub)sub.textContent=branding.subtitle||defaults.subtitle;
      if(mark){
        if(branding.logo_data){
          mark.innerHTML='<img alt="" src="'+esc(branding.logo_data)+'">';
          mark.classList.add('has-custom-logo');
        }else{
          mark.textContent=(branding.company_name||'B').trim().charAt(0).toUpperCase()||'B';
          mark.classList.remove('has-custom-logo');
        }
      }
    });
  }
  function shell(title,sub,body){return '<div class="page-header"><div><h1>'+esc(title)+'</h1><p>'+esc(sub)+'</p></div></div>'+body;}
  async function render(root){
    if(!root)return;
    await loadBranding();
    root.innerHTML=shell('Sistem Ayarları','Uygulamanın adını ve sol üstte görünen şirket logosunu buradan yönetin.',`
      <div class="row g-3">
        <div class="col-xl-7">
          <section class="card border-0 shadow-sm h-100"><div class="card-body p-4">
            <div class="d-flex align-items-center gap-3 mb-4"><div class="rounded-3 p-3 bg-body-tertiary"><i class="ti ti-branding-watermark fs-3"></i></div><div><h5 class="mb-1">Uygulama Kimliği</h5><div class="small text-secondary">Kaydedilen bilgiler tüm kullanıcıların ekranında görünür.</div></div></div>
            <form id="brandingForm">
              <div class="mb-3"><label for="systemName" class="form-label">Sistem adı</label><input class="form-control" id="systemName" maxlength="80" required></div>
              <div class="mb-3"><label for="companyName" class="form-label">Sol üst şirket adı</label><input class="form-control" id="companyName" maxlength="80" required></div>
              <div class="mb-4"><label for="brandSubtitle" class="form-label">Şirket adının alt yazısı</label><input class="form-control" id="brandSubtitle" maxlength="80" required></div>
              <div class="d-flex flex-wrap gap-2"><button class="btn btn-primary" id="brandingSave" type="submit"><i class="ti ti-device-floppy me-1"></i>Değişiklikleri Kaydet</button><button class="btn btn-outline-secondary" id="brandingReset" type="button">Varsayılanlara dön</button></div>
              <div id="brandingMessage" class="mt-3" role="status" aria-live="polite"></div>
            </form>
          </div></section>
        </div>
        <div class="col-xl-5">
          <section class="card border-0 shadow-sm h-100"><div class="card-body p-4">
            <h5 class="mb-1">Şirket Logosu</h5><p class="small text-secondary mb-3">PNG, JPG veya WebP. En fazla 1 MB. Logo veritabanında saklanır.</p>
            <div class="branding-preview rounded-3 border d-flex align-items-center justify-content-center mb-3 p-4" id="brandingPreview">
              <div class="branding-preview-mark" id="brandingPreviewMark">B</div><div class="ms-3"><strong id="brandingPreviewName">BAYLAN</strong><div class="small text-secondary" id="brandingPreviewSubtitle">IT MANAGER</div></div>
            </div>
            <label for="brandingLogo" class="form-label">Logo dosyası</label><input type="file" class="form-control" id="brandingLogo" accept="image/png,image/jpeg,image/webp">
            <div class="d-flex gap-2 mt-3"><button class="btn btn-outline-primary" id="brandingLogoApply" type="button">Logoyu seç</button><button class="btn btn-outline-danger" id="brandingLogoRemove" type="button">Logoyu kaldır</button></div>
            <div class="small text-secondary mt-3">Önizleme değişikliği kaydetmeden önce gösterir. Kalıcı olması için “Değişiklikleri Kaydet” düğmesine basın.</div>
          </div></section>
        </div>
      </div>
      <section class="card border-0 shadow-sm mt-3"><div class="card-body p-4"><h5 class="mb-1">Sistem Sağlığı</h5><p class="small text-secondary mb-3">Uygulama ve veritabanı bağlantı bilgileri.</p><div class="row g-3" id="settingsHealth"><div class="col-12 text-secondary small">Kontrol ediliyor...</div></div><button class="btn btn-sm btn-outline-secondary mt-3" id="settingsRefresh" type="button"><i class="ti ti-refresh me-1"></i>Durumu yenile</button></div></section>`);
    const byId=id=>root.querySelector('#'+id);
    let pendingLogo=branding.logo_data||'';
    function preview(){
      const name=byId('companyName').value||branding.company_name;
      const subtitle=byId('brandSubtitle').value||branding.subtitle;
      byId('brandingPreviewName').textContent=name;
      byId('brandingPreviewSubtitle').textContent=subtitle;
      const mark=byId('brandingPreviewMark');
      mark.innerHTML=pendingLogo?'<img alt="" src="'+esc(pendingLogo)+'">':esc((name||'B').trim().charAt(0).toUpperCase());
      mark.classList.toggle('has-custom-logo',!!pendingLogo);
    }
    function fill(data){
      branding={...defaults,...data};pendingLogo=branding.logo_data||'';
      byId('systemName').value=branding.system_name;
      byId('companyName').value=branding.company_name;
      byId('brandSubtitle').value=branding.subtitle;
      byId('brandingLogo').value='';
      preview();
    }
    ['companyName','brandSubtitle'].forEach(id=>byId(id).addEventListener('input',preview));
    byId('brandingLogoApply').addEventListener('click',()=>{
      const file=byId('brandingLogo').files?.[0];
      if(!file){message('Önce bir logo dosyası seçin.','warning');return;}
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)){message('PNG, JPG veya WebP dosyası seçin.','danger');return;}
      if(file.size>1024*1024){message('Logo en fazla 1 MB olabilir.','danger');return;}
      const reader=new FileReader();reader.onload=()=>{pendingLogo=String(reader.result||'');preview();message('Logo önizlemeye alındı. Kalıcı olması için değişiklikleri kaydedin.','info');};reader.onerror=()=>message('Logo dosyası okunamadı.','danger');reader.readAsDataURL(file);
    });
    byId('brandingLogoRemove').addEventListener('click',()=>{pendingLogo='';byId('brandingLogo').value='';preview();});
    function message(text,type='success'){byId('brandingMessage').innerHTML='<div class="alert alert-'+type+' py-2 mb-0">'+esc(text)+'</div>';}
    byId('brandingReset').addEventListener('click',()=>fill(defaults));
    byId('brandingForm').addEventListener('submit',async e=>{
      e.preventDefault();const btn=byId('brandingSave');btn.disabled=true;
      try{
        const payload={system_name:byId('systemName').value.trim(),company_name:byId('companyName').value.trim(),subtitle:byId('brandSubtitle').value.trim(),logo_data:pendingLogo};
        const response=await fetch('/api/settings/branding',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||'Ayarlar kaydedilemedi.');
        applyBranding(data);fill(data);message('Sistem ayarları kaydedildi.','success');
      }catch(err){message(err.message||'Ayarlar kaydedilemedi.','danger');}
      finally{btn.disabled=false;}
    });
    async function loadHealth(){
      const box=byId('settingsHealth');box.innerHTML='<div class="col-12 text-secondary small">Kontrol ediliyor...</div>';
      try{
        const [summary,conn,health]=await Promise.all([req('/settings/summary'),req('/settings/connections'),req('/health/db')]);
        const total=Object.values(summary).reduce((n,x)=>n+(Number(x?.total)||0),0);
        box.innerHTML='<div class="col-md-4"><div class="border rounded-3 p-3"><div class="small text-secondary">Uygulama</div><strong>'+esc(branding.system_name)+'</strong></div></div><div class="col-md-4"><div class="border rounded-3 p-3"><div class="small text-secondary">Veritabanı</div><strong class="'+(health.status==='ok'?'text-success':'text-danger')+'">'+(health.status==='ok'?'Bağlı':'Hata')+'</strong><div class="small text-secondary">PostgreSQL</div></div></div><div class="col-md-4"><div class="border rounded-3 p-3"><div class="small text-secondary">Ana veri kayıtları</div><strong>'+total.toLocaleString('tr-TR')+'</strong><div class="small text-secondary">'+esc(conn.environment||'production')+'</div></div></div>';
      }catch(err){box.innerHTML='<div class="col-12"><div class="alert alert-warning mb-0">'+esc(err.message||'Sistem durumu alınamadı.')+'</div></div>';}
    }
    byId('settingsRefresh').addEventListener('click',loadHealth);
    fill(branding);loadHealth();
  }
  async function loadBranding(){
    try{
      const response=await fetch('/api/settings/branding',{method:'GET',cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json','Cache-Control':'no-cache'}});
      if(!response.ok)return null;
      const value=await response.json();
      applyBranding(value);
      return value;
    }catch(_){return null;}
  }
  window.IT_SETTINGS={render:()=>render(document.getElementById('pageContent')),applyBranding};
  window.addEventListener('itmanager:auth',()=>{if(route())window.IT_SETTINGS.render();else loadBranding();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadBranding);else loadBranding();
})();