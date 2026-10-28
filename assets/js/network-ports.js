(()=> {
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let items=[], cabinets=[];
const fields=[
 ['cabinet_name','Kabinet',true],['row_number','Port sıra no',true,'number'],
 ['device_type','Tip'],['port_label','Etiket / cihaz no'],['patch_panel','Patch panel'],
 ['ip_address','IP adresi'],['switch_port','Switch / port'],['mounting_location','Montaj yeri'],['note','Açıklama']
];
function message(text,type='success'){const box=$('#networkNotice');if(!box)return;box.className='alert alert-'+type+' py-2';box.textContent=text;box.hidden=false;setTimeout(()=>{if(box.isConnected)box.hidden=true;},5000);}
function renderTable(){
 const target=$('#networkRows');if(!target)return;
 const search=($('#networkSearch')?.value||'').trim().toLocaleLowerCase('tr-TR');
 const cabinet=$('#networkCabinet')?.value||'';
 const visible=items.filter(x=>(!cabinet||x.cabinet_name===cabinet)&&(!search||Object.values(x).some(v=>String(v??'').toLocaleLowerCase('tr-TR').includes(search))));
 $('#networkTotal').textContent=items.length.toLocaleString('tr-TR');
 $('#networkShown').textContent=visible.length.toLocaleString('tr-TR');
 target.innerHTML=visible.map(x=>`<tr>
 <td>${esc(x.cabinet_name)}</td><td>${esc(x.row_number)}</td><td>${esc(x.device_type||'—')}</td>
 <td>${esc(x.port_label||'—')}</td><td>${esc(x.patch_panel||'—')}</td><td>${esc(x.ip_address||'—')}</td>
 <td>${esc(x.switch_port||'—')}</td><td>${esc(x.mounting_location||'—')}</td>
 <td><button class="btn btn-sm btn-outline-primary" data-edit-network="${x.id}"><i class="ti ti-edit me-1"></i>Düzenle</button></td></tr>`).join('')||'<tr><td colspan="9" class="text-center text-secondary py-4">Kayıt bulunamadı. Yeni port ekleyebilir veya ODS dosyalarını içe aktarabilirsin.</td></tr>';
 $('#networkEmptyCount').textContent=visible.filter(x=>!x.device_type&&!x.port_label&&!x.patch_panel&&!x.ip_address&&!x.switch_port&&!x.mounting_location).length.toLocaleString('tr-TR');
}
function renderCabinets(){
 const select=$('#networkCabinet');if(!select)return;
 const current=select.value;
 select.innerHTML='<option value="">Tüm kabinetler</option>'+cabinets.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
 if(cabinets.includes(current))select.value=current;
}
async function load(){
 const target=$('#networkRows');if(!target)return;
 target.innerHTML='<tr><td colspan="9" class="text-center text-secondary py-4">Yükleniyor...</td></tr>';
 try{
  const r=await fetch('/api/network-ports',{headers:{Accept:'application/json'}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Ağ portları yüklenemedi');
  items=d.items||[];cabinets=d.cabinets||[];renderCabinets();renderTable();
 }catch(e){target.innerHTML=`<tr><td colspan="9" class="text-center text-danger py-4">${esc(e.message)}</td></tr>`;}
}
function openForm(item){
 const form=$('#networkPortForm');if(!form){message('Port formu bulunamadı. Sayfayı yenileyip tekrar deneyin.','danger');return;}
 form.reset();$('#networkPortId').value=item?.id||'';
 $('#networkModalTitle').textContent=item?'Port Kaydını Düzenle':'Yeni Port Ekle';
 fields.forEach(([key,label])=>{const input=form.elements[key];if(input)input.value=item?.[key]??'';});
 const modalEl=$('#networkModal');
 if(window.bootstrap?.Modal){window.bootstrap.Modal.getOrCreateInstance(modalEl).show();}
 else {modalEl.classList.add('show');modalEl.style.display='block';modalEl.removeAttribute('aria-hidden');modalEl.setAttribute('aria-modal','true');document.body.classList.add('modal-open');}

}
async function save(event){
 event.preventDefault();
 const form=event.currentTarget,id=$('#networkPortId').value;
 const payload={};fields.forEach(([key])=>{payload[key]=form.elements[key]?.value?.trim()||null;});
 payload.row_number=Number(payload.row_number);
 try{
  const r=await fetch(id?'/api/network-ports/'+id:'/api/network-ports',{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Kayıt kaydedilemedi');
  const modalEl=$('#networkModal');
  if(window.bootstrap?.Modal){window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();}
  else {modalEl.classList.remove('show');modalEl.style.display='none';modalEl.setAttribute('aria-hidden','true');modalEl.removeAttribute('aria-modal');document.body.classList.remove('modal-open');}
  message(id?'Port kaydı güncellendi.':'Yeni port eklendi.');
  await load();
 }catch(e){message(e.message,'danger');}
}
async function importFiles(event){
 const files=Array.from(event.target.files||[]);if(!files.length)return;
 const data=new FormData();files.forEach(f=>data.append('files',f));
 const btn=$('#networkImportBtn');btn.disabled=true;btn.textContent='İçe aktarılıyor...';
 try{
  const r=await fetch('/api/network-ports/import-ods',{method:'POST',body:data,headers:{Accept:'application/json'}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'ODS içe aktarılamadı');
  message(`İçe aktarma tamamlandı. Yeni: ${d.created}, güncellenen: ${d.updated}.`);
  await load();
 }catch(e){message(e.message,'danger');}
 finally{btn.disabled=false;btn.innerHTML='<i class="ti ti-file-import me-1"></i>ODS İçe Aktar';event.target.value='';}
}
function bind(){
 const host=$('#networkScreen');
 if(host?.dataset.networkEventsBound==='1')return;
 if(host)host.dataset.networkEventsBound='1';
 $('#networkSearch')?.addEventListener('input',renderTable);
 $('#networkCabinet')?.addEventListener('change',renderTable);
 $('#networkRefresh')?.addEventListener('click',load);
 $('#networkNew')?.addEventListener('click',e=>{e.preventDefault();openForm(null);});
 $('#networkPortForm')?.addEventListener('submit',save);
 $('#networkFileInput')?.addEventListener('change',importFiles);
 $('#networkImportBtn')?.addEventListener('click',()=>$('#networkFileInput')?.click());
 $('#networkRows')?.addEventListener('click',e=>{const b=e.target.closest('button[data-edit-network]');if(!b)return;e.preventDefault();const item=items.find(x=>String(x.id)===b.dataset.editNetwork);if(item)openForm(item);else message('Düzenlenecek port kaydı bulunamadı. Listeyi yenileyin.','danger');});
}
function render(){
 const host=$('#networkScreen');if(!host)return;
 bind();load();
}
window.IT_NETWORK={render,load};
})();