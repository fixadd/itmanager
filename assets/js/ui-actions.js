document.addEventListener('DOMContentLoaded',()=>{
  const page=()=>location.hash.slice(1).split('?')[0]||'dashboard';

  // Module files own row/detail/action behavior. This shell file only handles
  // cross-page actions that are not tied to a specific database record.
  document.addEventListener('click',e=>{
    const master=e.target.closest('.master-setting .btn');
    if(master){
      e.preventDefault();
      e.stopImmediatePropagation();
      const label=master.textContent.trim();
      if(window.IT_MASTER?.openEditor){window.IT_MASTER.openEditor(label);}
      return;
    }

    const adminManage=e.target.closest('.panel .btn');
    if(adminManage && adminManage.textContent.trim()==='Yönet'){
      location.hash='settings';
    }
  },true);

  document.addEventListener('click',e=>{
    const b=e.target.closest('.page-actions .btn-primary');
    if(!b)return;
    const p=page();
    if(!['inventory','licenses','stock','maintenance','requests','people','knowledge'].includes(p))return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if(window.ITUI && window.IT_FORM_RENDER){
      window.ITUI.modal(b.textContent.trim(),window.IT_FORM_RENDER(p),{size:p==='inventory'?'modal-xl':'modal-lg'});
    }
  },true);
});
