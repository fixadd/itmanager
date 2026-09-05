(()=>{
  const permissionByPage={
    inventory:'inventory.manage',licenses:'licenses.manage',stock:'stock.manage',maintenance:'maintenance.manage',
    requests:'requests.manage',people:'people.manage',knowledge:'knowledge.manage',scrap:'scrap.manage',
    settings:'settings.manage',reports:'reports.view',logs:'logs.view'
  };
  const adminPermissions={users:'users.manage',roles:'roles.manage',products:'settings.manage',connections:'settings.manage',data:'settings.manage'};

  const can=p=>(window.IT_AUTH_USER?.permissions||[]).includes(p);
  const page=()=>location.hash.replace('#','').split('?')[0]||'dashboard';

  function apply(){
    const p=page(), permission=permissionByPage[p];
    if(permission && !can(permission)){
      document.querySelectorAll('.page-actions .btn-primary, .page-actions .btn-outline-primary, .row-actions, .row-operation-menu').forEach(el=>{
        el.hidden=true;
      });
      if(p==='settings') document.querySelectorAll('#settingsAdd,#modelAdd,[data-edit],[data-toggle],[data-model-edit]').forEach(el=>el.hidden=true);
    }
    if(p==='admin'){
      document.querySelectorAll('[data-admin-view]').forEach(el=>{
        const required=adminPermissions[el.dataset.adminView];
        if(required && !can(required)) el.hidden=true;
      });
    }
  }

  window.addEventListener('itmanager:auth',apply);
  window.addEventListener('hashchange',()=>setTimeout(apply,120));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,350));
  new MutationObserver(()=>apply()).observe(document.body,{childList:true,subtree:true});
})();
