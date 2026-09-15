(()=>{
let catalog=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
async function getCatalog(){if(catalog)return catalog;const r=await fetch('/api/settings/product-catalog?scope=inventory',{headers:{Accept:'application/json'}});if(!r.ok)throw Error('Envanter ürün kataloğu alınamadı');catalog=await r.json();return catalog}
function fill(select,items,placeholder){if(!select)return;const current=select.value;select.innerHTML=`<option value="">${placeholder}</option>`+(items||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');if(current)select.value=current}
async function bind(form){try{
 const d=await getCatalog(),type=form.querySelector('[name="device_type"]'),brand=form.querySelector('[name="brand"]'),model=form.querySelector('[name="model"]');if(!type||!brand||!model)return;
 const refreshBrands=()=>{const tid=Number(type.value||0),list=(d.brands||[]).filter(b=>!tid||(b.product_type_ids||[]).map(Number).includes(tid));const cur=brand.value;fill(brand,list,'Marka seçin');if(cur)brand.value=cur;refreshModels()};
 const refreshModels=()=>{const tid=Number(type.value||0),bid=Number(brand.value||0),list=(d.models||[]).filter(m=>(!tid||Number(m.product_type_id)===tid)&&(!bid||Number(m.brand_id)===bid));const cur=model.value;fill(model,list,'Model seçin');if(cur)model.value=cur};
 type.onchange=refreshBrands;brand.onchange=refreshModels;refreshBrands();
 }catch(e){console.warn('[inventory-scope]',e)}}
function removeRowActions(){document.querySelectorAll('#pageContent .inventory-filters').forEach(()=>document.querySelectorAll('#pageContent .row-actions').forEach(x=>x.remove()))}
const observer=new MutationObserver(()=>{removeRowActions();const add=document.querySelector('#itManagerModal #itDynamicForm[data-form-page="inventory"]');if(add&&!add.dataset.scopeFix){add.dataset.scopeFix='1';bind(add)}const edit=document.querySelector('#itManagerModal #ivEditForm');if(edit&&!edit.dataset.scopeFix){edit.dataset.scopeFix='1';bind(edit)}});
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('shown.bs.modal',e=>{const form=e.target.querySelector('#itDynamicForm[data-form-page="inventory"],#ivEditForm');if(form&&!form.dataset.scopeFix){form.dataset.scopeFix='1';bind(form)}});
window.addEventListener('hashchange',()=>setTimeout(removeRowActions,0));
})();
