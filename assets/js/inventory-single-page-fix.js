(()=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const statusMap={active:['Aktif','success'],faulty:['Arızalı','danger'],maintenance:['Bakımda','warning'],it:['Bilgi İşlem','info'],scrapped:['Hurda','danger']};
const status=s=>{const a=statusMap[s]||[s||'Bilinmiyor','secondary'];return `<span class="status ${a[1]}">${esc(a[0])}</span>`};
let timer=null,loading=false;
async function getAllInventory(){
  const base=new URLSearchParams({per_page:'100'});
  const vals={search:'#invSearch',factory_id:'#invFactory',department_id:'#invDepartment',product_type_id:'#invType',brand_id:'#invBrand',model_id:'#invModel',status:'#invStatus'};
  Object.entries(vals).forEach(([k,s])=>{const v=document.querySelector(s)?.value?.trim();if(v)base.set(k,v)});
  const all=[];let page=1,totalPages=1;
  do{
    base.set('page',String(page));
    const r=await fetch('/api/inventory?'+base.toString(),{headers:{Accept:'application/json'}});
    if(!r.ok)throw Error(`HTTP ${r.status}`);
    const d=await r.json();
    all.push(...(d.items||[]));
    totalPages=Number(d.pagination?.pages||1);
    page++;
  }while(page<=totalPages);
  return all;
}
function row(x){
  const tr=document.createElement('tr');
  tr.dataset.recordType='inventory';
  tr.dataset.inventoryId=x.id;
  tr.innerHTML=`<td><strong>${esc(x.inventory_no)}</strong></td><td>${esc(x.device_type?.name||'—')}</td><td>${esc([x.brand?.name,x.model?.name].filter(Boolean).join(' ')||'—')}</td><td>${esc(x.serial_no||'—')}</td><td>${esc(x.personnel?.name||'—')}</td><td>${esc(x.factory?.name||'—')}</td><td>${status(x.status)}</td><td class="action-cell"><button type="button" class="btn btn-sm btn-light row-eye" title="Cihazı Görüntüle"><i class="ti ti-eye"></i></button><button type="button" class="btn btn-sm btn-light ms-1 row-actions" title="İşlemler"><i class="ti ti-adjustments-horizontal me-1"></i>İşlemler</button></td>`;
  return tr;
}
async function render(){
  if(location.hash!=='#inventory'||loading)return;
  const panel=document.querySelector('#pageContent .panel');
  const tb=panel?.querySelector('tbody');
  if(!tb)return;
  loading=true;
  try{
    const items=await getAllInventory();
    if(location.hash!=='#inventory')return;
    tb.innerHTML='';
    items.forEach(x=>tb.appendChild(row(x)));
    const p=panel.querySelector('.panel-head p');
    if(p)p.textContent=`PostgreSQL · ${items.length} kayıt`;
    panel.querySelectorAll('.inventory-single-page-pagination').forEach(x=>x.remove());
  }catch(e){console.error('[inventory-single-page-fix]',e)}
  finally{loading=false}
}
function schedule(){clearTimeout(timer);timer=setTimeout(render,180)}
window.addEventListener('hashchange',schedule);
document.addEventListener('click',e=>{
  if(location.hash!=='#inventory')return;
  if(e.target.closest('#invFilterBtn,#invClearBtn'))schedule();
},true);
new MutationObserver(()=>{if(location.hash==='#inventory')schedule()}).observe(document.body,{childList:true,subtree:true});
setTimeout(schedule,350);
})();
