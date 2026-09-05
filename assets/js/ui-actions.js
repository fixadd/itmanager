document.addEventListener('DOMContentLoaded',()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const page=()=>location.hash.replace('#','')||$('#crumb')?.dataset?.page||'';
  const esc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]));
  const recordFields=tr=>{const cells=[...tr.querySelectorAll('td')].slice(0,-1),headers=tr.closest('table')?.querySelectorAll('thead th')||[];return cells.map((c,i)=>({label:headers[i]?.textContent?.trim()||`Alan ${i+1}`,value:c.textContent.trim()||'—'}));};
  const modal=(title,fields,actions=[])=>{document.querySelector('.it-overlay')?.remove();const o=document.createElement('div');o.className='it-overlay';o.innerHTML=`<div class="it-modal" role="dialog" aria-modal="true"><div class="it-modal-head"><div><strong>${esc(title)}</strong><div class="small text-muted">Kayıt detayları</div></div><button class="btn btn-sm btn-light" data-close><i class="ti ti-x"></i></button></div><div class="it-modal-body"><div class="it-modal-grid">${fields.map(f=>`<div><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join('')}</div>${actions.length?`<div class="it-modal-actions">${actions.map(a=>`<button class="btn ${a.class||'btn-outline-secondary'}" data-action="${esc(a.id)}"><i class="ti ti-${a.icon||'arrow-right'} me-1"></i>${esc(a.text)}</button>`).join('')}</div>`:''}</div></div>`;document.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o||e.target.closest('[data-close]'))o.remove()});return o;};
  const toast=msg=>window.itToast?window.itToast(msg):console.info(msg);
  const actionsFor=()=>{const p=page(),a=[{id:'edit',text:'Düzenle',icon:'pencil',class:'btn-primary'}];if(p.includes('inventory'))a.push({id:'assign',text:'Zimmet / Devir',icon:'transfer',class:'btn-outline-primary'},{id:'maintenance',text:'Bakım Kaydı',icon:'tool',class:'btn-outline-warning'},{id:'barcode',text:'Barkod / QR',icon:'qrcode',class:'btn-outline-secondary'});else if(p.includes('licenses'))a.push({id:'assign',text:'Lisans Ata',icon:'user-plus',class:'btn-outline-primary'},{id:'history',text:'Lisans Geçmişi',icon:'history',class:'btn-outline-secondary'});else if(p.includes('stock'))a.push({id:'out',text:'Stok Çıkışı',icon:'arrow-up-right',class:'btn-outline-primary'},{id:'history',text:'Stok Hareketleri',icon:'history',class:'btn-outline-secondary'});return a;};
  document.addEventListener('click',e=>{
    const eye=e.target.closest('.table tbody .ti-eye');
    if(!eye || eye.closest('tr[data-record-type="inventory"]')) return;
    e.stopImmediatePropagation();e.preventDefault();
    const tr=eye.closest('tr'),fields=recordFields(tr),title=fields[0]?.value||fields[1]?.value||'Kayıt',m=modal(title,fields,actionsFor());
    m.addEventListener('click',ev=>{const b=ev.target.closest('[data-action]');if(!b)return;m.remove();toast(`${b.textContent.trim()} işlemi açıldı.`);});
  },true);
  document.addEventListener('click',e=>{
    const primary=e.target.closest('.page-actions .btn-primary');
    if(!primary)return;
    if(primary.closest('#pageContent')&&page()==='inventory') return;
    const t=primary.textContent.trim();
    const matched=/Yeni Envanter|Yeni Lisans|Stok Girişi|Yeni Talep|Yeni Satın Alma Talebi|Bakım Kaydı|Yeni Personel|Yeni Makale|Kullanıcı Ekle|Yeni Kayıt/i.test(t);
    if(!matched)return;
    e.preventDefault();e.stopImmediatePropagation();
    const p=page(),title=t||'Yeni Kayıt';
    if(window.ITUI&&window.IT_FORM_RENDER&&['inventory','licenses','stock','requests','knowledge'].includes(p)){ITUI.modal(title,IT_FORM_RENDER(p,title),{size:p==='inventory'?'modal-xl':'modal-lg'});return;}
    const labels=p.includes('licenses')?['Lisans Adı','Lisans Anahtarı','E-posta','Şifre','Not']:p.includes('stock')?['Donanım Tipi','Marka','Model','Miktar','Not']:p.includes('requests')?['Sipariş No','Talep Sahibi','Ürün Tipi','Donanım Tipi','Miktar','Marka','Model','Açıklama']:p.includes('people')?['Ad Soyad','Sicil No','Departman','Fabrika','Pozisyon','Durum']:['Başlık','Kategori','Açıklama','Durum'];
    const form='<div class="row g-3">'+labels.map(x=>'<div class="col-md-6"><label class="form-label">'+esc(x)+'</label><input class="form-control" placeholder="'+esc(x)+'"></div>').join('')+'</div>';
    if(window.ITUI)ITUI.modal(title,form,{size:'modal-lg'});else modal(title,labels.map(x=>({label:x,value:x==='Durum'?'Yeni':'—'})),[{id:'save',text:'Kaydet',icon:'device-floppy',class:'btn-primary'}]);
  },true);
});