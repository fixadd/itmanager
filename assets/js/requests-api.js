/* Purchase requests - PostgreSQL API integration */
(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const labels={draft:'Taslak',pending:'Bekliyor',approved:'Onaylandı',rejected:'Reddedildi',ordered:'Sipariş Verildi',completed:'Tamamlandı',cancelled:'İptal'};
const badge=s=>`<span class="status ${s==='rejected'||s==='cancelled'?'danger':s==='pending'?'warning':s==='completed'?'success':'info'}">${esc(labels[s]||s)}</span>`;
let current=[];let currentPage=1;let totalPages=1;
function renderPagination(){const box=document.querySelector('#requestPagination');if(!box)return;if(totalPages<=1){box.innerHTML='';return}const start=Math.max(1,currentPage-2),end=Math.min(totalPages,currentPage+2);let h='';if(start>1)h+='<button type="button" class="btn btn-sm btn-outline-secondary request-page" data-page="1">1</button>';for(let i=start;i<=end;i++)h+=`<button type="button" class="btn btn-sm ${i===currentPage?'btn-primary':'btn-outline-secondary'} request-page" data-page="${i}">${i}</button>`;if(end<totalPages)h+='<button type="button" class="btn btn-sm btn-outline-secondary request-page" data-page="'+totalPages+'">'+totalPages+'</button>';box.innerHTML='<div class="d-flex justify-content-center gap-1 mt-3">'+h+'</div>'}
async function load(pageNo=1){
 try{
  if(page()!=='requests')return;
  const p=new URLSearchParams({per_page:'25',page:String(pageNo)});
  const s=document.querySelector('#requestSearch')?.value.trim(),st=document.querySelector('#requestStatus')?.value,pr=document.querySelector('#requestPriority')?.value;
  if(s)p.set('search',s); if(st)p.set('status',st); if(pr)p.set('priority',pr);
  const r=await fetch('/api/requests?'+p.toString(),{headers:{Accept:'application/json'}});if(!r.ok)throw Error();
  const data=await r.json();current=data.items||[];currentPage=data.pagination?.page||pageNo;totalPages=data.pagination?.pages||1;window.IT_REQUESTS=current;render(current);renderPagination();
  const counts=data.status_counts||{};['pending','approved','ordered','completed'].forEach(k=>{const el=document.querySelector('#requestStat'+k[0].toUpperCase()+k.slice(1));if(el)el.textContent=Number(counts[k]||0)});
 }catch(e){console.warn('Talep API yüklenemedi',e)}
}
function page(){return location.hash.replace(/^#\/?/,'').split('/')[0]}
function render(items){
 if(page()!=='requests')return;
 const tables=[...document.querySelectorAll('.table')];
 const table=tables.find(t=>/TALEP|DURUM|ÖNCELİK/.test(t.querySelector('thead')?.textContent||''));
 if(!table)return;
 const body=table.querySelector('tbody'); if(!body)return;
 body.innerHTML=items.length?items.map(x=>`<tr data-request-id="${x.id}"><td><strong>${esc(x.request_no)}</strong></td><td>${esc(x.requester?.name||'—')}</td><td>${esc(x.items?.map(i=>`${i.product_type}${i.model?' · '+i.model:''} × ${i.quantity}` ).join(', ')||'—')}</td><td>${esc(x.priority==='urgent'?'Acil':x.priority==='high'?'Yüksek':x.priority==='low'?'Düşük':'Normal')}</td><td>${badge(x.status)}</td><td>${x.requested_at?new Date(x.requested_at).toLocaleDateString('tr-TR'):'—'}</td><td><div class="btn-group btn-group-sm"><button class="btn btn-light request-detail" data-id="${x.id}"><i class="ti ti-eye"></i></button><button class="btn btn-light request-actions" data-id="${x.id}"><i class="ti ti-dots"></i></button></div></td></tr>`).join(''):`<tr><td colspan="7" class="text-center text-muted py-4">Henüz satın alma talebi bulunmuyor.</td></tr>`;
}
let requestMasterData=null;
async function loadAllRequestPersonnel(headers){
 const personnel=[];
 for(let pageNo=1;;pageNo++){
  const response=await fetch('/api/settings/personnel?per_page=100&page='+pageNo,{headers});
  if(!response.ok)break;
  const data=await response.json();
  const items=data.items||[];
  personnel.push(...items);
  if(items.length<100||(data.pagination?.pages&&pageNo>=data.pagination.pages))break;
 }
 return personnel;
}
async function loadRequestMasterData(){
 if(requestMasterData)return requestMasterData;
 const headers={Accept:'application/json'};
 const [g,inv,stock,lic]=await Promise.all([
  fetch('/api/settings/product-hierarchy',{headers}),
  fetch('/api/settings/product-catalog?scope=inventory',{headers}),
  fetch('/api/settings/product-catalog?scope=stock',{headers}),
  fetch('/api/settings/license-catalog',{headers})
 ]);
 if(!g.ok||!inv.ok||!stock.ok||!lic.ok)throw Error('Ana veriler alınamadı');
 const [gd,id,sd,ld]=await Promise.all([g.json(),inv.json(),stock.json(),lic.json()]);
 // Personel listesi form açılışını bloklamasın; ihtiyaç olduğunda arka planda yüklenir.
 const personnel=[];
 requestMasterData={
  inventoryTypes:id.hardware_types||[],
  inventoryBrands:id.brands||[],
  inventoryModels:id.models||[],
  stockTypes:sd.hardware_types||[],
  stockBrands:sd.brands||[],
  stockModels:sd.models||[],
  brands:id.brands||[],
  models:id.models||[],
  factories:gd.factories||[],
  departments:gd.departments||[],
  personnel,
  licenseNames:ld.names||ld.license_names||[],
  licenseModels:ld.models||[],
  licenses:ld.names||ld.license_names||[]
 };
 window.IT_MASTER_DATA=requestMasterData; window.IT_REQUEST_MASTER_DATA=requestMasterData;
 return requestMasterData;
}
function itemRow(item={}){
 const d=window.IT_REQUEST_MASTER_DATA||window.IT_MASTER_DATA||{};
 const escName=a=>(a||[]).map(x=>typeof x==='string'?x:x.name).filter(Boolean);
 const typeOptions=escName(d.inventoryTypes||[]).map(x=>'<option value="'+esc(x)+'" '+(x===item.device_type?'selected':'')+'>'+esc(x)+'</option>').join('');
 const invBrandOptions=escName(d.inventoryBrands||d.brands||[]).map(x=>'<option value="'+esc(x)+'" '+(x===item.brand?'selected':'')+'>'+esc(x)+'</option>').join('');
 const stockBrandOptions=escName(d.stockBrands||[]).map(x=>'<option value="'+esc(x)+'" '+(x===item.brand?'selected':'')+'>'+esc(x)+'</option>').join('');
 const licenseNameOptions=(d.licenseNames||[]).map(x=>'<option value="'+esc(x.name)+'" '+(x.name===item.brand?'selected':'')+'>'+esc(x.name)+'</option>').join('');
 const licenseModelOptions=(d.licenseModels||[]).map(x=>'<option value="'+esc(x.id)+'" '+(String(x.id)===String(item.license_model_id)||x.name===item.model?'selected':'')+'>'+esc(x.name)+'</option>').join('');
 return '<div class="request-api-row row g-2 align-items-end mb-3 p-2 border rounded">'+
 '<div class="col-md-2"><label class="form-label">Ürün Tipi</label><select class="form-select req-product" required><option value="">Seçiniz</option><option value="Envanter" '+(item.product_type==='Envanter'?'selected':'')+'>Envanter</option><option value="Lisans" '+(item.product_type==='Lisans'?'selected':'')+'>Lisans</option><option value="Stok" '+(item.product_type==='Stok'?'selected':'')+'>Stok</option></select></div>'+
 '<div class="col-md-2 req-device-wrap"><label class="form-label req-device-label">Donanım Tipi</label><select class="form-select req-device"><option value="">Seçiniz</option>'+typeOptions+'</select></div>'+ 
 '<div class="col-md-2 req-brand-wrap"><label class="form-label req-brand-label">Marka</label><select class="form-select req-brand"><option value="">Seçiniz</option>'+invBrandOptions+'</select></div>'+ 
 '<div class="col-md-2 req-model-wrap"><label class="form-label req-model-label">Model</label><select class="form-select req-model"><option value="">Seçiniz</option></select></div>'+ 
 '<div class="col-md-1"><label class="form-label">Miktar</label><input class="form-control req-qty" type="number" min="1" step="1" value="'+Number(item.quantity||1)+'" required></div>'+ 
 '<div class="col-md-2"><label class="form-label">Açıklama</label><input class="form-control req-desc" value="'+esc(item.description||'')+'"></div>'+ 
 '<div class="col-md-1"><button type="button" class="btn btn-outline-danger w-100 req-remove"><i class="ti ti-trash"></i></button></div>'+ 
 '</div>';
}
function ensureRows(form){const box=form.querySelector('#requestRows');if(box&&!box.children.length)box.insertAdjacentHTML('beforeend',itemRow())}
function payload(form){
 const rows=[...form.querySelectorAll('.request-api-row,.request-extra-row')];
 const items=rows.map(r=>({product_type:r.querySelector('.req-product')?.value||r.querySelector('.request-row-product')?.value||'Stok',device_type:r.querySelector('.req-device')?.value||r.querySelector('.request-row-device')?.value||null,brand:r.querySelector('.req-brand')?.value||r.querySelector('.request-row-brand')?.value||null,model:r.querySelector('.req-model')?.value||r.querySelector('.request-row-model')?.value||null,quantity:Number(r.querySelector('.req-qty')?.value||r.querySelector('input[type=number]')?.value||1),unit:r.querySelector('.req-unit')?.value||'Adet',description:r.querySelector('.req-desc')?.value||r.querySelector('input:not([type=number])')?.value||null})).filter(x=>x.product_type);
 return {request_no:form.querySelector('[name="order_no"],[name="request_no"]')?.value?.trim(),requester_id:form.querySelector('[name="requester_id"]')?.value||null,department_id:form.querySelector('[name="department_id"]')?.value||null,factory_id:form.querySelector('[name="factory_id"]')?.value||null,priority:form.querySelector('[name="priority"]')?.value||'normal',note:form.querySelector('[name="note"]')?.value||null,items};
}
async function save(form){
 if(!form.reportValidity())return null;const data=payload(form);if(!data.items.length)throw Error('En az bir talep kalemi ekleyin');
 const r=await fetch('/api/requests',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(data)});const x=await r.json();if(!r.ok)throw Error(x.error||'Talep kaydedilemedi');return x;
}
function notify(msg){if(typeof window.showToast==='function')return window.showToast(msg);if(typeof window.itToast==='function')return window.itToast(msg);console.error(msg)}
async function action(id,endpoint){const r=await fetch(`/api/requests/${id}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const x=await r.json();if(!r.ok)throw Error(x.error||'İşlem başarısız');return x}
async function transfer(id){
 try{
  const first=await fetch(`/api/requests/${id}/transfer`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  const firstData=await first.json();
  if(first.ok){notify('Talep ilgili modüle aktarıldı.');load();return}
  if(!firstData.requires_input)throw Error(firstData.error||'Aktarım başarısız');
   let x=current.find(q=>q.id===id);
   if(!x){
    const rr=await fetch(`/api/requests/${id}`,{headers:{Accept:'application/json'}});
    const dd=await rr.json();
    if(!rr.ok)throw Error(dd.error||'Talep bulunamadı');
    x=dd;
    current.push(x);
   }
   const options=await (await fetch('/api/requests/transfer-options',{headers:{Accept:'application/json'}})).json();
   if(!options||options.error)throw Error(options?.error||'Aktarım seçenekleri alınamadı');
   openTransferForm(x,options);
 }catch(e){notify(e.message)}
}
const optionList=(arr,selected='')=>'<option value="">Seçiniz</option>'+(arr||[]).map(v=>'<option value="'+esc(v.id)+'"'+(String(v.id)===String(selected)?' selected':'')+'>'+esc(v.name)+'</option>').join('');
function openTransferForm(x,d){
 const rows=x.items.map((item,i)=>{
  const p=item.product_type;
  const catalog=p==='Envanter'
   ? {types:d.inventory_hardware_types||[],brands:d.inventory_brands||[],models:d.inventory_models||[]}
   : {types:d.stock_hardware_types||[],brands:d.stock_brands||[],models:d.stock_models||[]};
  if(p==='Envanter') return '<div class="border rounded p-3 mb-3 transfer-item" data-item-id="'+item.id+'"><h6 class="mb-3">Kalem '+(i+1)+' — Envanter</h6><div class="row g-2"><div class="col-md-4"><label class="form-label">Envanter No *</label><input class="form-control tr-inventory_no" required></div><div class="col-md-4"><label class="form-label">Fabrika *</label><select class="form-select tr-factory" required>'+optionList(d.factories,x.factory?.id)+'</select></div><div class="col-md-4"><label class="form-label">Departman *</label><select class="form-select tr-department" required>'+optionList(d.departments,x.department?.id)+'</select></div><div class="col-md-4"><label class="form-label">Donanım Tipi *</label><select class="form-select tr-device" required>'+optionList(catalog.types,catalog.types.find(v=>v.name===item.device_type)?.id)+'</select></div><div class="col-md-4"><label class="form-label">Marka *</label><select class="form-select tr-brand" required>'+optionList(catalog.brands,catalog.brands.find(v=>v.name===item.brand)?.id)+'</select></div><div class="col-md-4"><label class="form-label">Model</label><select class="form-select tr-model"><option value="">Seçiniz</option></select></div><div class="col-md-4"><label class="form-label">Sorumlu Personel</label><select class="form-select tr-person">'+optionList(d.personnel,x.requester?.id)+'</select></div><div class="col-md-4"><label class="form-label">Bilgisayar Adı</label><input class="form-control tr-computer_name"></div><div class="col-md-4"><label class="form-label">Seri No</label><input class="form-control tr-serial_no"></div><div class="col-md-4"><label class="form-label">IFS No</label><input class="form-control tr-ifs_no"></div><div class="col-md-4"><label class="form-label">Bağlı Makina No</label><input class="form-control tr-machine_no"></div><div class="col-12"><label class="form-label">Not</label><textarea class="form-control tr-note" rows="2">'+esc(item.description||'')+'</textarea></div></div></div>';
  if(p==='Lisans') return '<div class="border rounded p-3 mb-3 transfer-item" data-item-id="'+item.id+'"><h6 class="mb-3">Kalem '+(i+1)+' — Lisans</h6><div class="row g-2"><div class="col-md-6"><label class="form-label">Lisans Adı *</label><select class="form-select tr-license_name" required>'+optionList(d.license_names)+'</select></div><div class="col-md-6"><label class="form-label">Lisans Modeli *</label><select class="form-select tr-license_model" required><option value="">Önce lisans adı seçin</option></select></div><div class="col-md-6"><label class="form-label">Lisans Anahtarı</label><input class="form-control tr-license_key"></div><div class="col-md-6"><label class="form-label">E-posta</label><input class="form-control tr-email" type="email"></div><div class="col-md-6"><label class="form-label">Sorumlu Personel</label><select class="form-select tr-person"><option value="">Seçiniz</option>'+(d.personnel||[]).map(v=>'<option value="'+esc(v.id)+'"'+(String(v.id)===String(x.requester?.id)?' selected':'')+'>'+esc(v.name)+'</option>').join('')+'</select></div><div class="col-md-6"><label class="form-label">Şifre</label><input class="form-control tr-password"></div><div class="col-md-3"><label class="form-label">Başlangıç</label><input class="form-control tr-starts_at" type="date"></div><div class="col-md-3"><label class="form-label">Bitiş</label><input class="form-control tr-expires_at" type="date"></div><div class="col-12"><label class="form-label">Not</label><textarea class="form-control tr-note" rows="2">'+esc(item.description||'')+'</textarea></div></div></div>';
  return '<div class="border rounded p-3 mb-3 transfer-item" data-item-id="'+item.id+'"><h6 class="mb-3">Kalem '+(i+1)+' — Stok</h6><div class="row g-2"><div class="col-md-4"><label class="form-label">Donanım Tipi *</label><select class="form-select tr-device" required>'+optionList(catalog.types,catalog.types.find(v=>v.name===item.device_type)?.id)+'</select></div><div class="col-md-4"><label class="form-label">Marka *</label><select class="form-select tr-brand" required>'+optionList(catalog.brands,catalog.brands.find(v=>v.name===item.brand)?.id)+'</select></div><div class="col-md-4"><label class="form-label">Model</label><select class="form-select tr-model"><option value="">Seçiniz</option></select></div><div class="col-md-4"><label class="form-label">Miktar *</label><input class="form-control tr-quantity" type="number" min="0.01" step="0.01" value="'+Number(item.quantity||1)+'" required></div><div class="col-md-4"><label class="form-label">Birim</label><select class="form-select tr-unit"><option>Adet</option><option>Kutu</option><option>Paket</option><option>Metre</option></select></div><div class="col-12"><label class="form-label">Not</label><textarea class="form-control tr-note" rows="2">'+esc(item.description||'')+'</textarea></div></div></div>';
 }).join('');
 const body='<form id="requestTransferForm"><div class="alert alert-info">Satın alma tamamlandıktan sonra ilgili modüle kayıt oluşturulacak. Zorunlu alanları doldurun; diğer bilgiler varsa tamamlayabilirsiniz.</div>'+rows+'</form>';
 if(window.ITUI)ITUI.modal('Satın Alma Talebini Modüle Aktar',body,{size:'modal-xl',footer:'<button class="btn btn-light" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary" data-transfer-save>Aktar</button>'});
 const form=document.querySelector('#itManagerModal #requestTransferForm'); if(!form)return;
 const refreshModels=row=>{const p=row.querySelector('.tr-license_name')?'Lisans':row.querySelector('.tr-inventory_no')?'Envanter':'Stok';if(p==='Lisans')return;const catalog=p==='Envanter'?{types:d.inventory_hardware_types||[],brands:d.inventory_brands||[],models:d.inventory_models||[]}:{types:d.stock_hardware_types||[],brands:d.stock_brands||[],models:d.stock_models||[]};const brand=row.querySelector('.tr-brand')?.value,type=row.querySelector('.tr-device')?.value,model=row.querySelector('.tr-model');if(!model)return;const b=catalog.brands.find(v=>String(v.id)===String(brand)),t=catalog.types.find(v=>String(v.id)===String(type));const ms=catalog.models.filter(v=>String(v.brand_id)===String(b?.id)&&(!t||!v.product_type_id||String(v.product_type_id)===String(t.id)));const selected=model.value;model.innerHTML='<option value="">Seçiniz</option>'+ms.map(v=>'<option value="'+esc(v.id)+'">'+esc(v.name)+'</option>').join('');if(ms.some(v=>String(v.id)===String(selected)))model.value=selected;};
 form.querySelectorAll('.transfer-item').forEach(row=>{row.querySelector('.tr-brand')?.addEventListener('change',()=>refreshModels(row));row.querySelector('.tr-device')?.addEventListener('change',()=>refreshModels(row));row.querySelector('.tr-license_name')?.addEventListener('change',e=>{const m=row.querySelector('.tr-license_model');m.innerHTML='<option value="">Seçiniz</option>'+(d.license_models||[]).filter(v=>String(v.license_name_id)===String(e.target.value)).map(v=>'<option value="'+esc(v.id)+'">'+esc(v.name)+'</option>').join('');});refreshModels(row)});
 document.querySelector('#itManagerModal [data-transfer-save]')?.addEventListener('click',async()=>{if(!form.reportValidity())return;const items=[...form.querySelectorAll('.transfer-item')].map(row=>{const itemId=Number(row.dataset.itemId),out={item_id:itemId};const val=s=>row.querySelector('.'+s)?.value||null;if(row.querySelector('.tr-inventory_no'))Object.assign(out,{inventory_no:val('tr-inventory_no'),factory:val('tr-factory'),department:val('tr-department'),device_type:val('tr-device'),brand:val('tr-brand'),model:val('tr-model'),person:val('tr-person'),computer_name:val('tr-computer_name'),serial_no:val('tr-serial_no'),ifs_no:val('tr-ifs_no'),machine_no:val('tr-machine_no'),note:val('tr-note')});else if(row.querySelector('.tr-license_name'))Object.assign(out,{license_name:val('tr-license_name'),license_model_id:val('tr-license_model'),license_key:val('tr-license_key'),email:val('tr-email'),password:val('tr-password'),person:val('tr-person'),starts_at:val('tr-starts_at'),expires_at:val('tr-expires_at'),note:val('tr-note')});else Object.assign(out,{device_type:val('tr-device'),brand:val('tr-brand'),model:val('tr-model'),quantity:val('tr-quantity'),unit:val('tr-unit'),note:val('tr-note')});return out});try{const rr=await fetch('/api/requests/'+id+'/transfer',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({items})}),xx=await rr.json();if(!rr.ok)throw Error(xx.error||'Aktarım başarısız');bootstrap.Modal.getInstance(document.getElementById('itManagerModal'))?.hide();notify('Talep ilgili modüle aktarıldı.');load()}catch(e){notify(e.message)}});
}
function operationMenu(id){
 const x=current.find(q=>q.id===id);if(!x)return;
 const choices={pending:[['approve','Onayla'],['reject','Reddet'],['cancel','İptal']],approved:[['order','Sipariş Verildi'],['cancel','İptal']],ordered:[['complete','Tamamlandı']],completed:[['transfer','Modüle Aktar']],draft:[['approve','Onayla'],['cancel','İptal']],rejected:[['approve','Tekrar Onaya Al']],cancelled:[['approve','Tekrar Aç']]};
 const opts=choices[x.status]||[];if(!opts.length){notify('Bu talep için yapılacak işlem yok.');return}
 if(!window.ITUI){notify('İşlem penceresi açılamadı.');return}
 const buttons=opts.map(v=>'<button type="button" class="btn '+(v[0]==='reject'||v[0]==='cancel'?'btn-outline-danger':v[0]==='transfer'?'btn-primary':'btn-outline-primary')+'" data-request-op="'+esc(v[0])+'">'+esc(v[1])+'</button>').join('');
 ITUI.modal('Talep İşlemleri','<div class="d-grid gap-2">'+buttons+'</div>',{size:'modal-sm',footer:'<button class="btn btn-light" data-bs-dismiss="modal">Kapat</button>'});
 document.querySelectorAll('#itManagerModal [data-request-op]').forEach(btn=>btn.addEventListener('click',async()=>{const op=btn.dataset.requestOp;try{bootstrap.Modal.getInstance(document.getElementById('itManagerModal'))?.hide();if(op==='transfer'){await transfer(id);return}await action(id,op);notify('Talep güncellendi.');load()}catch(e){notify(e.message)}},{once:true}));
}
async function detail(id){
 let x=current.find(q=>q.id===id);if(!x){try{const rr=await fetch('/api/requests/'+id,{headers:{Accept:'application/json'}});const dd=await rr.json();if(!rr.ok)throw Error(dd.error||'Talep detayı alınamadı');x=dd}catch(e){notify(e.message);return}}
 const body='<div class="detail-grid"><div><span>Talep No</span><strong>'+esc(x.request_no)+'</strong></div><div><span>Talep Sahibi</span><strong>'+esc(x.requester?.name||'—')+'</strong></div><div><span>Departman</span><strong>'+esc(x.department?.name||'—')+'</strong></div><div><span>Fabrika</span><strong>'+esc(x.factory?.name||'—')+'</strong></div><div><span>Öncelik</span><strong>'+esc(x.priority)+'</strong></div><div><span>Durum</span><strong>'+esc(labels[x.status]||x.status)+'</strong></div></div><hr><h6>Talep Kalemleri</h6><div class="table-responsive"><table class="table"><thead><tr><th>Tip</th><th>Ürün</th><th>Marka</th><th>Model</th><th>Miktar</th><th>Açıklama</th></tr></thead><tbody>'+x.items.map(i=>'<tr><td>'+esc(i.product_type)+'</td><td>'+esc(i.device_type||'—')+'</td><td>'+esc(i.brand||'—')+'</td><td>'+esc(i.model||'—')+'</td><td>'+esc(i.quantity)+' '+esc(i.unit)+'</td><td>'+esc(i.description||'—')+'</td></tr>').join('')+'</tbody></table></div>' +(x.note?'<div class="mt-3"><strong>Not:</strong> '+esc(x.note)+'</div>':'');
 if(window.ITUI)ITUI.modal('Satın Alma Talebi Detayı',body,{footer:'<button class="btn btn-light" data-bs-dismiss="modal">Kapat</button>'});else notify(x.request_no);
}
document.addEventListener('click',async e=>{
 const add=e.target.closest('#addRequestRow');if(add){e.preventDefault();try{await loadRequestMasterData();document.querySelector('#requestRows')?.insertAdjacentHTML('beforeend',itemRow());bindRequestRow(document.querySelector('#requestRows')?.lastElementChild);}catch(err){notify(err.message)}return}
 const newBtn=e.target.closest('#requestNew');if(newBtn){e.preventDefault();openCreate();return}
 const refresh=e.target.closest('#requestRefresh');if(refresh){e.preventDefault();load(1);return} const pg=e.target.closest('.request-page');if(pg){e.preventDefault();load(Number(pg.dataset.page)||1);return}
 const rm=e.target.closest('.req-remove,.remove-request-row');if(rm){rm.closest('.request-api-row,.request-extra-row')?.remove();return}
 const det=e.target.closest('.request-detail');if(det){detail(Number(det.dataset.id));return}
 const act=e.target.closest('.request-actions');if(act){operationMenu(Number(act.dataset.id));return}
},true);
document.addEventListener('input',e=>{if(e.target.matches('#requestSearch')){clearTimeout(window.__requestSearchTimer);window.__requestSearchTimer=setTimeout(load,250)}});
function bindRequestRow(row){
 const d=window.IT_REQUEST_MASTER_DATA||window.IT_MASTER_DATA||{};
 const product=row.querySelector('.req-product'),device=row.querySelector('.req-device'),brand=row.querySelector('.req-brand'),model=row.querySelector('.req-model');
 const typeSets={Envanter:{types:d.inventoryTypes||[],brands:d.inventoryBrands||d.brands||[],models:d.inventoryModels||d.models||[]},Stok:{types:d.stockTypes||[],brands:d.stockBrands||[],models:d.stockModels||[]}};
 const names=a=>(a||[]).map(x=>typeof x==='string'?x:x.name).filter(Boolean);
 const refresh=()=>{const p=product?.value;if(!p)return;const inv=p==='Envanter'||p==='Stok';row.querySelector('.req-device-label').textContent=inv?'Donanım Tipi':'Lisans Adı';row.querySelector('.req-brand-label').textContent=inv?'Marka':'Lisans Adı';row.querySelector('.req-model-label').textContent=inv?'Model':'Lisans Modeli';if(p==='Lisans'){row.querySelector('.req-device').innerHTML='<option value="">Seçiniz</option>';row.querySelector('.req-device').value='';row.querySelector('.req-device-wrap').style.display='none';row.querySelector('.req-brand').innerHTML='<option value="">Seçiniz</option>'+(d.licenseNames||[]).map(x=>'<option value="'+esc(x.name)+'">'+esc(x.name)+'</option>').join('');row.querySelector('.req-model').innerHTML='<option value="">Seçiniz</option>';row.querySelector('.req-brand-wrap').querySelector('.req-brand-label').textContent='Lisans Adı';row.querySelector('.req-model-wrap').querySelector('.req-model-label').textContent='Lisans Modeli';row.querySelector('.req-brand').required=true;row.querySelector('.req-model').required=true;return}const s=typeSets[p];row.querySelector('.req-device-wrap').style.display='';row.querySelector('.req-brand-wrap').style.display='';row.querySelector('.req-model-wrap').style.display='';row.querySelector('.req-brand').innerHTML='<option value="">Seçiniz</option>'+names(s.brands).map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');row.querySelector('.req-device').innerHTML='<option value="">Seçiniz</option>'+names(s.types).map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');row.querySelector('.req-model').innerHTML='<option value="">Seçiniz</option>';row.querySelector('.req-brand').required=true;row.querySelector('.req-device').required=true;row.querySelector('.req-model').required=false};
 product?.addEventListener('change',refresh);device?.addEventListener('change',refresh);brand?.addEventListener('change',()=>{const p=product?.value;if(p==='Lisans'){const name=(d.licenseNames||[]).find(x=>String(x.name)===String(brand.value));const ms=(d.licenseModels||[]).filter(x=>String(x.license_name_id)===String(name?.id));model.innerHTML='<option value="">Seçiniz</option>'+ms.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');return}const s=typeSets[p];if(!s||!model)return;const b=s.brands.find(x=>(x.name||x)===brand.value),t=s.types.find(x=>(x.name||x)===device.value);const ms=(s.models||[]).filter(x=>String(x.brand_id)===String(b?.id)&&(!t||!x.product_type_id||String(x.product_type_id)===String(t.id)));model.innerHTML='<option value="">Seçiniz</option>'+ms.map(x=>'<option value="'+esc(x.name)+'">'+esc(x.name)+'</option>').join('');});refresh();
}
document.addEventListener('change',e=>{if(e.target.matches('#requestStatus,#requestPriority'))load();
 if(e.target.matches('.request-row-device,.request-row-brand')){const r=e.target.closest('.request-api-row,.request-extra-row');if(!r)return;const d=window.IT_MASTER_DATA||window.IT_MASTER?.load?.()||{};const types=d.inventoryTypes||[],brands=d.brands||[],models=d.models||[];const type=r.querySelector('.req-device,.request-row-device')?.value||'';const brand=r.querySelector('.req-brand,.request-row-brand');const model=r.querySelector('.req-model,.request-row-model');const typeObj=types.find(x=>(x.name||x)===type);const bs=brands.filter(b=>!typeObj||(b.product_type_ids||[]).map(String).includes(String(typeObj.id))||String(b.product_type_id||'')===String(typeObj.id));if(brand){const current=brand.value;brand.innerHTML='<option value="">Seçiniz</option>'+bs.map(x=>{const n=x.name||x;return '<option value="'+esc(n)+'">'+esc(n)+'</option>'}).join('');if(bs.some(x=>(x.name||x)===current))brand.value=current;}const b=bs.find(x=>(x.name||x)===brand?.value);const vals=models.filter(x=>String(x.brand_id)===String(b?.id)&&(!typeObj||(!x.product_type_id||String(x.product_type_id)===String(typeObj.id))));if(model)model.innerHTML='<option value="">Seçiniz</option>'+vals.map(x=>'<option value="'+esc(x.name)+'">'+esc(x.name)+'</option>').join('')}});
async function openCreate(){
 const form=window.IT_FORM_RENDER?.('requests')||'<form id="itDynamicForm" data-form-page="requests"></form>';
 if(window.ITUI)ITUI.modal('Yeni Satın Alma Talebi',form,{footer:'<button class="btn btn-light" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary" data-request-save>Talebi Kaydet</button>'});
 const f=document.querySelector('#itManagerModal #itDynamicForm');if(!f)return;
 const rows=f.querySelector('#requestRows');if(rows)rows.innerHTML='<div class="text-center text-secondary py-3 request-master-loading">Ürün seçenekleri yükleniyor...</div>';
 try{await loadRequestMasterData();}catch(e){notify(e.message);return}
 if(!f.isConnected)return;
 if(rows){rows.innerHTML='';rows.insertAdjacentHTML('beforeend',itemRow());bindRequestRow(rows.lastElementChild);}
 const d=window.IT_MASTER_DATA||window.IT_REQUEST_MASTER_DATA||{};
 const requester=f.querySelector('[name="requester_id"]');
 const setRequester=people=>{
   if(!requester)return;
   requester.innerHTML='<option value="">Giriş yapan kullanıcı</option>'+(people||[]).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('');
   const current=window.IT_CURRENT_USER?.personnel_id||window.IT_CURRENT_USER?.personnel?.id;
   if(current)requester.value=String(current);
 };
 setRequester(d.personnel);
 if(requester&&!d.personnel?.length){
   loadAllRequestPersonnel({Accept:'application/json'}).then(people=>{
     if(!f.isConnected)return;
     requestMasterData.personnel=people;
     window.IT_MASTER_DATA=requestMasterData;
     window.IT_REQUEST_MASTER_DATA=requestMasterData;
     setRequester(people);
   }).catch(()=>{});
 }
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-request-save]');if(!b)return;const f=document.querySelector('#itManagerModal #itDynamicForm[data-form-page="requests"]');if(!f)return;try{const saved=await save(f);if(!saved)return;notify('Satın alma talebi kaydedildi.');bootstrap.Modal.getOrCreateInstance(document.getElementById('itManagerModal')).hide();load()}catch(err){notify(err.message)}},true);
document.addEventListener('shown.bs.modal',e=>{const f=e.target.querySelector?.('#itDynamicForm[data-form-page="requests"]');if(f)ensureRows(f)});
window.addEventListener('hashchange',()=>setTimeout(load,150));document.addEventListener('DOMContentLoaded',()=>{if(location.hash==='#requests')setTimeout(load,300)});
})();
