/* Stable shell navigation: admin submenu + profile lives in the sidebar. */
document.addEventListener('DOMContentLoaded',()=>{
  window.IT_NAV_GO=(page)=>{
    if(!page)return;
    const target=String(page).replace(/^#/,'');
    if(location.hash.slice(1).split('?')[0]!==target) location.hash='#'+target;
    else window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  document.addEventListener('click',e=>{
    const admin=e.target.closest('.nav-link[data-page="admin"]');
    if(admin){
      e.preventDefault();e.stopImmediatePropagation();
      const submenu=document.getElementById('adminSubmenu');
      const open=!submenu?.classList.contains('open');
      submenu?.classList.toggle('open',open);
      admin.setAttribute('aria-expanded',String(open));
      if(location.hash!=='#admin') location.hash='#admin';
      return;
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