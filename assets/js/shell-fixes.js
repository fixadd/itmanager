/* Stable shell navigation: single source of truth for sidebar active state. */
document.addEventListener('DOMContentLoaded',()=>{
  const getHashPage=()=>location.hash.slice(1).split('?')[0]||'dashboard';
  const getAdminView=()=>{
    const q=location.hash.split('?')[1]||'';
    return new URLSearchParams(q).get('view')||null;
  };

  const syncSidebarState=()=>{
    const page=getHashPage();
    const adminView=getAdminView();
    const links=document.querySelectorAll('.sidebar .nav-link[data-page]');
    const adminLinks=document.querySelectorAll('.admin-submenu-link[data-admin-view]');
    const submenu=document.getElementById('adminSubmenu');
    const admin=document.querySelector('.nav-link[data-page="admin"]');

    links.forEach(link=>link.classList.remove('active'));
    adminLinks.forEach(link=>link.classList.remove('active'));

    if(page==='admin' && adminView){
      const selected=document.querySelector(`.admin-submenu-link[data-admin-view="${CSS.escape(adminView)}"]`);
      selected?.classList.add('active');
      submenu?.classList.add('open');
      admin?.setAttribute('aria-expanded','true');
      admin?.classList.remove('active');
    }else{
      document.querySelector(`.nav-link[data-page="${CSS.escape(page)}"]`)?.classList.add('active');
      if(page==='admin'){
        submenu?.classList.add('open');
        admin?.classList.add('active');
        admin?.setAttribute('aria-expanded','true');
      }else{
        submenu?.classList.remove('open');
        admin?.setAttribute('aria-expanded','false');
      }
    }
  };

  window.IT_NAV_SYNC=syncSidebarState;
  window.IT_NAV_GO=(page)=>{
    if(!page)return;
    const target=String(page).replace(/^#/,'');
    if(location.hash.slice(1).split('?')[0]!==target || target!=='admin') location.hash='#'+target;
    else window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  window.addEventListener('hashchange',syncSidebarState);
  syncSidebarState();

  document.addEventListener('click',e=>{
    const admin=e.target.closest('.nav-link[data-page="admin"]');
    if(admin){
      e.preventDefault();e.stopImmediatePropagation();
      const submenu=document.getElementById('adminSubmenu');
      const alreadyOpen=submenu?.classList.contains('open');
      if(alreadyOpen && getHashPage()==='admin'){
        location.hash='#admin';
      }else{
        location.hash='#admin';
      }
      syncSidebarState();
      return;
    }

    const adminView=e.target.closest('.admin-submenu-link[data-admin-view]');
    if(adminView){
      e.preventDefault();
      e.stopImmediatePropagation();
      const view=adminView.dataset.adminView;
      location.hash=`#admin?view=${encodeURIComponent(view)}`;
      syncSidebarState();
      return;
    }

    const normal=e.target.closest('.nav-link[data-page]');
    if(normal && normal.dataset.page!=='admin'){
      document.getElementById('adminSubmenu')?.classList.remove('open');
      document.querySelector('.nav-link[data-page="admin"]')?.setAttribute('aria-expanded','false');
      document.querySelectorAll('.admin-submenu-link').forEach(x=>x.classList.remove('active'));
      setTimeout(syncSidebarState,0);
    }

    const profile=e.target.closest('[data-user-menu="profile"]');
    if(profile){
      e.preventDefault();e.stopImmediatePropagation();
      const sidebarProfile=document.querySelector('.nav-link[data-page="profile"]');
      if(sidebarProfile) sidebarProfile.click();
      else window.IT_NAV_GO('profile');
      return;
    }
  },true);
});