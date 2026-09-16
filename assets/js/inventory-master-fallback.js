(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
async function loadHierarchy(){const r=await fetch('/api/settings/product-hierarchy',{headers:{Accept:'application/json'}});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}
function normalize(x){return {factories:x.factories||[],departments:x.departments||[],hardware_types:x.hardware_types||[],brands:x.brands||[],models:x.models||[]}}
function apply(d){window.__IT_INV_HIERARCHY=normalize(d);localStorage.setItem('itmanager_master',JSON.stringify({factories:d.factories||[],departments:d.departments||[],inventoryTypes:d.hardware_types||[],brands:d.brands||[],models:d.models||[]}));window.IT_MASTER_DATA={factories:d.factories||[],departments:d.departments||[],inventoryTypes:d.hardware_types||[],brands:d.brands||[],models:d.models||[]};document.dispatchEvent(new Event('itmanager:master-ready'))}
async function refresh(){try{const h=normalize(await loadHierarchy());const old=window.IT_MASTER_DATA||{};if(!old.inventoryTypes?.length||!old.brands?.length||!old.models?.length)apply(h);return h}catch{return null}}
window.IT_INVENTORY_MASTER_REFRESH=refresh;
document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,0));
})();
