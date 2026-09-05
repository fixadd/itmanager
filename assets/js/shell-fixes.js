document.addEventListener('DOMContentLoaded',()=>{
  document.addEventListener('click',e=>{
    const profile=e.target.closest('[data-user-menu="profile"]');
    if(profile){
      e.preventDefault(); e.stopImmediatePropagation();
      const a=document.querySelector('.nav-link[data-page="profile"]');
      if(a){ a.click(); }
      return;
    }
    const admin=e.target.closest('.nav-link[data-page="admin"]');
    if(admin && !admin.dataset.shellHandled){
      e.preventDefault(); e.stopImmediatePropagation();
      const submenu=document.getElementById('adminSubmenu');
      const open=!submenu?.classList.contains('open');
      submenu?.classList.toggle('open',open);
      admin.setAttribute('aria-expanded',String(open));
      admin.dataset.shellHandled='1';
      admin.click();
      delete admin.dataset.shellHandled;
      return;
    }
  },true);
});