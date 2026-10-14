document.addEventListener('DOMContentLoaded',()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const clearActive=()=>$$('.nav-link').forEach(x=>x.classList.remove('active'));

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      $('.it-overlay,.it-popover').forEach(x=>x.remove());
    }
  });

  function escapeHtml(v){return v.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

  const knowledgeInput=$('.knowledge-search input');
  if(knowledgeInput){
    knowledgeInput.addEventListener('input',()=>{
      const q=knowledgeInput.value.toLowerCase().trim();
      $$('.knowledge-result').forEach(card=>card.style.display=(!q||card.textContent.toLowerCase().includes(q))?'':'none');
    });
  }

  const style=document.createElement('style');
  style.textContent=`html[data-bs-theme="dark"] .table{--bs-table-color:var(--text)!important;color:var(--text)!important}html[data-bs-theme="dark"] .table td,html[data-bs-theme="dark"] .table th{color:var(--text)!important}`;
  document.head.appendChild(style);
});
