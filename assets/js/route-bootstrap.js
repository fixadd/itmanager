(()=>{
'use strict';

const initialPath=window.location.pathname.replace(/^\/+|\/+$/g,'')||'dashboard';

window.addEventListener('DOMContentLoaded',()=>{
  const adminMatch=initialPath.match(/^admin\/(users|roles|products|connections|data)$/);
  if(!adminMatch)return;

  const target=adminMatch[1];
  setTimeout(()=>{
    document.querySelectorAll('.admin-submenu-link[data-admin-view]').forEach(x=>x.classList.remove('active'));
    const link=document.querySelector('[data-admin-view="'+target+'"]');
    if(link)link.classList.add('active');

    history.replaceState({adminView:target},'', '/admin/'+target);
    if(location.hash!=='#admin'){
      location.hash='#admin';
    }else{
      window.IT_ADMIN?.render?.();
    }
    setTimeout(()=>link?.click(),0);
  },0);
});
})();
