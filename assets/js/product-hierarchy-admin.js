(function(){
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  const req=(p,o)=>window.IT_AUTH.request(p,o);
  const can=()=> (window.IT_AUTH_USER?.permissions||[]).includes('settings.manage');
  const msg=e=>alert(e?.message||'İşlem başarısız.');
  async function renderProducts(){
    const root=document.getElementById('pageContent'); if(!root||!can()) return;
    const d=await req('/settings/product-hierarchy');
    const types=d.hardware_types||[], brands=d.brands||[], models=d.models||[];
    root.innerHTML=`<div class="page-header"><div><h1>Ürün Ekle</h1><p>Donanım tipi → marka → model hiyerarşisini ve global fabrika/departman ana verilerini yönetin.</p></div></div>
      <div class="row g-4">
        <div class="col-xl-8"><div class="card border-0 shadow-sm"><div class="card-body">
          <h5>Donanım / Marka / Model</h5><p class="text-secondary small">Markalar bir veya birden fazla donanım tipine bağlanır. Model yalnızca seçilen donanım tipine bağlı markalardan seçilebilir.</p>
          <div class="row g-3">
            <div class="col-md-4"><label class="form-label">Donanım Tipi</label><select id="phType" class="form-select"><option value="">Seçin</option>${types.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>
            <div class="col-md-4"><label class="form-label">Marka</label><select id="phBrand" class="form-select" disabled><option value="">Önce donanım tipi</option></select></div>
            <div class="col-md-4"><label class="form-label">Model</label><input id="phModel" class="form-control" placeholder="Örn. Latitude 5450" disabled></div>
          </div>
          <div class="mt-3 d-flex gap-2"><button id="phSaveModel" class="btn btn-primary" disabled><i class="ti ti-plus me-1"></i>Model Kaydet</button><button id="phAddBrand" class="btn btn-outline-primary" disabled><i class="ti ti-tag me-1"></i>Bu Tipe Marka Ekle</button></div>
          <hr><h6>Mevcut Ürün Hiyerarşisi</h6><div class="table-responsive"><table class="table table-dark table-hover align-middle"><thead><tr><th>Donanım Tipi</th><th>Marka</th><th>Model</th></tr></thead><tbody id="phRows">${models.map(m=>`<tr><td>${esc(m.product_type?.name||'-')}</td><td>${esc(m.brand?.name||'-')}</td><td>${esc(m.name)}</td></tr>`).join('')||'<tr><td colspan="3" class="text-secondary">Henüz model tanımlanmamış.</td></tr>'}</tbody></table></div>
        </div></div></div>
        <div class="col-xl-4"><div class="card border-0 shadow-sm"><div class="card-body"><h5>Global Ana Veriler</h5><p class="text-secondary small">Fabrika ve departman burada tanımlanır; diğer sayfalar ortak master veriden kullanır.</p>
          <form id="phFactoryForm" class="mb-4"><label class="form-label">Yeni Fabrika</label><div class="input-group"><input name="name" class="form-control" placeholder="Fabrika adı" required><button class="btn btn-outline-primary">Ekle</button></div></form>
          <div class="small mb-3">${(d.factories||[]).map(x=>`<span class="badge text-bg-secondary me-1 mb-1">${esc(x.name)}</span>`).join('')||'<span class="text-secondary">Fabrika yok.</span>'}</div>
          <form id="phDepartmentForm"><label class="form-label">Yeni Departman</label><div class="input-group"><input name="name" class="form-control" placeholder="Departman adı" required><button class="btn btn-outline-primary">Ekle</button></div></form>
          <div class="small mt-3">${(d.departments||[]).map(x=>`<span class="badge text-bg-secondary me-1 mb-1">${esc(x.name)}</span>`).join('')||'<span class="text-secondary">Departman yok.</span>'}</div>
        </div></div></div></div>`;
    const type=root.querySelector('#phType'), brand=root.querySelector('#phBrand'), model=root.querySelector('#phModel'), save=root.querySelector('#phSaveModel'), addBrand=root.querySelector('#phAddBrand');
    function refresh(){const tid=Number(type.value);const list=brands.filter(b=>b.product_type_ids?.includes(tid));brand.innerHTML=`<option value="">${tid?'Marka seçin':'Önce donanım tipi'}</option>`+list.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('');brand.disabled=!tid;model.disabled=!tid;save.disabled=!tid||!brand.value;addBrand.disabled=!tid;}
    type.onchange=refresh; brand.onchange=()=>{save.disabled=!type.value||!brand.value;};
    save.onclick=async()=>{if(!model.value.trim())return alert('Model adı zorunludur.');try{await req('/settings/product-hierarchy/model',{method:'POST',body:JSON.stringify({name:model.value.trim(),brand_id:Number(brand.value),product_type_id:Number(type.value)})});await renderProducts();}catch(e){msg(e);}};
    addBrand.onclick=()=>{const name=prompt('Bu donanım tipi için marka adı:');if(!name?.trim())return;req('/settings/product-hierarchy/brand',{method:'POST',body:JSON.stringify({name:name.trim(),product_type_ids:[Number(type.value)]})}).then(renderProducts).catch(msg);};
    root.querySelector('#phFactoryForm').onsubmit=async e=>{e.preventDefault();const name=e.currentTarget.name.value.trim();try{await req('/settings/factories',{method:'POST',body:JSON.stringify({name})});await renderProducts();}catch(err){msg(err);}};
    root.querySelector('#phDepartmentForm').onsubmit=async e=>{e.preventDefault();const name=e.currentTarget.name.value.trim();try{await req('/settings/departments',{method:'POST',body:JSON.stringify({name})});await renderProducts();}catch(err){msg(err);}};
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-admin-view="products"]');if(!b)return;setTimeout(()=>{if(location.hash==='#admin')renderProducts().catch(msg);},0);});
  window.addEventListener('hashchange',()=>{if(location.hash==='#admin'&&document.querySelector('[data-admin-view="products"].active'))renderProducts().catch(msg);});
})();
