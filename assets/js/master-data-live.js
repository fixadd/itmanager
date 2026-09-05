/* Live PostgreSQL master-data binding for add/edit forms. */
(()=>{
let cache=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const get=async()=>{if(cache)return cache;const r=await fetch('/api/master-data',{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Ana veriler alınamadı');cache=await r.json();return cache};
const fill=(sel,items,placeholder='Seçiniz',valueKey='id')=>{if(!sel)return;const current=sel.value;sel.innerHTML=`<option value="">${placeholder}</option>`+(items||[]).map(x=>`<option value="${esc(x[valueKey]??x.name)}">${esc(x.name)}</option>`).join('');if(current)sel.value=current};
const bind=async form=>{try{const d=await get();
  fill(form.querySelector('[name="factory"]'),d.factories);
  fill(form.querySelector('[name="department"]'),d.departments);
  fill(form.querySelector('[name="device_type"]'),d.hardware_types);
  fill(form.querySelector('[name="brand"]'),d.brands);
  fill(form.querySelector('[name="license_name"]'),d.licenses);
  fill(form.querySelector('[name="person"]'),d.personnel);
  const brand=form.querySelector('[name="brand"]'),model=form.querySelector('[name="model"]');
  const updateModels=()=>{if(!model)return;const bid=Number(brand?.value||0);const list=(d.models||[]).filter(x=>!bid||Number(x.brand_id)===bid);const cur=model.value;model.innerHTML='<option value="">Seçiniz</option>'+list.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');if(cur)model.value=cur};
  brand?.addEventListener('change',updateModels);updateModels();
  window.IT_MASTER_DATA=d;
}catch(e){console.warn('[master-data]',e)}};
document.addEventListener('shown.bs.modal',e=>{const form=e.target.querySelector('#itDynamicForm');if(form)bind(form)});
document.addEventListener('itmanager:master-ready',()=>{const form=document.querySelector('#itManagerModal #itDynamicForm');if(form)bind(form)});
})();
