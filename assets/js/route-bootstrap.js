(()=>{
const initialPath=window.location.pathname.replace(/^\/+|\/+$/g,'')||'dashboard';
const valid=['dashboard','barcode','inventory','licenses','stock','maintenance','requests','people','knowledge','scrap','reports','profile','admin','settings','logs'];
const pageFromPath=p=>{const m=p.match(/^([^/]+)(?:\/(\d+))?$/);return m&&valid.includes(m[1])?{page:m[1],id:m[2]||null}:null};
window.addEventListener('DOMContentLoaded',()=>{
 const adminMatch=initialPath.match(/^admin\/(users|roles|products|connections|data)$/);
 if(adminMatch){const target=adminMatch[1];setTimeout(()=>{document.querySelectorAll('.admin-submenu-link[data-admin-view]').forEach(x=>x.classList.remove('active'));const link=document.querySelector(`[data-admin-view="${target}"]`);if(link)link.classList.add('active');history.replaceState({adminView:target},'',`/admin/${target}`);if(location.hash!=='#admin')location.hash='#admin';else window.IT_ADMIN?.render?.();setTimeout(()=>link?.click(),0)},0);return;}
 const hash=location.hash.replace(/^#/,'');
 const r=pageFromPath(initialPath);
 const target=valid.includes(hash)?hash:(r?.page||'dashboard');
 setTimeout(()=>{const a=document.querySelector(`.nav-link[data-page="${target}"]`);if(a)a.click();if(r?.id&&r.page==='inventory'){let tries=0;const timer=setInterval(()=>{const row=document.querySelector(`tr[data-iv-id="${r.id}"]`);if(row){clearInterval(timer);row.querySelector('.iv-eye')?.click()}if(++tries>80)clearInterval(timer)},100)}},0);
});
})();
