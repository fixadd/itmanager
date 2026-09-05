document.addEventListener('DOMContentLoaded',()=>{
  const root=document.documentElement, content=document.querySelector('#pageContent');
  const themeToggle=document.querySelector('#themeToggle');
  const applyTheme=t=>{const dark=t==='dark';root.setAttribute('data-bs-theme',dark?'dark':'light');root.classList.toggle('dark-mode',dark);document.body.classList.toggle('dark-mode',dark);const i=themeToggle?.querySelector('i');if(i)i.className=`ti ${dark?'ti-sun':'ti-moon'}`};
  let theme=localStorage.getItem('itmanager-theme')||'dark';if(theme!=='dark'&&theme!=='light')theme='dark';applyTheme(theme);
  themeToggle?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();theme=root.classList.contains('dark-mode')?'light':'dark';localStorage.setItem('itmanager-theme',theme);applyTheme(theme)});
  const options={
    inventory:{'Cihaz Tipi':['Laptop','Masaüstü Bilgisayar','Monitör','Yazıcı','El Terminali','Telefon','Kamera','Sunucu','Network Cihazı','Diğer'],'Marka':['Dell','HP','Lenovo','Asus','Acer','Canon','Kyocera','Xerox','Hikvision','Aruba','Samsung','Zebra','Diğer'],'Model':['Latitude 5440','Latitude 5550','OptiPlex 7010','P2422H','M5526cdw','B3150','DS-2CD2143G2','Aruba 6000','Diğer'],'Durum':['Aktif','IT Stoğu','Bakımda','Serviste','Arızalı','Hurda']},
    licenses:{'Durum':['Aktif','Boş','Süresi Yaklaşıyor','Süresi Dolmuş'],'Firma':['Microsoft','Adobe','Autodesk','Kaspersky','VMware','Fortinet','Diğer'],'Süre':['Süresiz','30 Gün','90 Gün','6 Ay','1 Yıl','3 Yıl']},
    stock:{'Kategori':['Aksesuar','Kablo','Sarf','Enerji','Depolama','Temizlik','Yedek Parça','Diğer'],'Durum':['Normal','Kritik','Tükendi','Arızalı'],'Lokasyon':['Merkez Depo','Fabrika 1','Fabrika 2','Baylan Electric','Baylan Water Meters','Bilgi İşlem']},
    maintenance:{'Durum':['Yeni','Bakım Bekliyor','İşlemde','Serviste','Parça Bekliyor','Tamamlandı','Hurda'],'Teknisyen':['Ahmet Çetin','Mehmet Kaya','Can Yıldız','Burak Demir','Dış Servis'],'Tarih':['Bugün','Son 7 Gün','Son 30 Gün','Bu Yıl']},
    requests:{'Talep Tipi':['Envanter','Lisans','Stok / Sarf'],'Durum':['Yeni','Onay Bekliyor','Onaylandı','Satın Alma Bekliyor','Ürün Bekleniyor','Ürün Geldi','Tamamlandı','Reddedildi'],'Öncelik':['Düşük','Normal','Yüksek','Acil']},
    people:{'Departman':['Bilgi İşlem','Üretim','Finans','İnsan Kaynakları','Satın Alma','Muhasebe','Kalite','Bakım'],'Fabrika':['Merkez','Fabrika 1','Fabrika 2','Baylan Electric','Baylan Water Meters'],'Durum':['Aktif','İzinli','Ayrıldı']}
  };
  let busy=false;
  const normalize=()=>{if(busy)return;const active=document.querySelector('.nav-link.active')?.dataset.page;const map=options[active];if(!map)return;busy=true;try{document.querySelectorAll('#pageContent .filter-bar select').forEach(s=>{const key=s.options[0]?.textContent?.trim(),vals=map[key];if(!vals)return;const cur=s.value;s.innerHTML=`<option value="">${key}</option>`+vals.map(v=>`<option value="${v}">${v}</option>`).join('');if(vals.includes(cur))s.value=cur})}finally{busy=false}};
  normalize();if(content)new MutationObserver(normalize).observe(content,{childList:true});
});