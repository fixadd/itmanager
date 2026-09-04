document.addEventListener('DOMContentLoaded',()=>{
  const root=document.documentElement, content=document.querySelector('#pageContent');

  // Theme
  const themeToggle=document.querySelector('#themeToggle');
  const applyTheme=t=>{
    const dark=t==='dark';
    root.setAttribute('data-bs-theme',dark?'dark':'light');
    root.classList.toggle('dark-mode',dark);
    document.body.classList.toggle('dark-mode',dark);
    const i=themeToggle?.querySelector('i');
    if(i)i.className=`ti ${dark?'ti-sun':'ti-moon'}`;
  };
  let theme=localStorage.getItem('itmanager-theme');
  if(theme!=='dark'&&theme!=='light')theme='dark';
  applyTheme(theme);
  themeToggle?.addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();
    theme=root.classList.contains('dark-mode')?'light':'dark';
    localStorage.setItem('itmanager-theme',theme);applyTheme(theme);
  },true);

  // Notifications
  const notificationBtn=document.querySelector('#notificationBtn');
  notificationBtn?.addEventListener('click',e=>{
    e.preventDefault();e.stopImmediatePropagation();
    document.querySelector('#itNotificationPopover')?.remove();
    const p=document.createElement('div');p.id='itNotificationPopover';p.className='it-popover';
    p.innerHTML=`<div class="it-popover-head">Bildirimler <span class="badge text-bg-danger ms-2">4</span></div>
      <div class="it-notice" data-page="maintenance"><i class="ti ti-tool text-warning"></i><div><strong>4 cihazın bakımı geldi</strong><small>Periyodik bakım · şimdi</small></div></div>
      <div class="it-notice" data-page="licenses"><i class="ti ti-license text-danger"></i><div><strong>7 lisansın süresi dolmuş</strong><small>Lisans Takip · bugün</small></div></div>
      <div class="it-notice" data-page="stock"><i class="ti ti-package text-warning"></i><div><strong>8 stok kalemi kritik seviyede</strong><small>Stok Takip · bugün</small></div></div>
      <div class="it-notice" data-page="requests"><i class="ti ti-file-invoice text-info"></i><div><strong>5 yeni satın alma talebi</strong><small>Satın Alma · 10 dk önce</small></div></div>`;
    document.body.appendChild(p);
    p.addEventListener('click',e=>{
      const item=e.target.closest('.it-notice');if(!item)return;
      p.remove();document.querySelector(`.nav-link[data-page="${item.dataset.page}"]`)?.click();
    });
  },true);

  // Semantic filter options.
  const options={
    inventory:{'Cihaz Tipi':['Laptop','Masaüstü Bilgisayar','Monitör','Yazıcı','El Terminali','Telefon','Kamera','Sunucu','Network Cihazı','Diğer'],'Marka':['Dell','HP','Lenovo','Asus','Acer','Canon','Kyocera','Xerox','Hikvision','Aruba','Samsung','Zebra','Diğer'],'Model':['Latitude 5440','Latitude 5550','OptiPlex 7010','P2422H','M5526cdw','B3150','DS-2CD2143G2','Aruba 6000','Diğer'],'Durum':['Aktif','IT Stoğu','Bakımda','Serviste','Arızalı','Hurda']},
    licenses:{'Durum':['Aktif','Boş','Süresi Yaklaşıyor','Süresi Dolmuş'],'Firma':['Microsoft','Adobe','Autodesk','Kaspersky','VMware','Fortinet','Diğer'],'Süre':['Süresiz','30 Gün','90 Gün','6 Ay','1 Yıl','3 Yıl']},
    stock:{'Kategori':['Aksesuar','Kablo','Sarf','Enerji','Depolama','Temizlik','Yedek Parça','Diğer'],'Durum':['Normal','Kritik','Tükendi','Arızalı'],'Lokasyon':['Merkez Depo','Fabrika 1','Fabrika 2','Baylan Electric','Baylan Water Meters','Bilgi İşlem']},
    maintenance:{'Durum':['Yeni','Bakım Bekliyor','İşlemde','Serviste','Parça Bekliyor','Tamamlandı','Hurda'],'Teknisyen':['Ahmet Çetin','Mehmet Kaya','Can Yıldız','Burak Demir','Dış Servis'],'Tarih':['Bugün','Son 7 Gün','Son 30 Gün','Bu Yıl']},
    requests:{'Talep Tipi':['Envanter','Lisans','Stok / Sarf'],'Durum':['Yeni','Onay Bekliyor','Onaylandı','Satın Alma Bekliyor','Ürün Bekleniyor','Ürün Geldi','Tamamlandı','Reddedildi'],'Öncelik':['Düşük','Normal','Yüksek','Acil']},
    people:{'Departman':['Bilgi İşlem','Üretim','Finans','İnsan Kaynakları','Satın Alma','Muhasebe','Kalite','Bakım'],'Fabrika':['Merkez','Fabrika 1','Fabrika 2','Baylan Electric','Baylan Water Meters'],'Durum':['Aktif','İzinli','Ayrıldı']}
  };
  const activePage=()=>document.querySelector('.nav-link.active')?.dataset.page||'';
  let normalizing=false;
  const normalizeFilters=()=>{
    if(normalizing)return;
    const map=options[activePage()];if(!map)return;
    normalizing=true;
    try{
      document.querySelectorAll('#pageContent .filter-bar select').forEach(select=>{
        const key=(select.options[0]?.textContent||'').trim(), values=map[key];
        if(!values)return;
        const current=select.value;
        const desired=[''].concat(values);
        const actual=[...select.options].map(o=>o.textContent);
        if(actual.length===desired.length&&actual.every((v,i)=>v===desired[i]))return;
        select.innerHTML=`<option value="">${key}</option>`+values.map(v=>`<option value="${v}">${v}</option>`).join('');
        if(values.includes(current))select.value=current;
      });
    }finally{normalizing=false;}
  };
  normalizeFilters();
  // Observe only direct page replacement. Changes inside selects are not observed.
  if(content)new MutationObserver(()=>normalizeFilters()).observe(content,{childList:true});

  // Small modal forms for primary actions.
  const style=document.createElement('style');
  style.textContent='.it-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.it-form-field{display:flex;flex-direction:column;gap:6px}.it-form-field.full{grid-column:1/-1}.it-form-field label{font-size:12px;font-weight:700;color:var(--muted,#64748b)}.it-form-field input,.it-form-field select,.it-form-field textarea{width:100%;border:1px solid var(--border,#e2e8f0);border-radius:9px;padding:10px 11px;background:var(--panel2,#f8fafc);color:var(--text,#1e293b);outline:none}.it-form-field textarea{min-height:92px;resize:vertical}.it-modal-wide{width:min(900px,100%)}@media(max-width:700px){.it-form-grid{grid-template-columns:1fr}.it-form-field.full{grid-column:auto}}';
  document.head.appendChild(style);
  const forms={
    'Yeni Envanter':['Envanter Kaydı',[['Cihaz Tipi',['Laptop','Masaüstü Bilgisayar','Monitör','Yazıcı','El Terminali','Telefon','Kamera','Sunucu','Network Cihazı','Diğer']],['Marka',['Dell','HP','Lenovo','Asus','Acer','Canon','Kyocera','Xerox','Hikvision','Aruba','Samsung','Zebra','Diğer']],['Model'],['Seri No'],['Barkod / Envanter No'],['Durum',['Aktif','IT Stoğu','Bakımda','Serviste','Arızalı','Hurda']],['Personel'],['Lokasyon',['Merkez','Fabrika 1','Fabrika 2','Baylan Electric','Baylan Water Meters','Server Odası']]]],
    'Yeni Lisans':['Yeni Lisans',[['Yazılım'],['Lisans Tipi',['Süresiz','Abonelik','Volume','OEM','MAK','KMS']],['Firma',['Microsoft','Adobe','Autodesk','Kaspersky','VMware','Fortinet','Diğer']],['Lisans Anahtarı'],['Kapasite'],['Bitiş Tarihi'],['Durum',['Aktif','Boş','Süresi Yaklaşıyor','Süresi Dolmuş']]]],
    'Stok Girişi':['Stok Girişi',[['Ürün'],['Kategori',['Aksesuar','Kablo','Sarf','Enerji','Depolama','Temizlik','Yedek Parça','Diğer']],['Miktar'],['Birim',['Adet','Kutu','Paket','Metre']],['Kritik Seviye'],['Lokasyon',['Merkez Depo','Fabrika 1','Fabrika 2','Bilgi İşlem']],['Tedarikçi']]],
    'Stok Çıkışı':['Stok Çıkışı',[['Ürün / SKU'],['Miktar'],['Hedef',['Personel','Envanter Cihazı']],['Personel / Envanter No'],['Açıklama','textarea',true]]],
    'Bakım Kaydı':['İç Bakım Kaydı',[['Cihaz / Envanter No'],['Personel'],['Arıza','textarea',true],['Teknisyen',['Ahmet Çetin','Mehmet Kaya','Can Yıldız','Burak Demir']],['Başlangıç'],['Değişen Parça'],['Sonuç',['İşlemde','Tamamlandı','Parça Bekliyor','Hurda']]]],
    'Servise Gönder':['Dış Servis / Tamir Kaydı',[['Cihaz / Envanter No'],['Servis Firması'],['Arıza','textarea',true],['Gönderim Tarihi'],['Tahmini Dönüş'],['Garanti',['Garanti Dahili','Garanti Dışı']],['Servis Ücreti']]],
    'Yeni Satın Alma Talebi':['Satın Alma Talebi',[['Talep Tipi',['Envanter','Lisans','Stok / Sarf']],['Talep Konusu',null,true],['Miktar'],['Öncelik',['Düşük','Normal','Yüksek','Acil']],['Gerekçe','textarea',true]]],
    'Yeni Personel':['Personel Kaydı',[['Ad Soyad'],['Sicil No'],['Departman',['Bilgi İşlem','Üretim','Finans','İnsan Kaynakları','Satın Alma','Muhasebe','Kalite','Bakım']],['Fabrika',['Merkez','Fabrika 1','Fabrika 2','Baylan Electric','Baylan Water Meters']],['Pozisyon'],['Durum',['Aktif','İzinli','Ayrıldı']]]]
  };
  const openForm=(title,fields)=>{
    document.querySelector('.it-overlay')?.remove();
    const o=document.createElement('div');o.className='it-overlay';
    const make=(f,i)=>{const name='f'+i,label=f[0],type=f[1],full=f[2];if(Array.isArray(type))return `<div class="it-form-field ${full?'full':''}"><label>${label}</label><select name="${name}"><option value="">${label}</option>${type.map(x=>`<option>${x}</option>`).join('')}</select></div>`;const tag=type==='textarea'?'textarea':'input';return `<div class="it-form-field ${full?'full':''}"><label>${label}</label><${tag} name="${name}" ${tag==='input'?'type="text"':''}></${tag}></div>`};
    o.innerHTML=`<div class="it-modal it-modal-wide" role="dialog" aria-modal="true"><div class="it-modal-head"><strong>${title}</strong><button class="btn btn-sm btn-light" data-close-modal><i class="ti ti-x"></i></button></div><div class="it-modal-body"><div class="it-form-grid">${fields.map(make).join('')}</div><div class="it-modal-actions"><button class="btn btn-primary" data-form-save><i class="ti ti-device-floppy me-1"></i>Kaydet</button><button class="btn btn-outline-secondary" data-close-modal>Vazgeç</button></div></div></div>`;
    document.body.appendChild(o);
    o.addEventListener('click',e=>{if(e.target===o||e.target.closest('[data-close-modal]'))o.remove();if(e.target.closest('[data-form-save]')){o.remove();const t=document.createElement('div');t.className='toast align-items-center border-0 show position-fixed bottom-0 end-0 m-3';t.style.zIndex='10001';t.innerHTML=`<div class="toast-body">${title} için bilgiler kaydedildi.</div>`;document.body.appendChild(t);setTimeout(()=>t.remove(),2500)}});
  };
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    const text=b.textContent.replace(/\s+/g,' ').trim();
    const key=Object.keys(forms).find(k=>text===k||text.startsWith(k));
    if(!key)return;
    e.preventDefault();e.stopImmediatePropagation();openForm(forms[key][0],forms[key][1]);
  },true);
});