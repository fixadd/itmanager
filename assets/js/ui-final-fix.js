(()=>{
'use strict';

const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

/* Inventory table currently renders .iv-eye + data-iv-id. Route to the detail screen. */
function bindInventoryEye(){
  document.querySelectorAll('#pageContent table tbody tr[data-iv-id] .iv-eye').forEach(btn=>{
    if(btn.dataset.finalEyeFix==='1') return;
    btn.dataset.finalEyeFix='1';
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      const id=btn.closest('tr')?.dataset.ivId;
      if(!id) return;
      const target=`#inventory/${encodeURIComponent(id)}`;
      if(location.hash===target) window.dispatchEvent(new HashChangeEvent('hashchange'));
      else location.hash=target;
    },true);
  });
}

let catalogPromise=null;
async function getInventoryCatalog(){
  if(!catalogPromise) catalogPromise=fetch('/api/settings/product-catalog?scope=inventory',{headers:{Accept:'application/json'}}).then(r=>{
    if(!r.ok) throw Error(`HTTP ${r.status}`);
    return r.json();
  });
  return catalogPromise;
}

/* Product master cascade: API IDs can arrive as strings or numbers. */
async function bindProductMaster(){
  const area=document.querySelector('#catalogArea');
  if(!area) return;
  try{
    const cat=await getInventoryCatalog();
    window.__itProductCatalogBrands=cat.brands||[];
  }catch(e){return}

  const type=document.querySelector('#modelType');
  const brand=document.querySelector('#modelBrand');
  if(type&&brand&&!type.dataset.finalMasterFix){
    type.dataset.finalMasterFix='1';
    const sync=()=>{
      const tid=String(type.value||'');
      const source=window.__itProductCatalogBrands||[];
      brand.innerHTML='<option value="">Marka seçin</option>'+source
        .filter(b=>!tid || (b.product_type_ids||[]).map(String).includes(tid))
        .map(b=>`<option value="${String(b.id)}">${esc(b.name)}</option>`).join('');
    };
    type.addEventListener('change',sync);
    sync();
  }

  [
    ['#catalogArea .col-xl-4:nth-child(1) .master-panel .master-list','Donanım Tipleri'],
    ['#brandList','Markalar'],
    ['#modelList','Modeller']
  ].forEach(([selector,label])=>paginateList(selector,label));

  /* Keep the department list outside its add form if the browser repaired the old
     malformed markup by nesting the list inside the form. */
  const df=document.querySelector('#phDepartmentAddForm');
  const dPanel=df?.closest('.master-panel');
  if(dPanel){
    const nested=df.querySelector('.master-list');
    if(nested){
      nested.remove();
      df.insertAdjacentElement('afterend',nested);
    }
    dPanel.querySelectorAll(':scope > .master-list').forEach(x=>{x.style.display='';});
  }
}

function paginateList(selector,label){
  const list=document.querySelector(selector);
  if(!list||list.dataset.finalPagination==='1') return;
  const rows=[...list.children].filter(x=>x.classList.contains('master-row'));
  if(rows.length<=10) return;
  list.dataset.finalPagination='1';
  let page=1;
  const pages=Math.ceil(rows.length/10);
  const controls=document.createElement('div');
  controls.className='d-flex justify-content-between align-items-center gap-2 mt-3 final-master-pagination';
  controls.innerHTML='<span class="text-secondary small final-page-info"></span><div class="d-flex gap-1"><button type="button" class="btn btn-sm btn-outline-secondary final-prev">‹ Önceki</button><button type="button" class="btn btn-sm btn-outline-secondary final-next">Sonraki ›</button></div>';
  list.insertAdjacentElement('afterend',controls);
  const render=()=>{
    rows.forEach((row,i)=>{row.hidden=i<((page-1)*10)||i>=(page*10)});
    controls.querySelector('.final-page-info').textContent=`${label}: ${page} / ${pages} · ${rows.length} kayıt`;
    controls.querySelector('.final-prev').disabled=page<=1;
    controls.querySelector('.final-next').disabled=page>=pages;
  };
  controls.querySelector('.final-prev').onclick=()=>{if(page>1){page--;render()}};
  controls.querySelector('.final-next').onclick=()=>{if(page<pages){page++;render()}};
  render();
}

const observer=new MutationObserver(()=>{
  bindInventoryEye();
  bindProductMaster();
});
observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(()=>{bindInventoryEye();bindProductMaster()},100));
setTimeout(()=>{bindInventoryEye();bindProductMaster()},300);
})();
