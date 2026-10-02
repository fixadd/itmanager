(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const actionLabels={
'created':'Oluşturuldu','updated':'Güncellendi','deleted':'Silindi','assigned':'Atandı','unassigned':'Atama kaldırıldı',
'transferred':'Aktarıldı','scrapped':'Hurdaya ayrıldı','faulty':'Arızalı işaretlendi','sent_to_it':'Bilgi İşleme gönderildi',
'send_to_it':'Bilgi İşleme gönderildi','returned':'Geri alındı','maintenance_started':'Bakım başlatıldı',
'maintenance_completed':'Bakım tamamlandı','status_changed':'Durum değiştirildi','login':'Giriş yapıldı','logout':'Çıkış yapıldı',
'inventory.created':'Envanter oluşturuldu','inventory.updated':'Envanter güncellendi','inventory.assigned':'Envanter zimmetlendi',
'inventory.unassigned':'Envanter zimmeti kaldırıldı','inventory.sent_to_it':'Envanter Bilgi İşleme gönderildi',
'inventory.scrapped':'Envanter hurdaya ayrıldı','inventory.faulty':'Envanter arızalı işaretlendi',
'stock.created':'Stok oluşturuldu','stock.updated':'Stok güncellendi','stock.movement':'Stok hareketi',
'license.created':'Lisans oluşturuldu','license.updated':'Lisans güncellendi','license.assigned':'Lisans atandı',
'license.unassigned':'Lisans ataması kaldırıldı','maintenance.created':'Bakım kaydı oluşturuldu',
'maintenance.updated':'Bakım kaydı güncellendi','request.created':'Satın alma talebi oluşturuldu',
'settings.catalog_model_created':'Ürün modeli oluşturuldu'
};
const entityLabels={inventory:'Envanter',stock:'Stok',stock_item:'Stok',license:'Lisans',licenses:'Lisans',personnel:'Personel',people:'Personel',
maintenance:'Bakım',maintenance_record:'Bakım',scrap:'Hurda',scrap_record:'Hurda',knowledge:'Bilgi Bankası',knowledge_item:'Bilgi Bankası',request:'Satın Alma Talebi',purchase_request:'Satın Alma Talebi',requests:'Satın Alma Talebi',
user:'Kullanıcı',users:'Kullanıcı',role:'Rol',permission:'Yetki',product:'Ürün',product_type:'Donanım Tipi',product_model:'Model',brand:'Marka',factory:'Fabrika',department:'Departman',system:'Sistem',audit_log:'Kayıt'};
const detailLabels={
status:'Durum',old_status:'Eski durum',new_status:'Yeni durum',reason:'Neden',note:'Not',description:'Açıklama',
name:'Ad',title:'Başlık',serial_number:'Seri numarası',serial_no:'Seri numarası',inventory_number:'Envanter numarası',
inventory_no:'Envanter numarası',computer_name:'Bilgisayar adı',personnel:'Personel',personnel_id:'Personel ID',
factory:'Fabrika',factory_id:'Fabrika ID',department:'Departman',department_id:'Departman ID',brand:'Marka',
brand_id:'Marka ID',model:'Model',model_id:'Model ID',product_type:'Donanım tipi',product_type_id:'Donanım tipi ID',
quantity:'Miktar',unit:'Birim',action:'İşlem',source_type:'Kaynak tipi',entity_type:'Modül',entity_id:'Kayıt ID',
barcode:'Barkod',machine_no:'Makine no',ifs_no:'IFS no',status_reason:'Durum nedeni'
};
const valueLabels={
active:'Aktif',inactive:'Pasif',faulty:'Arızalı',maintenance:'Bakım / Servis',scrapped:'Hurda',it:'Bilgi İşlem',
service:'Serviste',available:'Mevcut',pending:'Bekliyor',approved:'Onaylandı',ordered:'Sipariş Verildi',
completed:'Tamamlandı',cancelled:'İptal',draft:'Taslak',rejected:'Reddedildi',normal:'Normal',high:'Yüksek',
low:'Düşük',urgent:'Acil'
};
const label=v=>{
 const s=String(v??'—');
 if(actionLabels[s])return actionLabels[s];
 if(entityLabels[s])return entityLabels[s];
 if(valueLabels[s])return valueLabels[s];
 const parts=s.split('.');
 if(parts.length>1){
  const scope=entityLabels[parts[0]]||parts[0].replaceAll('_',' ');
  const verb=actionLabels[parts.slice(1).join('.')]||actionLabels[parts[parts.length-1]]||parts.slice(1).join(' ').replaceAll('_',' ');
  return scope+' · '+verb;
 }
 return s.replaceAll('_',' ');
};
const detailLabel=v=>detailLabels[v]||label(v);
const actionClass=v=>{const s=String(v||'');if(s.includes('scrap')||s.includes('delete'))return 'soft-danger';if(s.includes('faulty')||s.includes('maintenance'))return 'soft-warning';if(s.includes('assign'))return 'soft-primary';if(s.includes('create'))return 'soft-success';if(s.includes('update'))return 'soft-info';return 'soft-secondary';};
const date=v=>{if(!v)return '—';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return d.toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'});};
const formatDetail=(v,key='')=>{
 if(v===null||v===undefined||v==='')return '—';
 if(typeof v==='boolean')return v?'Evet':'Hayır';
 if(Array.isArray(v))return v.map(x=>formatDetail(x)).join(', ');
 if(typeof v==='object')return Object.entries(v).map(([k,val])=>`${detailLabel(k)}: ${formatDetail(val,k)}`).join(' · ');
 if(key==='action'||key==='status'||key==='old_status'||key==='new_status'||key==='source_type')return label(v);
 return String(v);
};
let page=1, meta={actions:[],entity_types:[],users:[]};
async function json(url,opts){const r=await fetch(url,opts);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'İşlem başarısız');return d}
async function loadMeta(){try{meta=await json('/api/logs/meta')}catch(e){console.error(e)}}
async function load(){if(location.hash.slice(1)!=='logs')return;const c=document.querySelector('#pageContent');if(!c)return;await loadMeta();render(c);await refresh(c)}
function render(c){c.innerHTML=`<div class="page-head"><div><h1>Kayıtlar</h1><p>Sistem üzerindeki işlemler ve denetim geçmişi.</p></div></div><div class="panel mb-3"><div class="filter-bar"><input id="logQ" placeholder="İşlem, modül, kullanıcı veya detay ara..."><select id="logAction"><option value="">Tüm işlemler</option>${meta.actions.map(x=>`<option value="${esc(x)}">${esc(label(x))}</option>`).join('')}</select><select id="logEntity"><option value="">Tüm modüller</option>${meta.entity_types.map(x=>`<option value="${esc(x)}">${esc(label(x))}</option>`).join('')}</select><select id="logUser"><option value="">Tüm kullanıcılar</option>${meta.users.map(x=>`<option value="${x.id}">${esc(x.username)}</option>`).join('')}</select><input id="logFrom" type="date" title="Başlangıç tarihi"><input id="logTo" type="date" title="Bitiş tarihi"><button class="btn btn-primary" id="logFilter"><i class="ti ti-filter me-1"></i>Filtrele</button><button class="btn btn-outline-secondary" id="logClear">Temizle</button></div></div><div class="panel"><div class="panel-head"><div><h3>Denetim Kayıtları</h3><p>Silme veya değiştirme işlemi bu ekrandan yapılamaz.</p></div><span id="logCount" class="text-secondary small"></span></div><div id="logTable" class="table-responsive"></div><div id="logPager" class="p-3"></div></div>`;document.querySelector('#logFilter').onclick=()=>{page=1;refresh(c)};document.querySelector('#logQ').addEventListener('input',()=>{clearTimeout(window.__logSearchTimer);window.__logSearchTimer=setTimeout(()=>{page=1;refresh(c)},300)});document.querySelector('#logClear').onclick=()=>{['logQ','logAction','logEntity','logUser','logFrom','logTo'].forEach(id=>{const el=document.querySelector('#'+id);if(el)el.value=''});page=1;refresh(c)};['logQ','logAction','logEntity','logUser','logFrom','logTo'].forEach(id=>document.querySelector('#'+id).addEventListener('keydown',e=>{if(e.key==='Enter'){page=1;refresh(c)}}))}
async function refresh(c){const p=new URLSearchParams({page,per_page:25});const map={q:'logQ',action:'logAction',entity_type:'logEntity',actor_id:'logUser',date_from:'logFrom',date_to:'logTo'};Object.entries(map).forEach(([k,id])=>{const v=document.querySelector('#'+id)?.value;if(v)p.set(k,v)});try{const d=await json('/api/logs?'+p);document.querySelector('#logCount').textContent=`${d.pagination.total.toLocaleString('tr-TR')} kayıt`;document.querySelector('#logTable').innerHTML=`<style>.audit-action{display:inline-flex;align-items:center;min-height:28px;padding:.3rem .65rem;border-radius:999px;font-size:.78rem;font-weight:600;line-height:1.2;white-space:nowrap}.soft-danger{background:#fde8e8;color:#a61b1b}.soft-warning{background:#fff4d6;color:#8a5a00}.soft-primary{background:#e8f0ff;color:#315ea8}.soft-success{background:#e8f7ee;color:#287a4d}.soft-info{background:#e7f5f8;color:#216878}.soft-secondary{background:#f0f2f5;color:#59636f}</style><table class="table align-middle mb-0"><thead><tr><th>TARİH</th><th>KULLANICI</th><th>İŞLEM</th><th>MODÜL</th><th>VARLIK</th><th>DETAY</th></tr></thead><tbody>${d.items.map(x=>`<tr><td class="text-nowrap">${esc(date(x.created_at))}</td><td><strong>${esc(x.actor?.username||'Sistem')}</strong></td><td><span class="audit-action ${actionClass(x.action)}">${esc(actionLabels[x.action]||label(x.action))}</span></td><td>${esc(entityLabels[x.entity_type]||label(x.entity_type))}</td><td>${x.entity_id??'—'}</td><td><button class="btn btn-sm btn-outline-secondary" data-log-id="${x.id}"><i class="ti ti-eye"></i></button></td></tr>`).join('')||'<tr><td colspan="6" class="text-center text-secondary py-4">Kayıt bulunamadı.</td></tr>'}</tbody></table>`;document.querySelectorAll('[data-log-id]').forEach(b=>b.onclick=()=>showDetail(d.items.find(x=>String(x.id)===b.dataset.logId)));renderPager(d.pagination)}catch(e){document.querySelector('#logTable').innerHTML=`<div class="p-4 text-danger">${esc(e.message)}</div>`}}
function renderPager(p){const el=document.querySelector('#logPager');if(p.pages<=1){el.innerHTML='';return}el.innerHTML=`<div class="d-flex justify-content-between align-items-center"><small class="text-secondary">Sayfa ${p.page} / ${p.pages}</small><div class="btn-group"><button class="btn btn-sm btn-outline-secondary" ${p.page<=1?'disabled':''} id="logPrev">Önceki</button><button class="btn btn-sm btn-outline-secondary" ${p.page>=p.pages?'disabled':''} id="logNext">Sonraki</button></div></div>`;document.querySelector('#logPrev').onclick=()=>{page--;refresh(document.querySelector('#pageContent'))};document.querySelector('#logNext').onclick=()=>{page++;refresh(document.querySelector('#pageContent'))}}
function showDetail(x){if(!x)return;const rows=[['İşlem',label(x.action)],['Modül',entityLabels[x.entity_type]||label(x.entity_type)],['Kayıt ID',x.entity_id??'—'],['Kullanıcı',x.actor?.username||'Sistem'],['Tarih',date(x.created_at)]];const body=Object.entries(x.details||{}).map(([k,v])=>`<div class="d-flex justify-content-between gap-3 py-2 border-bottom"><span class="text-secondary">${esc(detailLabel(k))}</span><strong class="text-end">${esc(formatDetail(v,k))}</strong></div>`).join('');const summary=rows.map(([k,v])=>`<div class="d-flex justify-content-between gap-3 py-2 border-bottom"><span class="text-secondary">${esc(k)}</span><strong class="text-end">${esc(String(v))}</strong></div>`).join('');const old=document.querySelector('#logDetailModal');if(old)old.remove();document.body.insertAdjacentHTML('beforeend',`<div class="modal fade" id="logDetailModal" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content"><div class="modal-header"><div><h5 class="modal-title">Kayıt #${x.id}</h5><div class="small text-secondary">${esc(label(x.action))}</div></div><button class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><h6 class="mb-2">İşlem bilgileri</h6>${summary}<h6 class="mt-4 mb-2">Detaylar</h6>${body||'<div class="text-secondary">Bu işlem için ek detay bulunmuyor.</div>'}</div></div></div></div>`);new bootstrap.Modal(document.querySelector('#logDetailModal')).show()}
window.addEventListener('hashchange',()=>setTimeout(load,80));window.IT_LOGS_API={load};
})();