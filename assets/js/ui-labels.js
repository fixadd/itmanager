(()=>{
  const permissions={
    'users.manage':'Kullanıcı Yönetimi','roles.manage':'Rol ve Yetki Yönetimi','inventory.manage':'Envanter Yönetimi',
    'licenses.manage':'Lisans Yönetimi','stock.manage':'Stok Yönetimi','maintenance.manage':'Bakım / Servis Yönetimi',
    'requests.manage':'Satın Alma Talepleri Yönetimi','people.manage':'Personel Yönetimi','knowledge.manage':'Bilgi Bankası Yönetimi',
    'scrap.manage':'Hurda Yönetimi','reports.view':'Raporları Görüntüleme','reports.export':'Rapor Dışa Aktarma',
    'logs.view':'İşlem Kayıtlarını Görüntüleme','settings.manage':'Sistem Ayarları','profile.view':'Profil Görüntüleme',
    'profile.update':'Profil Düzenleme','dashboard.view':'Ana Sayfa Görüntüleme'
  };
  const actions={
    created:'Oluşturuldu',updated:'Güncellendi',deleted:'Silindi',assigned:'Atandı',unassigned:'Atama Kaldırıldı',
    transferred:'Aktarıldı',scrapped:'Hurdaya Ayrıldı',faulty:'Arızalı İşaretlendi',sent_to_it:'Bilgi İşleme Gönderildi',
    send_to_it:'Bilgi İşleme Gönderildi',returned:'Geri Alındı',maintenance_started:'Bakım Başlatıldı',
    maintenance_completed:'Bakım Tamamlandı',status_changed:'Durum Değiştirildi',login:'Giriş Yapıldı',logout:'Çıkış Yapıldı',
    user_created:'Kullanıcı Oluşturuldu',user_updated:'Kullanıcı Güncellendi',user_status_changed:'Kullanıcı Durumu Değiştirildi',
    password_changed:'Şifre Değiştirildi',profile_updated:'Profil Güncellendi',role_created:'Rol Oluşturuldu',role_updated:'Rol Güncellendi',
    permission_updated:'Yetki Güncellendi',catalog_model_created:'Ürün Modeli Oluşturuldu',
    'assets transferred':'Varlıklar Aktarıldı','asset transferred':'Varlık Aktarıldı',assets_transferred:'Varlıklar Aktarıldı',asset_transferred:'Varlık Aktarıldı',
    'inventory.created':'Envanter Oluşturuldu','inventory.updated':'Envanter Güncellendi','inventory.assigned':'Envanter Zimmetlendi',
    'inventory.unassigned':'Envanter Zimmeti Kaldırıldı','inventory.sent_to_it':'Envanter Bilgi İşleme Gönderildi',
    'inventory.scrapped':'Envanter Hurdaya Ayrıldı','inventory.faulty':'Envanter Arızalı İşaretlendi',
    'stock.created':'Stok Oluşturuldu','stock.updated':'Stok Güncellendi','stock.movement':'Stok Hareketi',
    'license.created':'Lisans Oluşturuldu','license.updated':'Lisans Güncellendi','license.assigned':'Lisans Atandı',
    'license.unassigned':'Lisans Ataması Kaldırıldı','maintenance.created':'Bakım Kaydı Oluşturuldu',
    'maintenance.updated':'Bakım Kaydı Güncellendi','request.created':'Satın Alma Talebi Oluşturuldu'
  };
  const entities={inventory:'Envanter',stock:'Stok',stock_item:'Stok',license:'Lisans',licenses:'Lisans',personnel:'Personel',people:'Personel',
    maintenance:'Bakım',maintenance_record:'Bakım',scrap:'Hurda',scrap_record:'Hurda',knowledge:'Bilgi Bankası',knowledge_item:'Bilgi Bankası',
    request:'Satın Alma Talebi',purchase_request:'Satın Alma Talebi',requests:'Satın Alma Talepleri',user:'Kullanıcı',users:'Kullanıcılar',
    role:'Rol',roles:'Roller',settings:'Ayarlar',setting:'Ayar',assets:'Varlıklar',asset:'Varlık',permission:'Yetki',permissions:'Yetkiler',
    product:'Ürün',product_type:'Donanım Tipi',product_model:'Model',brand:'Marka',factory:'Fabrika',department:'Departman',system:'Sistem',audit_log:'Kayıt'};
  const values={active:'Aktif',inactive:'Pasif',faulty:'Arızalı',maintenance:'Bakım / Servis',scrapped:'Hurda',it:'Bilgi İşlem',service:'Serviste',
    available:'Mevcut',pending:'Bekliyor',approved:'Onaylandı',ordered:'Sipariş Verildi',completed:'Tamamlandı',cancelled:'İptal',draft:'Taslak',
    rejected:'Reddedildi',normal:'Normal',high:'Yüksek',low:'Düşük',urgent:'Acil',true:'Evet',false:'Hayır'};
  const details={status:'Durum',old_status:'Eski Durum',new_status:'Yeni Durum',reason:'Neden',note:'Not',description:'Açıklama',
    name:'Ad',title:'Başlık',serial_number:'Seri Numarası',serial_no:'Seri Numarası',inventory_number:'Envanter Numarası',inventory_no:'Envanter Numarası',
    computer_name:'Bilgisayar Adı',personnel:'Personel',personnel_id:'Personel',factory:'Fabrika',factory_id:'Fabrika',department:'Departman',department_id:'Departman',
    brand:'Marka',brand_id:'Marka',model:'Model',model_id:'Model',product_type:'Donanım Tipi',product_type_id:'Donanım Tipi',quantity:'Miktar',unit:'Birim',
    action:'İşlem',source_type:'Kaynak Tipi',entity_type:'Modül',entity_id:'Kayıt ID',barcode:'Barkod',machine_no:'Makine No',ifs_no:'IFS No',status_reason:'Durum Nedeni'};
  const normalize=v=>String(v??'').trim();
  const label=v=>{
    const s=normalize(v); if(!s)return '—';
    if(permissions[s])return permissions[s]; if(actions[s])return actions[s]; if(entities[s])return entities[s]; if(values[s])return values[s];
    const parts=s.split('.');
    if(parts.length>1){const scope=entities[parts[0]]||parts[0].replaceAll('_',' ');const verb=actions[parts.slice(1).join('.')]||actions[parts.at(-1)]||parts.slice(1).join('.').replaceAll('_',' ');return scope+' · '+verb;}
    return s.replaceAll('_',' ');
  };
  const permission=v=>permissions[normalize(v)]||label(v);
  const action=v=>actions[normalize(v)]||label(v);
  const entity=v=>entities[normalize(v)]||label(v);
  const detail=v=>details[normalize(v)]||label(v);
  window.IT_UI_LABELS={permissions,actions,entities,values,details,label,permission,action,entity,detail};
})();
