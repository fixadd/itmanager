document.addEventListener('DOMContentLoaded',()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const page=()=>location.hash.replace('#','')||$('#crumb')?.dataset?.page||'';
  const recordFields=(tr)=>{
    const cells=$$('td',tr).slice(0,-1);
    const headers=tr.closest('table')?.querySelectorAll('thead th')||[];
    return cells.map((c,i)=>({label:headers[i]?.textContent?.trim()||`Alan ${i+1}`,value:c.textContent.trim()||'—'}));
  };
  const modal=(title,fields,actions=[])=>{
    document.querySelector('.it-overlay')?.remove();
    const o=document.createElement('div');o.className='it-overlay';
    o.innerHTML=`<div class="it-modal" role="dialog" aria-modal="true"><div class="it-modal-head"><div><strong>${esc(title)}</strong><div class="small text-muted">Kayıt detayları</div></div><button class="btn btn-sm btn-light" data-close><i class="ti ti-x"></i></button></div><div class="it-modal-body"><div class="it-modal-grid">${fields.map(f=>`<div><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join('')}</div>${actions.length?`<div class="it-modal-actions">${actions.map(a=>`<button class="btn ${a.class||'btn-outline-secondary'}" data-action="${esc(a.id)}"><i class="ti ti-${a.icon||'arrow-right'} me-1"></i>${esc(a.text)}</button>`).join('')}</div>`:''}</div></div>`;
    document.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o||e.target.closest('[data-close]'))o.remove()});return o;
  };
  const toast=msg=>window.itToast?window.itToast(msg):console.info(msg);
  const actionsFor=()=>{
    const p=page(), a=[{id:'edit',text:'Düzenle',icon:'pencil',class:'btn-primary'}];
    if(p.includes('inventory')) a.push({id:'assign',text:'Zimmet / Devir',icon:'transfer',class:'btn-outline-primary'},{id:'maintenance',text:'Bakım Kaydı',icon:'tool',class:'btn-outline-warning'},{id:'barcode',text:'Barkod / QR',icon:'qrcode',class:'btn-outline-secondary'});
    else if(p.includes('licenses')) a.push({id:'assign',text:'Lisans Ata',icon:'user-plus',class:'btn-outline-primary'},{id:'history',text:'Lisans Geçmişi',icon:'history',class:'btn-outline-secondary'});
    else if(p.includes('stock')) a.push({id:'out',text:'Stok Çıkışı',icon:'arrow-up-right',class:'btn-outline-primary'},{id:'history',text:'Stok Hareketleri',icon:'history',class:'btn-outline-secondary'});
    else if(p.includes('maintenance')) a.push({id:'status',text:'Durumu Güncelle',icon:'refresh',class:'btn-outline-warning'},{id:'service',text:'Servis Formu',icon:'file-text',class:'btn-outline-secondary'});
    else if(p.includes('requests')) a.push({id:'enter',text:'Cihazı Gir',icon:'device-desktop',class:'btn-success'},{id:'approve',text:'Onaya Gönder',icon:'check',class:'btn-outline-primary'});
    else if(p.includes('people')) a.push({id:'assets',text:'Zimmetleri Gör',icon:'devices',class:'btn-outline-primary'},{id:'history',text:'Personel Geçmişi',icon:'history',class:'btn-outline-secondary'});
    else if(p.includes('scrap')) a.push({id:'restore',text:'Hurda Kaydını Aç',icon:'archive',class:'btn-outline-secondary'});
    return a;
  };
  document.addEventListener('click',e=>{
    const eye=e.target.closest('.table tbody .ti-eye');
    if(!eye)return;
    e.stopImmediatePropagation();e.preventDefault();
    const tr=eye.closest('tr');const fields=recordFields(tr);const title=fields[0]?.value||fields[1]?.value||'Kayıt';
    const m=modal(title,fields,actionsFor());
    m.addEventListener('click',ev=>{const b=ev.target.closest('[data-action]');if(!b)return;m.remove();const t=b.textContent.trim();toast(`${t} işlemi açıldı.`);});
  },true);

  document.addEventListener('click',e=>{
    const primary=e.target.closest('.page-actions .btn-primary');if(!primary)return;
    const t=primary.textContent.trim();
    if(/Yeni Envanter|Yeni Lisans|Stok Girişi|Bakım Kaydı|Yeni Personel|Yeni Makale|Kullanıcı Ekle|Yeni Kayıt/i.test(t)){
      e.preventDefault();e.stopImmediatePropagation();
      const title=t||'Yeni Kayıt';
      const p=page();
      const labels=p.includes('inventory')?['Envanter No','Cihaz Tipi','Marka','Model','Seri No','Personel','Lokasyon','Durum']:p.includes('licenses')?['Yazılım','Lisans Tipi','Firma','Lisans Anahtarı','Kapasite','Bitiş Tarihi','Durum']:p.includes('stock')?['Stok No','Ürün','Kategori','Miktar','Birim','Kritik Seviye','Lokasyon','Durum']:p.includes('maintenance')?['Envanter No','Personel','Arıza','Teknisyen','Başlangıç','Sonuç','Durum']:p.includes('people')?['Ad Soyad','Sicil No','Departman','Fabrika','Pozisyon','Durum']:['Başlık','Kategori','Açıklama','Durum'];
      const fields=labels.map(x=>({label:x,value:x==='Durum'?'Yeni':'—'}));
      if(window.ITUI){ const form='<div class="row g-3">'+labels.map(x=>'<div class="col-md-6"><label class="form-label">'+esc(x)+'</label>'+(x==='Durum'?'<select class="form-select"><option>Yeni</option><option>Aktif</option></select>':'<input class="form-control" placeholder="'+esc(x)+'">')+'</div>').join('')+'</div>'; ITUI.modal(title,form,{size:p.includes('inventory')?'modal-xl':'modal-lg'}); } else { modal(title,fields,[{id:'save',text:'Kaydet',icon:'device-floppy',class:'btn-primary'},{id:'cancel',text:'Vazgeç',icon:'x',class:'btn-light'}]); }
    }
  },true);
});
