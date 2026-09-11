(()=>{
const req=(u,o={})=>window.IT_AUTH.request(u,o);
const validViews=['users','roles','products','connections','data'];
function setActive(view){
 document.querySelectorAll('.nav-link').forEach(x=>x.classList.remove('active'));
 document.querySelectorAll('.admin-submenu-link[data-admin-view]').forEach(x=>x.classList.toggle('active',x.dataset.adminView===view));
 document.querySelector('.nav-link[data-page="admin"]')?.classList.add('active');
}
function syncAdminUrl(view){
 if(!validViews.includes(view))return;
 setActive(view);
 // Keep Admin Panel as the SPA route. The submenu selection is state, not a second top-level page.
 if(location.hash!=='#admin')location.hash='#admin';
 else window.IT_ADMIN?.render?.();
 setTimeout(()=>document.dispatchEvent(new CustomEvent('itmanager:admin-view',{detail:view})),0);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-admin-view]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();syncAdminUrl(b.dataset.adminView)},true);
window.addEventListener('popstate',()=>{
 const m=location.pathname.match(/^\/admin\/(users|roles|products|connections|data)$/);
 if(!m)return;
 history.replaceState({adminView:m[1]},'',location.pathname);
 setActive(m[1]);
 if(location.hash!=='#admin')location.hash='#admin';else window.IT_ADMIN?.render?.();
 setTimeout(()=>document.dispatchEvent(new CustomEvent('itmanager:admin-view',{detail:m[1]})),0);
});
window.IT_CATALOG_ADMIN={syncAdminUrl,request:req};
})();
