(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
let catalogPromise=null;
async function catalog(){if(!catalogPromise)catalogPromise=fetch('/api/settings/product-catalog?scope=inventory',{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():Promise.reject(new Error('inventory catalog')));return catalogPromise}
function bind(form){const type=form?.querySelector('.inv-type');const brand=form?.querySelector('.inv-brand');const model=form?.querySelector('.inv-model');if(!type||!brand||!model||form.dataset.cascadeBound)return;form.dataset.cascadeBound='1';
 const refresh=async()=>{try{const d=await catalog();const t=(d.hardware_types||[]).find(x=>String(x.id)===String(type.value)||String(x.name)===String(type.value));const brands=(d.brands||[]).filter(b=>(b.product_type_ids||[]).map(String).includes(String(t?.id)));brand.innerHTML='<option value="">Marka seçiniz</option>'+brands.map(b=>`<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');brand.disabled=!type.value;model.innerHTML='<option value="">Önce marka seçin</option>';model.disabled=true}catch(e){console.error('Inventory cascade:',e)}};
 type.addEventListener('change',refresh);brand.addEventListener('change',async()=>{try{const d=await catalog();const t=(d.hardware_types||[]).find(x=>String(x.id)===String(type.value)||String(x.name)===String(type.value));const b=(d.brands||[]).find(x=>String(x.name)===String(brand.value)||String(x.id)===String(brand.value));const models=(d.models||[]).filter(m=>m.active!==false&&String(m.brand_id)===String(b?.id)&&(!t||String(m.product_type_id)===String(t.id)));model.innerHTML='<option value="">Model seçiniz</option>'+models.map(m=>`<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');model.disabled=!brand.value}catch(e){console.error('Inventory model cascade:',e)}});
 refresh();}
function scan(){document.querySelectorAll('#itDynamicForm[data-form-page="inventory"]').forEach(bind)}
document.addEventListener('DOMContentLoaded',scan);document.addEventListener('click',()=>setTimeout(scan,50));document.addEventListener('itmanager:master-ready',scan);new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
})();
