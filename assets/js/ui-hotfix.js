(()=>{
'use strict';

const nativeFetch=window.fetch.bind(window);
let inventoryFetchFixed=false;

async function fetchAllInventory(input,init){
  const originalUrl=typeof input==='string'?input:input?.url||'';
  const url=new URL(originalUrl,location.href);
  if(url.pathname!=='/api/inventory')return nativeFetch(input,init);
  if(inventoryFetchFixed)return nativeFetch(input,init);
  inventoryFetchFixed=true;
  try{
    url.searchParams.set('page','1');
    url.searchParams.set('per_page','100');
    const first=await nativeFetch(url.toString(),init);
    const firstData=await first.clone().json().catch(()=>({}));
    if(!first.ok||!firstData.pagination||firstData.pagination.pages<=1)return first;
    const all=[...(firstData.items||[])];
    const pages=Number(firstData.pagination.pages)||1;
    for(let page=2;page<=pages;page++){
      const pageUrl=new URL(url.toString());
      pageUrl.searchParams.set('page',String(page));
      const r=await nativeFetch(pageUrl.toString(),init);
      if(!r.ok)break;
      const d=await r.json().catch(()=>({items:[]}));
      all.push(...(d.items||[]));
    }
    return new Response(JSON.stringify({items:all,pagination:{page:1,per_page:all.length||100,total:firstData.pagination.total??all.length,pages:1}}),{status:200,headers:{'Content-Type':'application/json'}});
  }finally{inventoryFetchFixed=false;}
}
window.fetch=fetchAllInventory;

function normalizeAdminHash(){
  if(!location.pathname.startsWith('/admin/'))return;
  if(location.hash&&location.hash!=='#admin'){
    history.replaceState({adminView:location.pathname.split('/')[2]||'products'},'',location.pathname);
    location.hash='#admin';
  }
}

function fixAdminRoute(){
  document.addEventListener('click',e=>{
    const nav=e.target.closest('.nav-link[data-page]');
    if(!nav)return;
    const page=nav.dataset.page;
    if(page!=='admin'&&location.pathname.startsWith('/admin/'))history.replaceState(null,'',location.pathname.replace(/^\/admin\/[^/]+/,'')||'/');
    if(page!=='admin')return;
    e.preventDefault();
    e.stopImmediatePropagation();
    document.querySelectorAll('.nav-link[data-page]').forEach(x=>x.classList.toggle('active',x===nav));
    history.replaceState(null,'',`${location.pathname}#admin`);
    document.querySelector('#adminSubmenu')?.classList.add('open');
    window.IT_ADMIN?.render?.();
    window.dispatchEvent(new Event('hashchange'));
  },true);
}

function fixAdminProducts(){
  document.addEventListener('click',e=>{
    const b=e.target.closest('.admin-submenu-link[data-admin-view]');
    if(!b)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const view=b.dataset.adminView;
    document.querySelectorAll('.admin-submenu-link[data-admin-view]').forEach(x=>x.classList.toggle('active',x===b));
    history.replaceState({adminView:view},'',`/admin/${view}`);
    window.IT_ADMIN?.render?.();
    window.dispatchEvent(new CustomEvent('itmanager:admin-view',{detail:view}));
  },true);
}

function fixBrandSelector(){
  const area=document.querySelector('#catalogArea');
  if(!area)return;
  const type=area.querySelector('#modelType');
  const brand=area.querySelector('#modelBrand');
  if(!type||!brand||type.dataset.hotfixBrand==='1')return;
  type.dataset.hotfixBrand='1';
  const brands=window.__itProductCatalogBrands||[];
  const matches=(b,tid)=>{
    const ids=Array.isArray(b.product_type_ids)?b.product_type_ids.map(String):[];
    if(ids.length)return ids.includes(String(tid));
    if(b.product_type_id!=null)return String(b.product_type_id)===String(tid);
    return true;
  };
  const sync=()=>{
    const tid=type.value;
    brand.innerHTML='<option value="">Marka seçin</option>'+brands.filter(b=>matches(b,tid)).map(b=>`<option value="${String(b.id)}">${String(b.name??'')}</option>`).join('');
  };
  type.addEventListener('change',sync);
  sync();
}

function fixDepartmentLayout(){
  const form=document.querySelector('#phDepartmentAddForm');
  if(!form)return;
  const col=form.closest('.col-lg-6');
  const panel=form.closest('.master-panel');
  if(!col||!panel)return;
  const list=col.querySelector(':scope > .master-list')||col.querySelector('.master-list');
  if(list&&list.parentElement!==panel)panel.appendChild(list);
  const nested=panel.querySelector('.master-list .master-list');
  if(nested)panel.appendChild(nested);
}

function clearInventoryMockRows(){
  if(location.hash!=='#inventory')return;
  document.querySelectorAll('#pageContent table tbody tr').forEach(tr=>{
    if(!tr.dataset.inventoryId)tr.remove();
  });
}

function fixInventoryEye(){
  if(location.hash!=='#inventory')return;
  document.querySelectorAll('#pageContent .row-eye').forEach(btn=>{
    if(btn.dataset.hotfixEye==='1')return;
    btn.dataset.hotfixEye='1';
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      const id=btn.closest('tr')?.dataset.inventoryId;
      if(!id)return;
      if(typeof window.__IT_OPEN_INVENTORY_DETAIL==='function')window.__IT_OPEN_INVENTORY_DETAIL(id);
      else{history.pushState({inventoryDetail:id},'',`#inventory/${encodeURIComponent(id)}`);window.dispatchEvent(new HashChangeEvent('hashchange'));}
    },true);
  });
}

function exposeDetail(){
  if(window.__IT_OPEN_INVENTORY_DETAIL)return;
  const original=window.IT_INVENTORY_SHOW_DETAIL;
  if(original)window.__IT_OPEN_INVENTORY_DETAIL=original;
}

function run(){
  normalizeAdminHash();
  clearInventoryMockRows();
  fixBrandSelector();
  fixDepartmentLayout();
  fixInventoryEye();
  exposeDetail();
}

document.addEventListener('DOMContentLoaded',()=>{fixAdminRoute();fixAdminProducts();run();setTimeout(run,250);setTimeout(run,700)});
window.addEventListener('hashchange',()=>setTimeout(run,100));
new MutationObserver(()=>run()).observe(document.body,{childList:true,subtree:true});
})();
