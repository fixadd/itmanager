/* Purchase requests - PostgreSQL API integration */
(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const labels={draft:'Taslak',pending:'Bekliyor',approved:'Onaylandı',rejected:'Reddedildi',ordered:'Sipariş Verildi',completed:'Tamamlandı',cancelled:'İptal'};
const badge=s=>`<span class="status ${s==='rejected'||s==='cancelled'?'danger':s==='pending'?'warning':s==='completed'?'success':'info'}">${esc(labels[s]||s)}</span>`;
let current=[];
async function load(){
 try{
  if(page()!=='requests')return;
  const p=new URLSearchParams({per_page:'100'});
  const s=document.querySelector('#requestSearch')?.value.trim(),st=document.querySelector('#requestStatus')?.value,pr=document.querySelector('#requestPriority')?.value;
  if(s)p.set('search',s); if(st)p.set('status',st); if(pr)p.set('priority',pr);
  const r=await fetch('/api/requests?'+p.toString(),{headers:{Accept:'application/json'}});if(!r.ok)throw Error();
  const data=await r.json();current=data.items||[];window.IT_REQUESTS=current;render(current);
  ['pending','approved','ordered','completed'].forEach(k=>{const el=document.querySelector('#requestStat'+k[0].toUpperCase()+k.slice(1));if(el)el.textContent=current.filter(x=>x.status===k).length});
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
function itemRow(item={}){
 const d=window.IT_MASTER_DATA||window.IT_MASTER?.load?.()||{};const types=d.inventoryTypes||[],brands=d.brands||[],models=d.models||[];
 const names=a=>(a||[]).map(x=>typeof x==='string'?x:x.name).filter(Boolean);
 const typeNames=names(types),brandNames=names(brands);
 const brandOptions=brandNames.map(x=>'<option value="'+esc(x)+'" '+(x===item.brand?'selected':'')+'>'+esc(x)+'</option>').join('');
 const typeOptions=typeNames.map(x=>'<option value="'+esc(x)+'" '+(x===item.device_type?'selected':'')+'>'+esc(x)+'</option>').join('');
 const modelNames=models.filter(m=>m.active!==false&&(!item.brand||String(m.brand_id)===String((brands.find(b=>b.name===item.brand)||{}).id))&&(!item.device_type||String(m.product_type_id)===String((types.find(t=>t.name===item.device_type)||{}).id))).map(m=>m.name);
 const modelOptions=modelNames.map(x=>'<option value="'+esc(x)+'" '+(x===item.model?'selected':'')+'>'+esc(x)+'</option>').join('');
 return '<div class="request-api-row row g-2 align-items-end mb-3 p-2 border rounded"><div class="col-md-2"><label class="form-label">Ürün Tipi</label><select class="form-select req-product"><option value="">Seçiniz</option><option>Envanter</option><option>Lisans</option><option>Stok</option></select></div><div class="col-md-2"><label class="form-label">Donanım / Ürün</label><select class="form-select req-device"><option value="">Seçiniz</option>'+typeOptions+'</select></div><div class="col-md-1"><label class="form-label">Miktar</label><input class="form-control req-qty" type="number" min="1" value="'+Number(item.quantity||1)+'"></div><div class="col-md-2"><label class="form-label">Marka</label><select class="form-select req-brand"><option value="">Seçiniz</option>'+brandOptions+'</select></div><div class="col-md-2"><label class="form-label">Model</label><select class="form-select req-model"><option value="">Seçiniz</option>'+modelOptions+'</select></div><div class="col-md-2"><label class="form-label">Açıklama</label><input class="form-control req-desc" value="'+esc(item.description||'')+'"></div><div class="col-md-1"><button type="button" class="btn btn-outline-danger w-100 req-remove"><i class="ti ti-trash"></i></button></div></div>';
}
function ensureRows(form){const box=form.querySelector('#requestRows');if(box&&!box.children.length)box.insertAdjacentHTML('beforeend',itemRow())}
function payload(form){
 const rows=[...form.querySelectorAll('.request-api-row,.request-extra-row')];
 const items=rows.map(r=>({product_type:r.querySelector('.req-product')?.value||r.querySelector('.request-row-product')?.value||'Stok',device_type:r.querySelector('.req-device')?.value||r.querySelector('.request-row-device')?.value||null,brand:r.querySelector('.req-brand')?.value||r.querySelector('.request-row-brand')?.value||null,model:r.querySelector('.req-model')?.value||r.querySelector('.request-row-model')?.value||null,quantity:Number(r.querySelector('.req-qty')?.value||r.querySelector('input[type=number]')?.value||1),unit:r.querySelector('.req-unit')?.value||'Adet',description:r.querySelector('.req-desc')?.value||r.querySelector('input:not([type=number])')?.value||null})).filter(x=>x.product_type);
 return {request_no:form.querySelector('[name="order_no"],[name="request_no"]')?.value?.trim(),requester_id:form.querySelector('[name="requester_id"]')?.value||null,department_id:form.querySelector('[name="department_id"]')?.value||null,factory_id:form.querySelector('[name="factory_id"]')?.value||null,priority:form.querySelector('[name="priority"]')?.value||'normal',note:form.querySelector('[name="note"]')?.value||null,items};
}
async function save(form){
 const data=payload(form);if(!data.request_no)throw Error('Talep numarası zorunludur');if(!data.items.length)throw Error('En az bir talep kalemi ekleyin');
 const r=await fetch('/api/requests',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(data)});const x=await r.json();if(!r.ok)throw Error(x.error||'Talep kaydedilemedi');return x;
}
function notify(msg){if(typeof window.showToast==='function')window.showToast(msg);else alert(msg)}
async function action(id,endpoint){const r=await fetch(`/api/requests/${id}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const x=await r.json();if(!r.ok)throw Error(x.error||'İşlem başarısız');return x}
function operationMenu(id){
 const x=current.find(q=>q.id===id);if(!x)return;
 const choices={pending:[['approve','Onayla'],['reject','Reddet'],['cancel','İptal']],approved:[['order','Sipariş Verildi'],['cancel','İptal']],ordered:[['complete','Tamamlandı']],draft:[['approve','Onayla'],['cancel','İptal']],rejected:[['approve','Tekrar Onaya Al']],cancelled:[['approve','Tekrar Aç']]};
 const opts=choices[x.status]||[];if(!opts.length){notify('Bu talep için yapılacak işlem yok.');return}
 const pick=prompt(opts.map((v,i)=>`${i+1}. ${v[1]}`).join('\\n'));const n=Number(pick);if(!opts[n-1])return;
 action(id,opts[n-1][0]).then(()=>{notify('Talep güncellendi.');load()}).catch(e=>notify(e.message));
},true);
document.addEventListener('input',e=>{if(e.target.matches('#requestSearch')){clearTimeout(window.__requestSearchTimer);window.__requestSearchTimer=setTimeout(load,250)}});document.addEventListener('change',e=>{if(e.target.matches('#requestStatus,#requestPriority'))load();
if(e.target.matches('.req-brand,.request-row-brand')){const r=e.target.closest('.request-api-row,.request-extra-row');const model=r?.querySelector('.req-model,.request-row-model');const name=e.target.value;const d=window.IT_MASTER?.load?.()||{};const vals=d.models?.[name]||[];if(model)model.innerHTML='<option value="">Seçiniz</option>'+vals.map(x=>`<option>${esc(x)}</option>`).join('')}});
document.addEventListener('submit',async e=>{const form=e.target;if(form.dataset.formPage!=='requests')return;e.preventDefault();e.stopImmediatePropagation();try{await save(form);notify('Satın alma talebi kaydedildi.');document.querySelector('#itManagerModal .btn-close')?.click();load()}catch(err){notify(err.message)}},true);
function openCreate(){
 const form=window.IT_FORM_RENDER?.('requests')||'<form id="itDynamicForm" data-form-page="requests"></form>';
 if(window.ITUI)ITUI.modal('Yeni Satın Alma Talebi',form,{footer:'<button class="btn btn-light" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary" data-request-save>Talebi Kaydet</button>'});
 const f=document.querySelector('#itManagerModal #itDynamicForm');if(f){f.querySelector('#requestRows')?.insertAdjacentHTML('beforeend',itemRow());}
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-request-save]');if(!b)return;const f=document.querySelector('#itManagerModal #itDynamicForm[data-form-page="requests"]');if(!f)return;try{await save(f);notify('Satın alma talebi kaydedildi.');bootstrap.Modal.getOrCreateInstance(document.getElementById('itManagerModal')).hide();load()}catch(err){notify(err.message)}},true);
const observer=new MutationObserver(()=>{const f=document.querySelector('#itDynamicForm[data-form-page="requests"]');if(f)ensureRows(f)});observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>setTimeout(load,150));document.addEventListener('DOMContentLoaded',()=>setTimeout(load,300));
})();
