/* Personnel management screen. */
(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const toast=m=>window.itToast?.(m);
const json=async(url,opts={})=>{const r=await fetch(url,{headers:{'Content-Type':'application/json','Accept':'application/json',...(opts.headers||{})},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'İşlem başarısız');return d};
let page=1,perPage=25,departments=[],currentPerson=null;

const tableRow=p=>{
 const tr=document.createElement('tr');
 tr.dataset.recordType='personnel';tr.dataset.personnelId=p.id;
 tr.innerHTML=`<td><strong>${esc(p.employee_no||'—')}</strong></td><td><strong>${esc(p.name)}</strong></td><td>${esc(p.email||'—')}</td><td>${esc(p.department?.name||'—')}</td><td><span class="status ${p.active?'success':'secondary'}">${p.active?'Aktif':'Pasif'}</span></td><td><span class="badge text-bg-light">${p.asset_count||0}</span></td><td class="action-cell"><button class="btn btn-sm btn-light personnel-eye" title="Detay"><i class="ti ti-eye"></i></button><button class="btn btn-sm btn-light ms-1 personnel-edit" title="Düzenle"><i class="ti ti-edit"></i></button><button class="btn btn-sm btn-light ms-1 personnel-toggle" title="${p.active?'Pasife al':'Aktif et'}"><i class="ti ti-${p.active?'user-off':'user-check'}"></i></button></td>`;
 return tr;
};

const detail=x=>{
 const a=x.assets||{},inv=a.inventory||[],lic=a.licenses||[],stock=a.stock_movements||[],history=x.history||[];
 return `<tr class="inline-detail"><td colspan="7"><div class="inline-detail-box">
 <div class="inline-detail-head"><div><strong>${esc(x.name)}</strong><span>${esc(x.employee_no||'Personel')} · ${esc(x.department?.name||'Departman yok')}</span></div><button class="btn btn-sm btn-outline-secondary personnel-close">Kapat</button></div>
 <div class="detail-grid">
  <div class="detail-field"><span>Personel No</span><strong>${esc(x.employee_no||'—')}</strong></div>
  <div class="detail-field"><span>E-posta</span><strong>${esc(x.email||'—')}</strong></div>
  <div class="detail-field"><span>Durum</span><strong>${x.active?'Aktif':'Pasif'}</strong></div>
  <div class="detail-field"><span>Envanter / Lisans</span><strong>${inv.length} / ${lic.length}</strong></div>
 </div>
 <div class="detail-section"><h4>ÜZERİNDEKİ ENVANTERLER</h4>${inv.length?`<div class="table-responsive"><table class="table table-sm"><tbody>${inv.map(v=>`<tr><td><strong>${esc(v.inventory_no)}</strong></td><td>${esc(v.type||'')}</td><td>${esc([v.brand,v.model].filter(Boolean).join(' ')||'—')}</td><td><button class="btn btn-sm btn-outline-primary personnel-transfer" data-asset="${v.id}" data-kind="inventory">Başkasına Aktar</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="text-secondary small">Üzerinde envanter yok.</div>'}</div>
 <div class="detail-section"><h4>ATANMIŞ LİSANSLAR</h4>${lic.length?lic.map(v=>`<div class="d-flex justify-content-between align-items-center border-bottom py-2"><span>${esc(v.name||'Lisans')} ${v.expires_at?`<small class="text-secondary">· ${esc(v.expires_at)}</small>`:''}</span><button class="btn btn-sm btn-outline-primary personnel-transfer" data-asset="${v.id}" data-kind="license">Başkasına Aktar</button></div>`).join(''):'<div class="text-secondary small">Atanmış lisans yok.</div>'}</div>
 <div class="detail-section"><h4>SARF / STOK HAREKETLERİ</h4>${stock.length?`<div class="table-responsive"><table class="table table-sm"><thead><tr><th>İşlem</th><th>Miktar</th><th>Not</th><th>Tarih</th></tr></thead><tbody>${stock.slice(0,20).map(v=>`<tr><td>${esc(v.movement_type)}</td><td>${esc(v.quantity)} ${esc(v.unit)}</td><td>${esc(v.note||'—')}</td><td>${v.created_at?new Date(v.created_at).toLocaleString('tr-TR'):''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="text-secondary small">Sarf/stok hareketi yok.</div>'}</div>
 <div class="detail-section"><h4>GEÇMİŞ DEVİRLER / İŞLEMLER</h4>${history.length?history.slice(0,20).map(h=>`<div class="d-flex justify-content-between py-2 border-bottom"><span>${esc(h.asset_type)} #${esc(h.asset_id)} · ${esc(h.action)}</span><small>${h.created_at?new Date(h.created_at).toLocaleString('tr-TR'):''}</small></div>`).join(''):'<div class="text-secondary small">Geçmiş kayıt yok.</div>'}</div>
 </div></td></tr>`;
};

function pager(panel,total,pages){
 let el=panel.querySelector('.personnel-pager');if(!el){el=document.createElement('div');el.className='personnel-pager d-flex justify-content-between align-items-center mt-3';panel.appendChild(el)}
 el.innerHTML=`<div class="small text-secondary">Sayfa ${page} / ${Math.max(pages||1,1)} · ${total||0} personel</div><div class="btn-group"><button class="btn btn-sm btn-outline-secondary" data-personnel-page="prev" ${page<=1?'disabled':''}>Önceki</button><button class="btn btn-sm btn-outline-secondary" data-personnel-page="next" ${page>=(pages||1)?'disabled':''}>Sonraki</button></div>`;
}

async function loadDepartments(){
 try{
  const first=await json('/api/settings/departments?per_page=100&page=1');
  const firstItems=Array.isArray(first)?first:(first.items||first.departments||[]);
  const pages=Math.min(100,Number(first.pagination?.pages||1));
  const rest=pages>1?await Promise.all(Array.from({length:pages-1},(_,i)=>json('/api/settings/departments?per_page=100&page='+(i+2)))):[];
  departments=[...firstItems,...rest.flatMap(d=>Array.isArray(d)?d:(d.items||d.departments||[]))].filter(x=>x.active!==false);
 }catch{departments=[]}
 const sel=document.querySelector('#personnelDepartment');if(sel)sel.innerHTML='<option value="">Tüm Departmanlar</option>'+departments.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');
}
async function load(target=1){
 if(!['people','personnel'].includes(location.hash.slice(1)))return;
 const panel=document.querySelector('#personnelPanel');if(!panel)return;
 const q=document.querySelector('#personnelSearch')?.value.trim()||'';
 const status=document.querySelector('#personnelStatus')?.value||'';
 const department=document.querySelector('#personnelDepartment')?.value||'';
 const params=new URLSearchParams({page:Math.max(target,1),per_page:String(perPage)});if(q)params.set('q',q);if(status)params.set('status',status);if(department)params.set('department_id',department);
 try{
  const d=await json('/api/personnel?'+params.toString());page=d.pagination?.page||target;
  const tbody=panel.querySelector('#personnelTable tbody');tbody.innerHTML='';
  (d.items||[]).forEach(p=>tbody.appendChild(tableRow(p)));
  const countEl=panel.querySelector('.personnel-count') || panel.querySelector('.panel-head p'); if(countEl)countEl.textContent=`PostgreSQL · ${d.pagination?.total??d.total??0} personel`;
  pager(panel,d.pagination?.total??d.total??0,d.pagination?.pages??1);
 }catch(e){toast(e.message)}
}

function modal(title,body,saveText='Kaydet'){
 document.querySelector('#personnelModal')?.remove();
 const wrap=document.createElement('div');wrap.innerHTML=`<div class="modal fade" id="personnelModal" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">${esc(title)}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body">${body}</div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Vazgeç</button><button type="button" class="btn btn-primary" id="personnelModalSave">${saveText}</button></div></div></div></div>`;
 document.body.appendChild(wrap.firstElementChild);const el=document.querySelector('#personnelModal');const instance=bootstrap.Modal.getOrCreateInstance(el);instance.show();return {el,instance};
}

function openForm(person=null){
 const p=person||{};currentPerson=p;
 const body=`<form id="personnelForm"><div class="row g-3">
 <div class="col-md-6"><label class="form-label">Personel No</label><input class="form-control" name="employee_no" value="${esc(p.employee_no||'')}" placeholder="Örn. 10245"></div>
 <div class="col-md-6"><label class="form-label">Ad Soyad <span class="text-danger">*</span></label><input class="form-control" name="name" value="${esc(p.name||'')}" required></div>
 <div class="col-md-6"><label class="form-label">E-posta</label><input class="form-control" type="email" name="email" value="${esc(p.email||'')}"></div>
 <div class="col-md-6"><label class="form-label">Departman</label><select class="form-select" name="department_id"><option value="">Departman seçiniz</option>${departments.map(d=>`<option value="${d.id}" ${String(d.id)===String(p.department?.id||'')?'selected':''}>${esc(d.name)}</option>`).join('')}</select></div>
 <div class="col-12"><div class="form-check"><input class="form-check-input" type="checkbox" name="active" id="personnelActive" ${p.id==null||p.active?'checked':''}><label class="form-check-label" for="personnelActive">Aktif personel</label></div></div>
 </div></form>`;
 const m=modal(p.id?'Personel Düzenle':'Yeni Personel',body);
 m.el.querySelector('#personnelModalSave').onclick=async()=>{
  const form=m.el.querySelector('#personnelForm');if(!form.reportValidity())return;
  const fd=new FormData(form);const data={employee_no:fd.get('employee_no'),name:fd.get('name'),email:fd.get('email'),department_id:fd.get('department_id')||null,active:fd.get('active')==='on'};
  try{await json(p.id?`/api/personnel/${p.id}`:'/api/personnel',{method:p.id?'PATCH':'POST',body:JSON.stringify(data)});m.instance.hide();m.el.addEventListener('hidden.bs.modal',()=>m.el.remove(),{once:true});toast(p.id?'Personel güncellendi.':'Personel oluşturuldu.');await load(page)}catch(e){toast(e.message)}
 };
}

async function openDetail(id,tr){
 try{const x=await json('/api/personnel/'+id);const old=tr.nextElementSibling;if(old?.classList.contains('inline-detail'))old.remove();else tr.insertAdjacentHTML('afterend',detail(x))}
 catch(e){toast(e.message)}
}

async function chooseTarget(sourceId,assets){
 const all=[];
 for(let p=1;p<=100;p++){
  const list=await json('/api/personnel?per_page=100&status=active&page='+p);
  const items=list.items||list.personnel||[];
  if(!Array.isArray(items)||!items.length)break;
  all.push(...items);
  const pages=Number(list.pagination?.pages||1);
  if(p>=pages||items.length<100)break;
 }
 const options=all.filter(p=>p.id!==sourceId).map(p=>'<option value="'+p.id+'">'+esc(p.employee_no||'—')+' · '+esc(p.name)+'</option>').join('');
 if(!options){toast('Aktif hedef personel bulunamadı.');return}
 const body=`<form id="transferForm"><div class="mb-3"><label class="form-label">Yeni personel</label><select class="form-select" name="target_personnel_id" required><option value="">Seçiniz</option>${options}</select></div><div><label class="form-label">Devir notu</label><textarea class="form-control" name="note" rows="3" placeholder="İsteğe bağlı"></textarea></div></form>`;
 const m=modal('Varlık Devir',body,'Devret');
 m.el.querySelector('#personnelModalSave').onclick=async()=>{
  const form=m.el.querySelector('#transferForm');if(!form.reportValidity())return;const fd=new FormData(form);
  try{await json('/api/personnel/'+sourceId+'/transfer',{method:'POST',body:JSON.stringify({target_personnel_id:Number(fd.get('target_personnel_id')),assets:[assets],note:fd.get('note')})});m.instance.hide();m.el.addEventListener('hidden.bs.modal',()=>m.el.remove(),{once:true});toast('Varlık yeni personele devredildi.');await load(page)}
  catch(e){toast(e.message)}
 };
}

document.addEventListener('click',async e=>{
 if(location.hash.slice(1)!=='people')return;
 const pg=e.target.closest('[data-personnel-page]');if(pg&&!pg.disabled){e.preventDefault();e.stopImmediatePropagation();await load(pg.dataset.personnelPage==='next'?page+1:page-1);return}
 if(e.target.closest('#personnelFilterReset')){e.preventDefault();document.querySelector('#personnelSearch').value='';document.querySelector('#personnelStatus').value='';document.querySelector('#personnelDepartment').value='';await load(1);return}
 if(e.target.closest('#personnelRefresh')){e.preventDefault();await load(page);return}
 if(e.target.closest('#personnelNew')){e.preventDefault();openForm();loadDepartments();return}
 const edit=e.target.closest('.personnel-edit');if(edit){e.preventDefault();e.stopImmediatePropagation();const tr=edit.closest('tr');const p=await json('/api/personnel/'+Number(tr.dataset.personnelId));openForm(p);loadDepartments();return}
 const toggle=e.target.closest('.personnel-toggle');if(toggle){e.preventDefault();e.stopImmediatePropagation();const tr=toggle.closest('tr');try{await json('/api/personnel/'+Number(tr.dataset.personnelId)+'/toggle',{method:'POST'});toast('Personel durumu güncellendi.');await load(page)}catch(err){toast(err.message)}return}
 const close=e.target.closest('.personnel-close');if(close){e.preventDefault();e.stopImmediatePropagation();close.closest('tr.inline-detail')?.remove();return}
 const eye=e.target.closest('.personnel-eye');if(eye){e.preventDefault();e.stopImmediatePropagation();await openDetail(Number(eye.closest('tr').dataset.personnelId),eye.closest('tr'));return}
 const transfer=e.target.closest('.personnel-transfer');if(transfer){e.preventDefault();e.stopImmediatePropagation();await chooseTarget(Number(transfer.closest('tr.inline-detail')?.previousElementSibling?.dataset.personnelId),{asset_type:transfer.dataset.kind,asset_id:Number(transfer.dataset.asset)});return}
});
document.addEventListener('input',e=>{if(location.hash.slice(1)==='people'&&e.target.id==='personnelSearch'){clearTimeout(window.__personnelSearchTimer);window.__personnelSearchTimer=setTimeout(()=>load(1),300)}});
document.addEventListener('change',e=>{if(location.hash.slice(1)==='people'&&(e.target.id==='personnelStatus'||e.target.id==='personnelDepartment'))load(1)});
window.addEventListener('hashchange',()=>{page=1;setTimeout(()=>{loadDepartments();load(1)},100)});
document.addEventListener('DOMContentLoaded',()=>{if(location.hash.slice(1)==='people')setTimeout(()=>{loadDepartments();load(1)},300)});
window.IT_PERSONNEL_API={load,loadDepartments,openForm};
})();