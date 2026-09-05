/* Global SPA navigation guard: every sidebar item owns its own hash route. */
(()=>{
  const allowed=new Set(['dashboard','barcode','inventory','licenses','stock','maintenance','requests','people','knowledge','scrap','reports','profile','admin','settings','logs']);
  function go(page){
    if(!allowed.has(page)) return;
    const target='#'+page;
    if(location.hash!==target) location.hash=page;
    else window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  document.addEventListener('click',e=>{
    const link=e.target.closest('a.nav-link[data-page]');
    if(!link) return;
    const page=link.dataset.page;
    if(!allowed.has(page)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    go(page);
  },true);
  window.addEventListener('hashchange',()=>{
    const page=location.hash.slice(1)||'dashboard';
    document.querySelectorAll('a.nav-link[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page===page));
    const crumb=document.querySelector('#crumb');
    const active=document.querySelector(`a.nav-link[data-page="${page}"] span`);
    if(crumb&&active) crumb.textContent=active.textContent.trim();
    window.scrollTo({top:0,left:0,behavior:'instant'});
  });
})();
