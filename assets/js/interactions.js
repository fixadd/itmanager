document.addEventListener('DOMContentLoaded',()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const content=$('#pageContent');
  const toast=(message,type='info')=>{
    let host=$('#toastHost');
    if(!host){host=document.createElement('div');host.id='toastHost';host.style.cssText='position:fixed;right:20px;bottom:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;max-width:380px';document.body.appendChild(host)}
    const el=document.createElement('div');
    el.style.cssText='background:var(--panel,#fff);color:var(--text,#1e293b);border:1px solid var(--border,#e2e8f0);box-shadow:0 12px 30px rgba(15,23,42,.16);border-radius:12px;padding:12px 15px;font-size:14px;display:flex;align-items:center;gap:10px;animation:itToastIn .2s ease';
    el.innerHTML=`<i class="ti ${type==='success'?'ti-circle-check':type==='danger'?'ti-alert-triangle':'ti-info-circle'}"></i><span>${message}</span>`;
    host.appendChild(el);setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(6px)';setTimeout(()=>el.remove(),180)},2600);
  };
  const style=document.createElement('style');style.textContent='@keyframes itToastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.it-overlay{position:fixed;inset:0;background:rgba(2,6,23,.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px}.it-modal{width:min(760px,100%);max-height:88vh;overflow:auto;background:var(--panel,#fff);color:var(--text,#1e293b);border:1px solid var(--border,#e2e8f0);border-radius:16px;box-shadow:0 24px 70px rgba(2,6,23,.3)}.it-modal-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border,#e2e8f0)}.it-modal-body{padding:20px}.it-modal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.it-modal-grid div{padding:12px;border:1px solid var(--border,#e2e8f0);border-radius:10px;background:var(--panel2,#f8fafc)}.it-modal-grid span{display:block;color:var(--muted,#64748b);font-size:12px;margin-bottom:4px}.it-modal-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.it-popover{position:fixed;right:20px;top:68px;width:min(390px,calc(100vw - 32px));z-index:9997;background:var(--panel,#fff);color:var(--text,#1e293b);border:1px solid var(--border,#e2e8f0);border-radius:14px;box-shadow:0 18px 50px rgba(2,6,23,.18);overflow:hidden}.it-popover-head{padding:14px 16px;border-bottom:1px solid var(--border,#e2e8f0);font-weight:700}.it-notice{padding:13px 16px;display:flex;gap:10px;border-bottom:1px solid var(--border,#e2e8f0);cursor:pointer}.it-notice:hover{background:var(--panel2,#f8fafc)}.it-notice small{display:block;color:var(--muted,#64748b);margin-top:3px}.it-search-results{position:absolute;top:calc(100% + 8px);left:0;right:0;background:var(--panel,#fff);border:1px solid var(--border,#e2e8f0);border-radius:12px;box-shadow:0 16px 40px rgba(2,6,23,.18);overflow:hidden;z-index:1000}.it-search-result{padding:11px 14px;cursor:pointer;border-bottom:1px solid var(--border,#e2e8f0)}.it-search-result:hover{background:var(--panel2,#f8fafc)}.it-search-result strong{display:block}.it-search-result span{font-size:12px;color:var(--muted,#64748b)}@media(max-width:600px){.it-modal-grid{grid-template-columns:1fr}.it-popover{right:10px;top:62px}}';document.head.appendChild(style);

  const route=(page)=>{const link=$(`.nav-link[data-page="${page}"]`);if(link)link.click();else toast('Bu ekran prototipte henüz tanımlı değil.','danger')};
  const modal=(title,body,actions='')=>{document.querySelector('.it-overlay')?.remove();const o=document.createElement('div');o.className='it-overlay';o.innerHTML=`<div class="it-modal" role="dialog"><div class="it-modal-head"><strong>${title}</strong><button class="btn btn-sm btn-light" data-close-modal><i class="ti ti-x"></i></button></div><div class="it-modal-body">${body}${actions?`<div class="it-modal-actions">${actions}</div>`:''}</div></div>`;document.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o||e.target.closest('[data-close-modal]'))o.remove()});return o};

  // Global search: personnel, inventory, serial, barcode, stock, license, request and maintenance samples.
  const searchData=[
    ['BLN-IT-1024','Envanter · Dell Latitude 5440','inventory'],['ABC123456','Seri No · Dell Latitude 5440','inventory'],['Ahmet Yılmaz','Personel · 3 envanter / 3 lisans','people'],['BLN-MN-0385','Envanter · Dell P2422H','inventory'],['STK-MOU-001','Stok · Kablosuz Mouse · 48 adet','stock'],['Microsoft 365','Lisans · 50 koltuk / 42 kullanım','licenses'],['TLP-2026-0012','Talep · Dell Latitude 5550 · İşlemde','requests'],['Kyocera M5526','Bakım · Serviste · ABC Teknik','maintenance'],['Toner değiştirme','Bilgi Bankası · Yazıcı','knowledge']
  ];
  const gs=$('.global-search');const gi=gs?.querySelector('input');
  if(gs&&gi){gs.style.position='relative';let box;
    const show=()=>{const q=gi.value.trim().toLocaleLowerCase('tr');if(q.length<2){box?.remove();return}const hits=searchData.filter(x=>x.join(' ').toLocaleLowerCase('tr').includes(q)).slice(0,7);if(!hits.length){box?.remove();return}box=document.createElement('div');box.className='it-search-results';box.innerHTML=hits.map((x,i)=>`<div class="it-search-result" data-search-index="${i}"><strong>${x[0]}</strong><span>${x[1]}</span></div>`).join('');gs.appendChild(box);box.addEventListener('click',e=>{const r=e.target.closest('[data-search-index]');if(!r)return;const hit=hits[+r.dataset.searchIndex];gi.value=hit[0];box.remove();route(hit[2]);toast(`${hit[0]} için ilgili modül açıldı.`,'success')})};
    gi.addEventListener('input',show);gi.addEventListener('keydown',e=>{if(e.key==='Enter'){const q=gi.value.trim();if(q){const hit=searchData.find(x=>x.join(' ').toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')));if(hit){route(hit[2]);toast(`${hit[0]} için sonuç bulundu.`,'success')}else toast('Kayıt bulunamadı.','danger')}}});document.addEventListener('click',e=>{if(box&&!gs.contains(e.target))box.remove()});
  }

  // Notification center.
  const bell=$('.top-actions .icon-btn.position-relative');
  bell?.addEventListener('click',e=>{e.stopPropagation();document.querySelector('.it-popover')?.remove();const p=document.createElement('div');p.className='it-popover';p.innerHTML='<div class="it-popover-head">Bildirimler <span class="badge text-bg-danger ms-2">4</span></div><div class="it-notice" data-notice="maintenance"><i class="ti ti-tool text-warning"></i><div><strong>4 cihazın bakımı geldi</strong><small>Periyodik bakım · şimdi</small></div></div><div class="it-notice" data-notice="licenses"><i class="ti ti-license text-danger"></i><div><strong>7 lisansın süresi dolmuş</strong><small>Lisans Takip · bugün</small></div></div><div class="it-notice" data-notice="stock"><i class="ti ti-package text-warning"></i><div><strong>8 stok kalemi kritik seviyede</strong><small>Stok Takip · bugün</small></div></div><div class="it-notice" data-notice="requests"><i class="ti ti-ticket text-info"></i><div><strong>5 yeni talep var</strong><small>Talep Takip · 10 dk önce</small></div></div>';document.body.appendChild(p);p.addEventListener('click',ev=>{const n=ev.target.closest('[data-notice]');if(!n)return;p.remove();route(n.dataset.notice);});document.addEventListener('click',function close(ev){if(!p.contains(ev.target)&&ev.target!==bell){p.remove();document.removeEventListener('click',close)}});});

  // Sidebar Global Search item is a shortcut to the top search field.
  document.addEventListener('click',e=>{const a=e.target.closest('[data-page="global"]');if(!a)return;e.preventDefault();gi?.focus();gi?.select();toast('Üstteki global arama alanı aktif edildi.');if(innerWidth<992)$('#sidebar')?.classList.remove('open')});

  // Generic navigation buttons and quick actions.
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    const txt=b.textContent.trim();
    const routeWords=[['Envanter Ekle','inventory'],['Talep Oluştur','requests'],['Bakım Gir','maintenance'],['Barkod Ara','barcode'],['Stok Girişi','stock'],['Kullanıcı Ekle','admin'],['Personel Ekle','people'],['Yeni Envanter','inventory'],['Yeni Makale','knowledge'],['Hurdaya Ayır','scrap'],['Rapor Oluştur','reports']];
    const match=routeWords.find(x=>txt.includes(x[0]));if(match){route(match[1]);return}
    if(txt==='Excel'||txt.includes('Excel')){toast('Excel dışa aktarma prototip akışı hazırlandı.','success');return}
    if(txt==='Yazdır'||txt.includes('Yazdır')){window.print();return}
    if(txt==='Filtrele'){toast('Filtreler uygulandı.','success');return}
    if(b.querySelector('.ti-refresh')||txt===''){if(b.querySelector('.ti-refresh')){const inputs=$$('.filter-bar input');inputs.forEach(x=>x.value='');$$('.filter-bar select').forEach(x=>x.selectedIndex=0);$$('.table tbody tr').forEach(x=>x.style.display='');toast('Filtreler temizlendi.');}return}
    if(txt==='Listele'){toast('Yaklaşan lisanslar listelendi.','success');return}
    if(txt==='Raporu Aç'){route('reports');toast('Rapor ekranı açıldı.','success');return}
    if(['Zimmet','Devir','Bakım Kaydı','Arızalı Yap','Hurdaya Ayır'].includes(txt)){toast(`${txt} işlemi için kayıt ekranı açıldı.`,'success');return}
    if(txt==='Düzenle'||txt==='Değişiklikleri Kaydet'||txt==='Ayarları Kaydet'){toast(txt==='Düzenle'?'Düzenleme modu açıldı.':'Değişiklikler kaydedildi.','success');return}
  });

  // Tabs: keep active state and provide contextual content for inventory detail / module tabs.
  document.addEventListener('click',e=>{
    const tab=e.target.closest('.tabs-bar button,.detail-tabs button,.settings-menu button');if(!tab)return;
    const group=tab.parentElement;$$('button',group).forEach(x=>x.classList.remove('active'));tab.classList.add('active');
    const label=tab.textContent.trim();
    if(group.classList.contains('detail-tabs')){const panel=tab.closest('.panel');const timeline=panel?.querySelector('.timeline');if(timeline){const data={Genel:[['12.02.2026','Ahmet Yılmaz\'a zimmetlendi'],Donanım:[['CPU','Intel Core i5 · RAM 16 GB · SSD 512 GB'],['Ağ','MAC 00:1B:44:11:3A:B7 · IP 172.35.10.24']], 'Zimmet Geçmişi':[['12.02.2026','Ahmet Yılmaz · Zimmet'],['04.01.2026','Bilgi İşlem Stoğu · Teslim']],Bakım:[['18.08.2026','Periyodik bakım tamamlandı'],['04.09.2026','Yeni kontrol planlandı']],Hareketler:[['04.09.2026','Durum kontrolü · Aktif'],['18.08.2026','Bakım tamamlandı'],['12.02.2026','Zimmet oluşturuldu']]}[label]||[['04.09.2026','İlgili kayıtlar görüntüleniyor']];timeline.innerHTML=data.map(x=>`<div><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}}
    else toast(`${label} görünümü seçildi.`);
  });

  // Filter bars: live filter table rows by visible text.
  document.addEventListener('input',e=>{if(!e.target.closest('.filter-bar input'))return;const q=e.target.value.toLocaleLowerCase('tr');const panel=e.target.closest('.content')||content;$$('.table tbody tr',panel).forEach(tr=>tr.style.display=tr.textContent.toLocaleLowerCase('tr').includes(q)?'':'none')});

  // Table row actions: eye opens record modal, dots opens action menu.
  document.addEventListener('click',e=>{
    const eye=e.target.closest('.table tbody .ti-eye');if(eye){const tr=eye.closest('tr');const cells=$$('td',tr).slice(0,-1);const pairs=cells.map((c,i)=>[`Alan ${i+1}`,c.textContent.trim()]);const title=cells[1]?.textContent.trim()||cells[0]?.textContent.trim()||'Kayıt Detayı';let actions='<button class="btn btn-primary" data-modal-action="edit">Düzenle</button><button class="btn btn-outline-secondary" data-modal-action="assign">Zimmet / Devir</button>';if(location.hash.includes('request')||$('#crumb')?.textContent.includes('Talep'))actions+='<button class="btn btn-success" data-modal-action="enter">Cihazı Gir</button>';const m=modal(title,`<div class="it-modal-grid">${pairs.map(x=>`<div><span>${x[0]}</span><strong>${x[1]||'—'}</strong></div>`).join('')}</div>`,actions);m.addEventListener('click',ev=>{const a=ev.target.closest('[data-modal-action]');if(!a)return;if(a.dataset.modalAction==='enter'){m.remove();const rowType=tr.textContent.toLocaleLowerCase('tr');const dest=rowType.includes('lisans')?'licenses':rowType.includes('mouse')||rowType.includes('kablo')?'stock':'inventory';route(dest);toast(`Ürün girişi tamamlandı: ${dest==='inventory'?'Envanter':dest==='licenses'?'Lisans':'Stok'} modülüne yönlendirildi.`,'success')}else toast('İşlem prototip ekranında hazır.','success')});return}
    const dots=e.target.closest('.table tbody .ti-dots');if(dots){modal('Kayıt İşlemleri','<p class="text-muted">Bu kayıt için hızlı işlem seçin.</p>','<button class="btn btn-primary">Düzenle</button><button class="btn btn-outline-secondary">Devir</button><button class="btn btn-outline-danger">Sil</button>');return}
  });

  // Request row / dashboard action flow helper.
  document.addEventListener('click',e=>{const flow=e.target.closest('.flow span');if(flow){toast(`${flow.textContent.trim()} adımı seçildi.`)}});
});
