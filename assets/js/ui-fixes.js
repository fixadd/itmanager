document.addEventListener('DOMContentLoaded',()=>{
  const root=document.documentElement;
  const notificationBtn=document.querySelector('#notificationBtn');
  const themeToggle=document.querySelector('#themeToggle');
  const sidebar=document.querySelector('#sidebar');

  // Sidebar: no internal scrollbar on desktop.
  if(sidebar){
    sidebar.style.overflow='visible';
    const scroll=sidebar.querySelector('.sidebar-scroll');
    if(scroll){
      scroll.style.overflow='visible';
      scroll.style.overflowY='visible';
      scroll.style.flex='1 1 auto';
    }
  }

  // Theme: persist selection and toggle Bootstrap + application dark variables together.
  const applyTheme=(theme)=>{
    const dark=theme==='dark';
    root.setAttribute('data-bs-theme',dark?'dark':'light');
    root.classList.toggle('dark-mode',dark);
    document.body.classList.toggle('dark-mode',dark);
    if(themeToggle){
      const icon=themeToggle.querySelector('i');
      if(icon) icon.className=`ti ${dark?'ti-sun':'ti-moon'}`;
      themeToggle.setAttribute('aria-label',dark?'Açık temaya geç':'Koyu temaya geç');
      themeToggle.setAttribute('title',dark?'Açık tema':'Koyu tema');
    }
  };
  let saved=localStorage.getItem('itmanager-theme');
  if(saved!=='dark'&&saved!=='light') saved='light';
  applyTheme(saved);
  themeToggle?.addEventListener('click',e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    const next=root.classList.contains('dark-mode')?'light':'dark';
    localStorage.setItem('itmanager-theme',next);
    applyTheme(next);
  },true);

  // Notification center: deterministic toggle bound to the actual button id.
  const closeNotice=()=>document.querySelector('#itNotificationPopover')?.remove();
  const openNotice=()=>{
    closeNotice();
    const p=document.createElement('div');
    p.id='itNotificationPopover';
    p.className='it-popover';
    p.innerHTML=`<div class="it-popover-head">Bildirimler <span class="badge text-bg-danger ms-2">4</span></div>
      <div class="it-notice" data-page="maintenance"><i class="ti ti-tool text-warning"></i><div><strong>4 cihazın bakımı geldi</strong><small>Periyodik bakım · şimdi</small></div></div>
      <div class="it-notice" data-page="licenses"><i class="ti ti-license text-danger"></i><div><strong>7 lisansın süresi dolmuş</strong><small>Lisans Takip · bugün</small></div></div>
      <div class="it-notice" data-page="stock"><i class="ti ti-package text-warning"></i><div><strong>8 stok kalemi kritik seviyede</strong><small>Stok Takip · bugün</small></div></div>
      <div class="it-notice" data-page="requests"><i class="ti ti-file-invoice text-info"></i><div><strong>5 yeni satın alma talebi</strong><small>Satın Alma Talepleri · 10 dk önce</small></div></div>`;
    document.body.appendChild(p);
    p.addEventListener('click',e=>{
      const item=e.target.closest('.it-notice');
      if(!item)return;
      const page=item.dataset.page;
      closeNotice();
      document.querySelector(`.nav-link[data-page="${page}"]`)?.click();
    });
  };
  notificationBtn?.addEventListener('click',e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    const existing=document.querySelector('#itNotificationPopover');
    if(existing) closeNotice(); else openNotice();
  },true);
  document.addEventListener('click',e=>{
    const p=document.querySelector('#itNotificationPopover');
    if(p&&!p.contains(e.target)&&e.target!==notificationBtn) closeNotice();
  });
});
