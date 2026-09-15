(()=>{
function clean(){
 if(location.hash!=='#admin')return;
 const active=document.querySelector('.admin-submenu-link.active[data-admin-view="products"]');if(!active)return;
 const oldForm=document.querySelector('#productQuickForm');
 if(oldForm){
  oldForm.closest('.card')?.remove();
  document.querySelectorAll('#pageContent .page-header').forEach(h=>{if(h.querySelector('h1')?.textContent.trim()==='Ürün Ekle')h.remove()});
 }
}
document.addEventListener('itmanager:admin-view',e=>{if(e.detail==='products'){setTimeout(clean,50);setTimeout(clean,250)}});
window.addEventListener('hashchange',()=>setTimeout(clean,100));
new MutationObserver(clean).observe(document.body,{childList:true,subtree:true});
})();
