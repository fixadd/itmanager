(function () {
  const API='/api';
  let me=null;
  async function request(url,options={}){const headers={...(options.headers||{})};if(!(options.body instanceof FormData))headers["Content-Type"]="application/json";const res=await fetch(API+url,{credentials:'same-origin',headers,...options});let data={};try{data=await res.json()}catch(_){}if(!res.ok)throw new Error(data.detail||data.error||'İşlem başarısız.');return data}
  function initials(name){return String(name||'IT').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'IT'}
  function syncUser(user){const next=user||null;const changed=JSON.stringify(me)!==JSON.stringify(next);me=next;if(!me){window.IT_AUTH_USER=null;return}const btn=document.getElementById('topUserBtn');if(!btn)return;const spans=btn.querySelectorAll('span'),avatar=btn.querySelector('.avatar');if(avatar)avatar.textContent=initials(me.personnel?.name||me.username);if(spans[1]){const strong=spans[1].querySelector('strong'),small=spans[1].querySelector('small');if(strong)strong.textContent=me.personnel?.name||me.username||'Kullanıcı';if(small)small.textContent=me.role?.name||'Yetkisiz rol'}window.IT_AUTH_USER=me;if(changed)window.dispatchEvent(new CustomEvent('itmanager:auth',{detail:me}))}
  async function init(){try{const d=await request('/auth/me');syncUser(d.user);return true}catch(_){syncUser(null);return false}}
  async function logout(){try{await request('/auth/logout',{method:'POST'})}catch(_){}me=null;window.IT_AUTH_USER=null;window.location.replace(window.location.pathname+window.location.search+'#login');window.location.reload()}
  document.addEventListener('click',e=>{const item=e.target.closest('[data-user-menu]');if(!item)return;if(item.dataset.userMenu==='logout')logout();if(item.dataset.userMenu==='profile'||item.dataset.userMenu==='password')window.location.hash='#profile'});
  async function login(username,password,provider='local'){const endpoint=provider==='ad'?'/auth/ad-login':'/auth/login';const result=await request(endpoint,{method:'POST',body:JSON.stringify({username,password})});syncUser(result.user);return result.user}
  async function validateSession(){if(!me)return;try{const d=await request('/auth/me');if(d.user)syncUser(d.user)}catch(_){me=null;window.IT_AUTH_USER=null;window.location.reload()}}
  window.addEventListener('focus',validateSession);
  window.setInterval(validateSession,30000);
  window.IT_AUTH={request,login,logout,getUser:()=>me,init};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();