document.addEventListener('DOMContentLoaded',()=>{
  const root=document.documentElement;
  const notificationBtn=document.querySelector('#notificationBtn');
  const themeToggle=document.querySelector('#themeToggle');
  const sidebar=document.querySelector('#sidebar');
  const content=document.querySelector('#pageContent');

  if(sidebar){
    sidebar.style.overflow='visible';
    const scroll=sidebar.querySelector('.sidebar-scroll');
    if(scroll){scroll.style.overflow='visible';scroll.style.overflowY='visible';scroll.style.flex='1 1 auto';}
  }

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
    e.preventDefault();e.stopImmediatePropagation();
    const next=root.classList.contains('dark-mode')?'light':'dark';
    localStorage.setItem('itmanager-theme',next);applyTheme(next);
  },true);

  const closeNotice=()=>document.querySelector('#itNotificationPopover')?.remove();
  const openNotice=()=>{
    closeNotice();
    const p=document.createElement('div');p.id='itNotificationPopover';p.className='it-popover';
    p.innerHTML=`<div class="it-popover-head">Bildirimler <span class="badge text-bg-danger ms-2">4</span></div>
      <div class="it-notice" data-page="maintenance"><i class="ti ti-tool text-warning"></i><div><strong>4 cihazın bakımı geldi</strong><small>Periyodik bakım · şimdi</small></div></div>
      <div class="it-notice" data-page="licenses"><i class="ti ti-license text-danger"></i><div><strong>7 lisansın süresi dolmuş</strong><small>Lisans Takip · bugün</small></div></div>
      <div class="it-notice" data-page="stock"><i class="ti ti-package text-warning"></i><div><strong>8 stok kalemi kritik seviyede</strong><small>Stok Takip · bugün</small></div></div>
      <div class="it-notice" data-page="requests"><i class="ti ti-file-invoice text-info"></i><div><strong>5 yeni satın alma talebi</strong><small>Satın Alma Talepleri · 10 dk önce</small></div></div>`;
    document.body.appendChild(p);
    p.addEventListener('click',e=>{const item=e.target.closest('.it-notice');if(!item)return;const page=item.dataset.page;closeNotice();document.querySelector(`.nav-link[data-page="${page}"]`)?.click();});
  };
  notificationBtn?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();document.querySelector('#itNotificationPopover')?closeNotice():openNotice();},true);
  document.addEventListener('click',e=>{const p=document.querySelector('#itNotificationPopover');if(p&&!p.contains(e.target)&&e.target!==notificationBtn)closeNotice();});

  // Semantic filter options. Never put generic Aktif/Pasif into fields such as Marka, Model or Kategori.
  const filterOptions={
    inventory:{
      'Cihaz Tipi':['Laptop','Masaüstü Bilgisayar','Monitör','Yazıcı','El Terminali','Telefon','Kamera','Sunucu','Network Cihazı','Diğer'],
      'Marka':['Dell','HP','Lenovo','Asus','Acer','Canon','Kyocera','Xerox','Hikvision','Aruba','Samsung','Zebra','Diğer'],
      'Model':['Latitude 5440','Latitude 5550','OptiPlex 7010','P2422H','M5526cdw','B3150','DS-2CD2143G2','Aruba 6000','Diğer'],
      'Durum':['Aktif','IT Stoğu','Bakımda','Serviste','Arızalı','Hurda']
    },
    licenses:{
      'Durum':['Aktif','Boş','Süresi Yaklaşıyor','Süresi Dolmuş'],
      'Firma':['Microsoft','Adobe','Autodesk','Kaspersky','VMware','Fortinet','Diğer'],
      'Süre':['Süresiz','30 Gün','90 Gün','6 Ay','1 Yıl','3 Yıl']
    },
    stock:{
      'Kategori':['Aksesuar','Kablo','Sarf','Enerji','Depolama','Temizlik','Yedek Parça','Diğer'],
      'Durum':['Normal','Kritik','Tükendi','Arızalı'],
      'Lokasyon':['Merkez Depo','Fabrika 1','Fabrika 2','Baylan Electric','Baylan Water Meters','Bilgi İşlem']
    },
    maintenance:{
      'Durum':['Yeni','Bakım Bekliyor','İşlemde','Serviste','Parça Bekliyor','Tamamlandı','Hurda'],
      'Teknisyen':['Ahmet Çetin','Mehmet Kaya','Can Yıldız','Burak Demir','Dış Servis'],
      'Tarih':['Bugün','Son 7 Gün','Son 30 Gün','Bu Yıl']
    },
    requests:{
      'Talep Tipi':['Envanter','Lisans','Stok / Sarf'],
      'Durum':['Yeni','Onay Bekliyor','Onaylandı','Satın Alma Bekliyor','Ürün Bekleniyor','Ürün Geldi','Tamamlandı','Reddedildi'],
      'Öncelik':['Düşük','Normal','Yüksek','Acil']
    },
    people:{
      'Departman':['Bilgi İşlem','Üretim','Finans','İnsan Kaynakları','Satın Alma','Muhasebe','Kalite','Bakım'],
      'Fabrika':['Merkez','Fabrika 1','Fabrika 2','Baylan Electric','Baylan Water Meters'],
      'Durum':['Aktif','İzinli','Ayrıldı']
    }
  };
  const activePage=()=>document.querySelector('.nav-link.active')?.dataset.page||'';
  const normalizeFilters=()=>{
    const map=filterOptions[activePage()];
    if(!map)return;
    document.querySelectorAll('.filter-bar select').forEach(select=>{
      const key=(select.options[0]?.textContent||'').trim();
      const values=map[key];
      if(!values)return;
      const current=select.value;
      select.innerHTML=`<option value="">${key}</option>`+values.map(v=>`<option value="${v.replace(/"/g,'&quot;')}">${v}</option>`).join('');
      if(values.includes(current))select.value=current;
    });
  };
  normalizeFilters();
  if(content)new MutationObserver(()=>normalizeFilters()).observe(content,{childList:true,subtree:true});

  // Real modal forms for primary actions. These stay on top of the current page instead of appending content below it.
  const modalStyle=document.createElement('style');
  modalStyle.textContent=`.it-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.it-form-field{display:flex;flex-direction:column;gap:6px}.it-form-field.full{grid-column:1/-1}.it-form-field label{font-size:12px;font-weight:700;color:var(--muted,#64748b)}.it-form-field input,.it-form-field select,.it-form-field textarea{width:100%;border:1px solid var(--border,#e2e8f0);border-radius:9px;padding:10px 11px;background:var(--panel2,#f8fafc);color:var(--text,#1e293b);outline:none}.it-form-field textarea{min-height:92px;resize:vertical}.it-modal-wide{width:min(900px,100%)}@media(max-width:700px){.it-form-grid{grid-template-columns:1fr}.it-form-field.full{grid-column:auto}}`;
  document.head.appendChild(modalStyle);

  const formModal=(title,fields,saveText='Kaydet')=>{
    document.querySelector('.it-overlay')?.remove();
    const o=document.createElement('div');o.className='it-overlay';
    const input=(f)=>{const tag=f.type==='textarea'?'textarea':f.type==='select'?'select':'input';if(tag==='select')return `<select name="${f.name}">${f.options.map(x=>`<option>${x}</option>`).join('')}</select>`;return `<${tag} name="${f.name}" ${f.type==='number'?'type="number"':f.type==='date'?'type="date"':f.type==='email'?'type="email"':'type="text"'} placeholder="${f.placeholder||''}">${f.type==='textarea'?'':''}</${tag}>`};
    o.innerHTML=`<div class="it-modal it-modal-wide" role="dialog" aria-modal="true"><div class="it-modal-head"><strong>${title}</strong><button class="btn btn-sm btn-light" data-close-modal><i class="ti ti-x"></i></button></div><div class="it-modal-body"><div class="it-form-grid">${fields.map(f=>`<div class="it-form-field ${f.full?'full':''}"><label>${f.label}</label>${input(f)}</div>`).join('')}</div><div class="it-modal-actions"><button class="btn btn-primary" data-form-save><i class="ti ti-device-floppy me-1"></i>${saveText}</button><button class="btn btn-outline-secondary" data-close-modal>Vazgeç</button></div></div></div>`;
    document.body.appendChild(o);
    o.querySelector('[data-form-save]')?.addEventListener('click',()=>{o.remove();const t=document.createElement('div');t.className='toast align-items-center border-0 show position-fixed bottom-0 end-0 m-3';t.style.zIndex='10001';t.innerHTML=`<div class="d-flex"><div class="toast-body">${title} için bilgiler kaydedildi.</div><button type="button" class="btn-close me-2 m-auto" onclick="this.closest('.toast').remove()"></button></div>`;document.body.appendChild(t);setTimeout(()=>t.remove(),2600)});
    o.addEventListener('click',e=>{if(e.target===o||e.target.closest('[data-close-modal]'))o.remove()});
  };

  const actionForms={
    'Yeni Envanter':['Envanter Kaydı',[{label:'Cihaz Tipi',name:'type',type:'select',options:['Laptop','Masaüstü Bilgisayar','Monitör','Yazıcı','El Terminali','Telefon','Kamera','Sunucu','Network Cihazı','Diğer']},{label:'Marka',name:'brand',type:'select',options:['Dell','HP','Lenovo','Asus','Acer','Canon','Kyocera','Xerox','Hikvision','Aruba','Samsung','Zebra','Diğer']},{label:'Model',name:'model'},{label:'Seri No',name:'serial'},{label:'Barkod / Envanter No',name:'barcode'},{label:'Durum',name:'status',type:'select',options:['Aktif','IT Stoğu','Bakımda','Serviste','Arızalı','Hurda']},{label:'Personel',name:'person'},{label:'Lokasyon',name:'location',type:'select',options:['Merkez','Fabrika 1','Fabrika 2','Baylan Electric','Baylan Water Meters','Server Odası']}]],
    'Yeni Lisans':['Yeni Lisans',[{label:'Yazılım',name:'software'},{label:'Lisans Tipi',name:'licenseType',type:'select',options:['Süresiz','Abonelik','Volume','OEM','MAK','KMS']},{label:'Firma',name:'company',type:'select',options:['Microsoft','Adobe','Autodesk','Kaspersky','VMware','Fortinet','Diğer']},{label:'Lisans Anahtarı',name:'key'},{label:'Kapasite',name:'quantity',type:'number'},{label:'Bitiş Tarihi',name:'endDate',type:'date'},{label:'Durum',name:'status',type:'select',options:['Aktif','Boş','Süresi Yaklaşıyor','Süresi Dolmuş']}]],
    'Stok Girişi':['Stok Girişi',[{label:'Ürün',name:'product'},{label:'Kategori',name:'category',type:'select',options:['Aksesuar','Kablo','Sarf','Enerji','Depolama','Temizlik','Yedek Parça','Diğer']},{label:'Miktar',name:'quantity',type:'number'},{label:'Birim',name:'unit',type:'select',options:['Adet','Kutu','Paket','Metre']},{label:'Kritik Seviye',name:'critical',type:'number'},{label:'Lokasyon',name:'location',type:'select',options:['Merkez Depo','Fabrika 1','Fabrika 2','Bilgi İşlem']},{label:'Tedarikçi',name:'supplier'}]],
    'Stok Çıkışı':['Stok Çıkışı',[{label:'Ürün / SKU',name:'product'},{label:'Miktar',name:'quantity',type:'number'},{label:'Hedef',name:'target',type:'select',options:['Personel','Envanter Cihazı']},{label:'Personel / Envanter No',name:'targetId'},{label:'Açıklama',name:'note',type:'textarea',full:true}]],
    'Bakım Kaydı':['İç Bakım Kaydı',[{label:'Cihaz / Envanter No',name:'asset'},{label:'Personel',name:'person'},{label:'Arıza',name:'issue',type:'textarea',full:true},{label:'Teknisyen',name:'technician',type:'select',options:['Ahmet Çetin','Mehmet Kaya','Can Yıldız','Burak Demir']},{label:'Başlangıç',name:'start',type:'date'},{label:'Değişen Parça',name:'part'},{label:'Sonuç',name:'result',type:'select',options:['İşlemde','Tamamlandı','Parça Bekliyor','Hurda']}]],
    'Servise Gönder':['Dış Servis / Tamir Kaydı',[{label:'Cihaz / Envanter No',name:'asset'},{label:'Servis Firması',name:'service'},{label:'Arıza',name:'issue',type:'textarea',full:true},{label:'Gönderim Tarihi',name:'sendDate',type:'date'},{label:'Tahmini Dönüş',name:'returnDate',type:'date'},{label:'Garanti',name:'warranty',type:'select',options:['Garanti Dahili','Garanti Dışı']},{label:'Servis Ücreti',name:'fee',type:'number'}]],
    'Yeni Satın Alma Talebi':['Satın Alma Talebi',[{label:'Talep Tipi',name:'type',type:'select',options:['Envanter','Lisans','Stok / Sarf']},{label:'Talep Konusu',name:'subject',full:true},{label:'Miktar',name:'quantity',type:'number'},{label:'Öncelik',name:'priority',type:'select',options:['Düşük','Normal','Yüksek','Acil']},{label:'Gerekçe',name:'reason',type:'textarea',full:true}]],
    'Yeni Personel':['Personel Kaydı',[{label:'Ad Soyad',name:'name'},{label:'Sicil No',name:'employeeId'},{label:'Departman',name:'department',type:'select',options:['Bilgi İşlem','Üretim','Finans','İnsan Kaynakları','Satın Alma','Muhasebe','Kalite','Bakım']},{label:'Fabrika',name:'factory',type:'select',options:['Merkez','Fabrika 1','Fabrika 2','Baylan Electric','Baylan Water Meters']},{label:'Pozisyon',name:'position'},{label:'Durum',name:'status',type:'select',options:['Aktif','İzinli','Ayrıldı']}]]
  };

  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    const text=b.textContent.replace(/\s+/g,' ').trim();
    const item=Object.keys(actionForms).find(k=>text===k||text.startsWith(k));
    if(!item)return;
    e.preventDefault();e.stopImmediatePropagation();
    const [title,fields]=actionForms[item];formModal(title,fields);
  },true);
});