/* Live PostgreSQL master-data binding for add/edit forms. */
(()=>{
let globalCache=null,catalogCache={};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const getGlobals=async()=>{if(globalCache)return globalCache;const r=await fetch('/api/master-data',{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Ana veriler alınamadı');globalCache=await r.json();return globalCache};
const getCatalog=async scope=>{if(catalogCache[scope])return catalogCache[scope];const r=await fetch(`/api/settings/product-catalog?scope=${scope}`,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Ürün kataloğu alınamadı');catalogCache[scope]=await r.json();return catalogCache[scope]};
const fill=(sel,items,placeholder='Seçiniz',valueKey='id')=>{if(!sel)return;const current=sel.value;sel.innerHTML=`<option value="">${placeholder}</option>`+(items||[]).map(x=>`<option value="${esc(x[valueKey]??x.name)}">${esc(x.name)}</option>`).join('');if(current)sel.value=current};
const bind=async form=>{try{
 const globals=await getGlobals();
 const page=form.dataset.formPage;
 fill(form.querySelector('[name="factory"]'),globals.factories);
 fill(form.querySelector('[name="department"]'),globals.departments);
 fill(form.querySelector('[name="person"]'),globals.personnel,'Atanmamış');
 if(page==='inventory'||page==='stock'){
  const scope=page==='inventory'?'inventory':'stock',d=await getCatalog(scope),type=form.querySelector('[name="device_type"]'),brand=form.querySelector('[name="brand"]'),model=form.querySelector('[name="model"]');
  fill(type,d.hardware_types,'Seçiniz');
  const updateBrands=()=>{
   const tid=Number(type?.value||0),list=(d.brands||[]).filter(x=>!tid||(x.product_type_ids||[]).map(Number).includes(tid)),cur=brand?.value;
   fill(brand,list,'Önce donanım tipi');if(cur)brand.value=cur;
   updateModels();
  };
  const updateModels=()=>{if(!model)return;const tid=Number(type?.value||0),bid=Number(brand?.value||0),list=(d.models||[]).filter(x=>(!tid||Number(x.product_type_id)===tid)&&(!bid||Number(x.brand_id)===bid)),cur=model.value;fill(model,list,'Önce marka seçin');if(cur)model.value=cur};
  type?.addEventListener('change',updateBrands);brand?.addEventListener('change',updateModels);updateBrands();
 }else fill(form.querySelector('[name="license_name"]'),globals.licenses||[]);
}catch(e){console.warn('[master-data]',e)}};
document.addEventListener('shown.bs.modal',e=>{const form=e.target.querySelector('#itDynamicForm');if(form)bind(form)});
document.addEventListener('itmanager:master-ready',()=>{const form=document.querySelector('#itManagerModal #itDynamicForm');if(form)bind(form)});
})();
