(()=>{
'use strict';
async function loadHierarchy(){const r=await fetch('/api/settings/product-hierarchy',{headers:{Accept:'application/json'}});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}
function normalize(x){return {factories:x.factories||[],departments:x.departments||[],hardware_types:x.hardware_types||[],brands:x.brands||[],models:x.models||[]}}
function apply(x){const d=normalize(x);window.__IT_INV_HIERARCHY=d;localStorage.setItem('itmanager_master',JSON.stringify({factories:d.factories,departments:d.departments,inventoryTypes:d.hardware_types,brands:d.brands,models:d.models}));window.IT_MASTER_DATA={factories:d.factories,departments:d.departments,inventoryTypes:d.hardware_types,brands:d.brands,models:d.models};document.dispatchEvent(new Event('itmanager:master-ready'));return d}
async function refresh(){try{return apply(await loadHierarchy())}catch{return null}}
function wrap(){if(!window.IT_MASTER?.sync||window.IT_MASTER.__inventoryFallbackWrapped)return;const original=window.IT_MASTER.sync;window.IT_MASTER.sync=async()=>{try{await original()}catch{}const d=window.IT_MASTER_DATA||{};if(!d.inventoryTypes?.length||!d.brands?.length||!d.models?.length)await refresh();return window.IT_MASTER_DATA};window.IT_MASTER.__inventoryFallbackWrapped=true}
window.IT_INVENTORY_MASTER_REFRESH=refresh;
document.addEventListener('DOMContentLoaded',()=>{wrap();setTimeout(()=>{wrap();if(!window.IT_MASTER_DATA?.brands?.length)refresh()},0)});
})();
