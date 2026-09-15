(()=>{
'use strict';

/* Inventory: the current table uses .iv-eye + data-iv-id. Route directly to the detail hash. */
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

/* Product master: normalize ID comparisons so string/number API values do not hide brands. */
function bindProductMaster(){
  const area=document.querySelector('#catalogArea');
  if(!area) return;

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

  const lists=[
    ['#catalogArea .col-xl-4:nth-child(1) .master-panel .master-list','Donanım Tipleri'],
    ['#brandList','Markalar'],
    ['#modelList','Modeller']
  ];
  lists.forEach(([selector,label])=>paginateList(selector,label));

  /* The department form markup previously had an extra closing div. If the browser
     placed the department list inside the form, move it back into the panel. */
  const df=document.querySelector('#phDepartmentAddForm');
  const dPanel=df?.closest('.master-panel');
  const dList=df?.querySelector('.master-list');
  if(dPanel&&dList){
    dList.remove();
    df.insertAdjacentElement('afterend',dList);
  }
}

function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}

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
  controls.innerHTML=`<span class="text-secondary small final-page-info"></span><div class="d-flex gap-1"><button type="button" class="btn btn-sm btn-outline-secondary final-prev">‹</button><button type="button" class="btn btn-sm btn-outline-secondary final-next">›</button></div>`;
  list.insertAdjacentElement('afterend',controls);
  const render=()=>{
    rows.forEach((row,i)=>row.hidden=i<((page-1)*10)||i>=(page*10));
    controls.querySelector('.final-page-info').textContent=`${label}: ${page} / ${pages} · ${rows.length} kayıt`;
    controls.querySelector('.final-prev').disabled=page<=1;
    controls.querySelector('.final-next').disabled=page>=pages;
  };
  controls.querySelector('.final-prev').onclick=()=>{if(page>1){page--;render()}};
  controls.querySelector('.final-next').onclick=()=>{if(page<pages){page++;render()}};
  render();
}

/* Capture catalog data already loaded by the product admin script when possible. */
const observer=new MutationObserver(()=>{
  const area=document.querySelector('#catalogArea');
  if(!area) return;
  try{
    if(!window.__itProductCatalogBrands){
      const addBrand=document.querySelector('#addBrandForm');
      const select=addBrand?.querySelector('select[name="product_type_id"]');
      const typeOptions=[...(select?.options||[])].filter(o=>o.value).map(o=>({id:o.value,name:o.textContent}));
      /* Re-read brand relationships from the model selector only when available is not
         possible; the original handler remains active. This variable is populated below. */
      window.__itProductCatalogBrands=window.__itProductCatalogBrands||[];
    }
  }catch(e){}
  bindProductMaster();
  bindInventoryEye();
});
observer.observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',()=>{bindInventoryEye();bindProductMaster()},true);
window.addEventListener('hashchange',()=>setTimeout(()=>{bindInventoryEye();bindProductMaster()},100));
setTimeout(()=>{bindInventoryEye();bindProductMaster()},300);
})();
