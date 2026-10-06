document.addEventListener('DOMContentLoaded',()=>{
  const root=document.documentElement;
  const themeToggle=document.querySelector('#themeToggle');
  const applyTheme=t=>{const dark=t==='dark';root.setAttribute('data-bs-theme',dark?'dark':'light');root.classList.toggle('dark-mode',dark);document.body.classList.toggle('dark-mode',dark);const i=themeToggle?.querySelector('i');if(i)i.className=`ti ${dark?'ti-sun':'ti-moon'}`};
  let theme=localStorage.getItem('itmanager-theme')||'dark';
  if(!['dark','light'].includes(theme))theme='dark';
  applyTheme(theme);
  themeToggle?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();theme=root.classList.contains('dark-mode')?'light':'dark';localStorage.setItem('itmanager-theme',theme);applyTheme(theme)});

  const menu=document.getElementById('topUserMenu');
  document.addEventListener('click',e=>{
    const user=e.target.closest('#topUserBtn');
    if(user){
      e.preventDefault();e.stopImmediatePropagation();
      if(menu){menu.hidden=!menu.hidden;user.setAttribute('aria-expanded',String(!menu.hidden));}
      return;
    }
    const profile=e.target.closest('[data-user-menu="profile"]');
    if(profile){
      e.preventDefault();e.stopImmediatePropagation();
      if(menu)menu.hidden=true;
      if(typeof window.IT_NAV_GO==='function') window.IT_NAV_GO('profile');
      else { location.hash='#profile'; window.dispatchEvent(new HashChangeEvent('hashchange')); }
      return;
    }
    if(e.target.closest('[data-user-menu="password"]')){e.preventDefault();e.stopImmediatePropagation();if(menu)menu.hidden=true;return;}
    if(e.target.closest('[data-user-menu="logout"]')){e.preventDefault();e.stopImmediatePropagation();if(menu)menu.hidden=true;return;}
    if(!e.target.closest('.top-user-wrap')&&menu)menu.hidden=true;
  },true);
});

// Standard searchable selects for high-volume master-data fields.
// Scoped to #pageContent so SPA rendering stays fast and no global observer is used.
(function(){
  const targetSelector=[
    '#ivType','#ivBrand','#ivModel','#invType','#invBrand','#invModel',
    '#stockTypeFilter','#stockBrandFilter','#stockModelFilter',
    '#licenseNameFilter','#licenseModelFilter',
    '.inv-type','.inv-brand','.inv-model',
    '.stock-type','.stock-brand','.stock-model',
    '.license-name-select','.license-model-select',
    '[name="person"]','[name="personnel_id"]','[name="inventory_id"]','[name="stock_id"]',
    '[data-action-person]','#ivActionPerson',
    '.tr-device','.tr-brand','.tr-model','.tr-person','.tr-license_name','.tr-license_model',
    '.req-product','.req-device','.req-brand','.req-model'
  ].join(',');
  const initSelect=select=>{
    if(!select||select.dataset.searchableReady==='1'||!window.TomSelect)return;
    if(select.closest('.ts-wrapper'))return;
    select.dataset.searchableReady='1';
    const placeholder=select.dataset.placeholder||select.querySelector('option[value=""]')?.textContent||'Seçiniz';
    const ts=new TomSelect(select,{
      create:false,
      allowEmptyOption:true,
      maxOptions:80,
      placeholder,
      searchField:['text'],
      closeAfterSelect:true,
      hideSelected:false,
      dropdownParent:'body'
    });
    let syncTimer=null;
    const sync=()=>{
      clearTimeout(syncTimer);
      syncTimer=setTimeout(()=>{
        if(!document.documentElement.contains(select)){
          mo.disconnect();
          return;
        }
        try{ts.sync();}catch{}
      },40);
    };
    const mo=new MutationObserver(sync);
    mo.observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected']});
    select._itSearchObserver=mo;
    select._itSearchControl=ts;
  };
  const scan=root=>{
    if(!root?.querySelectorAll)return;
    root.querySelectorAll(targetSelector).forEach(initSelect);
  };
  document.addEventListener('DOMContentLoaded',()=>{
    scan(document.querySelector('#pageContent')||document.body);
    const root=document.querySelector('#pageContent');
    if(!root)return;
    const observer=new MutationObserver(mutations=>{
      for(const m of mutations){
        for(const n of m.addedNodes){
          if(n.nodeType===1)scan(n);
        }
      }
    });
    observer.observe(root,{childList:true,subtree:true});
  });
})();