document.addEventListener('DOMContentLoaded',()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const clearActive=()=>$$('.nav-link').forEach(x=>x.classList.remove('active'));

  document.addEventListener('click',e=>{
    const global=e.target.closest('.nav-link[data-page="global"]');
    if(global){
      e.preventDefault(); e.stopImmediatePropagation();
      clearActive(); global.classList.add('active');
      const input=$('.global-search input');
      if(input){ input.focus(); input.select(); }
      const crumb=$('#crumb'); if(crumb) crumb.textContent='Global Arama';
      return;
    }

    const report=e.target.closest('.report-link');
    if(report){
      setTimeout(()=>{
        clearActive(); report.classList.add('active');
        const title=report.querySelector('span')?.textContent?.trim()||'Rapor Merkezi';
        const crumb=$('#crumb'); if(crumb) crumb.textContent=title;
        const h=$('.page-head h1'); if(h) h.textContent=title;
        const p=$('.page-head p'); if(p) p.textContent='Seçilen rapor için özet, filtre ve dışa aktarma ekranı.';
      },0);
    }

    const barcodeButton=e.target.closest('.barcode-search button');
    if(barcodeButton) runBarcode();
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      $$('.it-overlay,.it-popover').forEach(x=>x.remove());
    }
    if(e.key==='Enter' && e.target.closest('.barcode-search')){
      e.preventDefault(); runBarcode();
    }
  });

  function runBarcode(){
    const input=$('.barcode-search input'); if(!input) return;
    const q=input.value.trim()||'BLN-IT-1024';
    let result=$('.barcode-result');
    if(!result){
      result=document.createElement('div'); result.className='panel barcode-result mt-3';
      const hero=$('.barcode-hero'); hero?.insertAdjacentElement('afterend',result);
    }
    result.innerHTML=`<div class="panel-head"><div><h3>Bulunan Cihaz</h3><p>Arama: <strong>${escapeHtml(q)}</strong></p></div><span class="status success">Aktif</span></div><div class="detail-grid"><div><span>Envanter No</span><strong>BLN-IT-1024</strong></div><div><span>Seri No</span><strong>ABC123456</strong></div><div><span>Marka / Model</span><strong>Dell Latitude 5440</strong></div><div><span>Cihaz Tipi</span><strong>Laptop</strong></div><div><span>Personel</span><strong>Ahmet Yılmaz</strong></div><div><span>Lokasyon</span><strong>Merkez / Bilgi İşlem</strong></div></div><div class="quick-actions mt-3"><button class="btn btn-primary">Detayı Aç</button><button class="btn btn-outline-secondary">Zimmet</button><button class="btn btn-outline-secondary">Bakım Kaydı</button><button class="btn btn-outline-secondary">Devir</button></div>`;
  }

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
