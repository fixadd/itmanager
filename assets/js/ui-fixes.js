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