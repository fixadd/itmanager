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
    // Never hide controls while authentication is intentionally bypassed for UI development.
    // The backend creates a temporary admin session in this mode.
    if(permission && !can(permission)){
      document.querySelectorAll('.page-actions .btn-primary, .page-actions .btn-outline-primary, .row-actions, .row-operation-menu').forEach(el=>{el.hidden=true});
      if(p==='settings') document.querySelectorAll('#settingsAdd,#modelAdd,[data-edit],[data-toggle],[data-model-edit]').forEach(el=>{el.hidden=true});
    } else if(permission){
      document.querySelectorAll('.page-actions .btn-primary, .page-actions .btn-outline-primary, .row-actions, .row-operation-menu').forEach(el=>{el.hidden=false});
      if(p==='settings') document.querySelectorAll('#settingsAdd,#modelAdd,[data-edit],[data-toggle],[data-model-edit]').forEach(el=>{el.hidden=false});
    }
    if(p==='admin'){
      document.querySelectorAll('[data-admin-view]').forEach(el=>{
        const required=adminPermissions[el.dataset.adminView];
        if(required) el.hidden=!can(required);
      });
    }
  }

  window.addEventListener('itmanager:auth',()=>setTimeout(apply,20));
  window.addEventListener('hashchange',()=>setTimeout(apply,100));
  document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,500));
})();
