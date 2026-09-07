(()=>{
const initialPath=window.location.pathname.replace(/^\/+|\/+$/g,'')||'dashboard';
const valid=['dashboard','barcode','inventory','licenses','stock','maintenance','requests','people','knowledge','scrap','reports','profile','admin','settings','logs'];
const routeFor=page=>page==='dashboard'?'/' : `/${page}`;
const pageFromPath=p=>{const m=p.match(/^([^/]+)(?:\/(\d+))?$/);return m&&valid.includes(m[1])?{page:m[1],id:m[2]||null}:null};
window.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('.nav-link[data-page]').forEach(a=>{a.setAttribute('href',routeFor(a.dataset.page));});
 document.addEventListener('click',e=>{
   const a=e.target.closest('.nav-link[data-page]');
   if(!a)return;
   const page=a.dataset.page;
   setTimeout(()=>history.replaceState({page},'',routeFor(page)),0);
 },true);
 const r=pageFromPath(initialPath);
 setTimeout(()=>{
   if(!r)return;
   const a=document.querySelector(`.nav-link[data-page="${r.page}"]`);
   if(!a)return;
   a.click();
   if(r.id&&r.page==='inventory'){
     let tries=0;
     const timer=setInterval(()=>{
       const row=document.querySelector(`tr[data-iv-id="${r.id}"]`);
       if(row){clearInterval(timer);row.querySelector('.iv-eye')?.click();}
       if(++tries>80)clearInterval(timer);
     },100);
   }
 },0);
});
})();
