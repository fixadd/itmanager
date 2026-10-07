/* PostgreSQL-backed maintenance / repair screen. */
(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const labels={pending:['Bekliyor','secondary'],in_progress:['İşlemde','warning'],service:['Serviste','info'],completed:['Tamamlandı','success'],cancelled:['İptal','danger']};
const typeLabels={internal:'İç Bakım',service:'Dış Servis / Tamir',periodic:'Periyodik Bakım'};
const status=s=>{const x=labels[s]||[s||'Bilinmiyor','secondary'];return `<span class="status ${x[1]}">${esc(x[0])}</span>`};
const toast=m=>window.itToast?.(m);let maintenanceStatsCache=null;
const json=async(url,opts={})=>{const r=await fetch(url,{headers:{'Content-Type':'application/json','Accept':'application/json',...(opts.headers||{})},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'İşlem başarısız');return d};

const row=x=>{const tr=document.createElement('tr');tr.dataset.recordType='maintenance';tr.dataset.maintenanceId=x.id;tr.innerHTML=`<td><strong>${esc(x.inventory?.inventory_no||'—')}</strong><small class="d-block text-muted">${esc(x.inventory?.computer_name||'')}</small></td><td>${esc(x.personnel?.name||'IT Stok')}</td><td>${esc(x.fault||'—')}</td><td>${esc(x.service||'—')}</td><td>${esc(x.started_at?new Date(x.started_at).toLocaleDateString('tr-TR'):'—')}</td><td>${esc(x.completed_at?new Date(x.completed_at).toLocaleDateString('tr-TR'):'—')}</td><td>${status(x.status)}</td><td class="action-cell"><button class="btn btn-sm btn-light maintenance-actions" title="Detay"><i class="ti ti-eye"></i></button></td>`;return tr};

const renderDetail=x=>`<tr class="inline-detail maintenance-inline-detail"><td colspan="8"><div class="inline-detail-box"><div class="inline-detail-head"><div><strong>${esc(x.inventory?.inventory_no||'—')}</strong><span>${esc(typeLabels[x.type]||x.type||'Bakım / Tamir')}</span></div><button class="btn btn-sm btn-outline-secondary maintenance-close">Kapat</button></div><div class="detail-grid">${[['Cihaz','inventory'],['Personel','personnel'],['Arıza','fault'],['Açıklama','description'],['Servis','service'],['Bakımı Açan','created_by'],['Başlangıç','started_at'],['Bitiş','completed_at'],['Durum','status'],['Maliyet','cost'],['Not','note']].map(([l,k])=>{let v=x[k];if(v&&typeof v==='object')v=v.name||v.inventory_no;if(k==='status')v=labels[x.status]?.[0]||x.status;if(k.endsWith('_at')&&v)v=new Date(v).toLocaleString('tr-TR');return `<div class="detail-field"><span>${l}</span><strong>${esc(v||'—')}</strong></div>`}).join('')}</div></div></td></tr>`;

async function refreshStats(){try{const d=maintenanceStatsCache||await json('/api/maintenance/summary');maintenanceStatsCache=d;const map={service:'maintenanceStatService',pending:'maintenanceStatPending',completed:'maintenanceStatCompleted'};Object.entries(map).forEach(([k,id])=>{const el=document.getElementById(id);if(el)el.textContent=d[k]??0})}catch(e){console.warn(e)}}

let loadController=null;async function load(page=1){if(location.hash.slice(1)!=='maintenance')return;loadController?.abort();loadController=new AbortController();const signal=loadController.signal;const panel=document.querySelector('#pageContent .panel');if(!panel)return;try{const p=new URLSearchParams();const search=document.querySelector('#maintenanceSearch')?.value.trim();const statusValue=document.querySelector('#maintenanceStatus')?.value;if(search)p.set('search',search);if(statusValue)p.set('status',statusValue);p.set('page',page);p.set('per_page','25');const d=await json('/api/maintenance?'+p,{signal});const tbody=panel.querySelector('tbody');if(!tbody)return;tbody.innerHTML='';(d.items||[]).forEach(x=>tbody.appendChild(row(x)));if(!d.items?.length)tbody.innerHTML='<tr><td colspan="8" class="text-center text-secondary py-4">Bakım kaydı bulunamadı.</td></tr>';const sub=panel.querySelector('.panel-head p');if(sub)sub.textContent=`PostgreSQL · ${d.pagination?.total||0} kayıt`;renderPagination(d.pagination);refreshStats()}catch(e){if(e.name==='AbortError')return;console.warn(e);toast('Bakım API bağlantısı kurulamadı.')}}


function renderPagination(p){const box=document.querySelector('#maintenancePagination');if(!box)return;if(!p||p.pages<=1){box.innerHTML='';return}let h='<button class="btn btn-sm btn-outline-secondary" data-maint-page="'+(p.page-1)+'" '+(p.page<=1?'disabled':'')+'>‹</button>';for(let i=Math.max(1,p.page-2);i<=Math.min(p.pages,p.page+2);i++)h+='<button class="btn btn-sm '+(i===p.page?'btn-primary':'btn-outline-secondary')+'" data-maint-page="'+i+'">'+i+'</button>';h+='<button class="btn btn-sm btn-outline-secondary" data-maint-page="'+(p.page+1)+'" '+(p.page>=p.pages?'disabled':'')+'>›</button>';box.innerHTML='<div class="d-flex justify-content-between align-items-center mt-3"><small class="text-secondary">'+p.total+' kayıt · Sayfa '+p.page+'/'+p.pages+'</small><div class="btn-group">'+h+'</div></div>'}
let inventoryOptionCache=null;
let inventoryOptionCacheAt=0;
async function getInventoryOptions(){
 const now=Date.now();
 if(inventoryOptionCache && now-inventoryOptionCacheAt<60000)return inventoryOptionCache;
 const r=await fetch('/api/maintenance/inventory-options',{headers:{Accept:'application/json'}});
 if(!r.ok)throw Error('Envanter listesi alınamadı');
 const d=await r.json();
 inventoryOptionCache=d.items||[];
 inventoryOptionCacheAt=now;
 return inventoryOptionCache;
}
async function openCreate(){
try{
 const body=`<form id="itDynamicForm" data-form-page="maintenance"><div class="row g-3"><div class="col-md-6"><label class="form-label">Envanter <span class="text-danger">*</span></label><select class="form-select" name="inventory_id" required><option value="">Envanter listesi yükleniyor...</option></select></div><div class="col-md-6"><label class="form-label">Bakım Türü</label><select class="form-select" name="type"><option value="internal">İç Bakım</option><option value="service">Dış Servis / Tamir</option><option value="periodic">Periyodik Bakım</option></select></div><div class="col-md-6"><label class="form-label">Arıza / Konu <span class="text-danger">*</span></label><input class="form-control" name="fault" required></div><div class="col-md-6"><label class="form-label">Servis / Firma</label><input class="form-control" name="service"></div><div class="col-md-6"><label class="form-label">Bakımı Açan</label><input class="form-control" value="Giriş yapan kullanıcı" readonly></div><div class="col-12"><label class="form-label">Açıklama</label><textarea class="form-control" name="description" rows="2"></textarea></div><div class="col-12"><label class="form-label">Not</label><textarea class="form-control" name="note" rows="2"></textarea></div></div></form>`;
 window.ITUI?.modal('Yeni Bakım Kaydı',body);
 const select=document.querySelector('#itManagerModal select[name="inventory_id"]');
 getInventoryOptions().then(items=>{if(!select)return;select.innerHTML='<option value="">Cihaz seçiniz</option>'+items.filter(x=>x.status!=='scrapped').map(x=>`<option value="${x.id}">${esc(x.inventory_no)} — ${esc(x.computer_name||x.serial_no||'')}</option>`).join('')}).catch(e=>toast(e.message));
 document.querySelector('#itManagerModal [data-save]')?.removeAttribute('data-maint-edit');
}catch(e){toast(e.message)}
}
async function save(){const f=document.querySelector('#itDynamicForm[data-form-page="maintenance"]');if(!f||!f.reportValidity())return;try{const p=Object.fromEntries(new FormData(f).entries());p.inventory_id=Number(p.inventory_id);if(p.cost)p.cost=Number(p.cost);else delete p.cost;const d=await json('/api/maintenance',{method:'POST',body:JSON.stringify(p)});bootstrap.Modal.getInstance(document.getElementById('itManagerModal'))?.hide();toast(`Bakım kaydı oluşturuldu: ${d.inventory?.inventory_no||''}`);maintenanceStatsCache=null;await load()}catch(e){toast(e.message)}}

async function openDetail(id){try{const x=await json('/api/maintenance/'+id);const tr=document.querySelector(`tr[data-maintenance-id="${id}"]`);document.querySelector('.maintenance-inline-detail')?.remove();if(tr)tr.insertAdjacentHTML('afterend',renderDetail(x))}catch(e){toast(e.message)}}
async function editRecord(id){try{const x=await json('/api/maintenance/'+id);const body=`<form id="itDynamicForm" data-form-page="maintenance"><div class="row g-3"><div class="col-md-6"><label class="form-label">Arıza / Konu *</label><input class="form-control" name="fault" required value="${esc(x.fault)}"></div><div class="col-md-6"><label class="form-label">Durum</label><select class="form-select" name="status">${Object.entries(labels).map(([k,v])=>`<option value="${k}" ${x.status===k?'selected':''}>${v[0]}</option>`).join('')}</select></div><div class="col-md-6"><label class="form-label">Servis / Firma</label><input class="form-control" name="service" value="${esc(x.service)}"></div><div class="col-md-6"><label class="form-label">Teknisyen</label><input class="form-control" name="technician" value="${esc(x.technician)}"></div><div class="col-md-6"><label class="form-label">Maliyet</label><input class="form-control" type="number" min="0" step="0.01" name="cost" value="${x.cost??''}"></div><div class="col-12"><label class="form-label">Açıklama</label><textarea class="form-control" name="description" rows="2">${esc(x.description)}</textarea></div><div class="col-12"><label class="form-label">Not</label><textarea class="form-control" name="note" rows="2">${esc(x.note)}</textarea></div></div></form>`;window.ITUI?.modal('Bakım Kaydını Düzenle',body);document.querySelector('#itManagerModal [data-save]')?.setAttribute('data-maint-edit',String(id))}catch(e){toast(e.message)}}
async function operation(id,op){
try{
 if(op==='detail'){await openDetail(id);return} else if(op==='edit'){await editRecord(id);return} else if(op==='status'){const body='<label class="form-label">Durum</label><select id="mtStatusChoice" class="form-select"><option value="pending">Bekliyor</option><option value="in_progress">İşlemde</option><option value="service">Serviste</option><option value="completed">Tamamlandı</option><option value="cancelled">İptal</option></select>';ITUI.modal('Bakım Durumu',body,{footer:'<button class="btn btn-light" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary" id="mtStatusSave">Uygula</button>'});document.getElementById('mtStatusSave')?.addEventListener('click',async()=>{const b=document.getElementById('mtStatusSave');if(b?.dataset.busy==='1')return;const s=document.getElementById('mtStatusChoice')?.value;if(!s)return;if(b){b.dataset.busy='1';b.disabled=true;b.textContent='İşleniyor...';}try{await json(`/api/maintenance/${id}/status`,{method:'POST',body:JSON.stringify({status:s})});bootstrap.Modal.getInstance(document.getElementById('itManagerModal'))?.hide();toast('Bakım durumu güncellendi.');maintenanceStatsCache=null}finally{if(b){b.disabled=false;b.textContent='Uygula';delete b.dataset.busy}}})}
 else if(op==='service'){const body='<label class="form-label">Servis / firma adı</label><input id="mtServiceName" class="form-control" required>';ITUI.modal('Servise Gönder',body,{footer:'<button class="btn btn-light" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary" id="mtServiceSave">Gönder</button>'});document.getElementById('mtServiceSave')?.addEventListener('click',async()=>{const b=document.getElementById('mtServiceSave');if(b?.dataset.busy==='1')return;const service=document.getElementById('mtServiceName')?.value.trim();if(!service)return toast('Servis / firma adı zorunludur.');if(b){b.dataset.busy='1';b.disabled=true;b.textContent='Gönderiliyor...';}try{await json(`/api/maintenance/${id}`,{method:'PATCH',body:JSON.stringify({service,status:'service'})});bootstrap.Modal.getInstance(document.getElementById('itManagerModal'))?.hide();toast('Cihaz servise gönderildi.');maintenanceStatsCache=null}finally{if(b){b.disabled=false;b.textContent='Gönder';delete b.dataset.busy}}})}
 else if(op==='complete'){await json(`/api/maintenance/${id}/status`,{method:'POST',body:JSON.stringify({status:'completed'})});toast('Bakım tamamlandı.')}
 maintenanceStatsCache=null;
 await load()
}catch(e){toast(e.message)}}

document.addEventListener('click',async e=>{
 const b=e.target.closest('#itManagerModal [data-save]');
 if(b&&location.hash==='#maintenance'){
  e.preventDefault();e.stopImmediatePropagation();
  if(b.dataset.busy==='1')return;
  b.dataset.busy='1';b.disabled=true;b.textContent='İşleniyor...';
  const editId=b.dataset.maintEdit;
  if(!editId){try{await save()}finally{b.disabled=false;b.textContent='Kaydet';delete b.dataset.busy}return}
  const form=document.querySelector('#itDynamicForm[data-form-page="maintenance"]');
  if(!form||!form.reportValidity())return;
  try{
   const p=Object.fromEntries(new FormData(form).entries());
   if(p.cost)p.cost=Number(p.cost);else delete p.cost;
   await json('/api/maintenance/'+editId,{method:'PATCH',body:JSON.stringify(p)});
   bootstrap.Modal.getInstance(document.getElementById('itManagerModal'))?.hide();
   toast('Bakım kaydı güncellendi.');
   maintenanceStatsCache=null;
   await load();
  }catch(err){toast(err.message)}finally{b.disabled=false;b.textContent='Kaydet';delete b.dataset.busy}
  return;
 }
 const pageBtn=e.target.closest('[data-maint-page]');if(pageBtn){e.preventDefault();load(Number(pageBtn.dataset.maintPage));return}
 const newBtn=e.target.closest('#maintenanceNew');if(newBtn&&location.hash==='#maintenance'){e.preventDefault();e.stopImmediatePropagation();openCreate();return}
 if(e.target.closest('#maintenanceRefresh')){e.preventDefault();load();return}
 const close=e.target.closest('.maintenance-close');if(close){e.preventDefault();close.closest('.maintenance-inline-detail')?.remove();return}
 const tr=e.target.closest('tr[data-record-type="maintenance"]');if(!tr)return;
 const id=Number(tr.dataset.maintenanceId);
 if(e.target.closest('.maintenance-actions')){e.preventDefault();e.stopImmediatePropagation();operation(id,'detail');return}
 const op=e.target.closest('[data-maint-op]');if(op){e.preventDefault();e.stopImmediatePropagation();op.parentElement.remove();operation(id,op.dataset.maintOp)}
});
let timer;
document.addEventListener('input',e=>{if(e.target.id==='maintenanceSearch'){clearTimeout(timer);timer=setTimeout(load,250)}});
document.addEventListener('change',e=>{if(e.target.id==='maintenanceStatus')load()});document.addEventListener('click',e=>{const tab=e.target.closest('[data-maint-tab]');if(!tab)return;const s=document.querySelector('#maintenanceStatus');if(s)s.value=tab.dataset.maintTab==='all'?'':tab.dataset.maintTab;document.querySelectorAll('[data-maint-tab]').forEach(x=>x.classList.remove('active'));tab.classList.add('active');load()});
window.addEventListener('hashchange',()=>setTimeout(load,100));
document.addEventListener('DOMContentLoaded',()=>{if(location.hash==='#maintenance')setTimeout(load,250)});
})();
