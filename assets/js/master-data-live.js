/* Legacy live master-data binder kept for compatibility. Product forms now use form-system.js
 * as their single cascade/data source; this file must not overwrite scoped inventory/stock fields. */
(()=>{
const bind=async form=>{
 try{
  const page=form.dataset.formPage;
  if(page==='inventory'||page==='stock'||page==='licenses')return;
  const [hierarchy,personnelResponse]=await Promise.all([
   fetch('/api/settings/product-hierarchy',{headers:{Accept:'application/json'}}),
   fetch('/api/settings/personnel?per_page=100&page=1',{headers:{Accept:'application/json'}})
  ]);
  if(!hierarchy.ok||!personnelResponse.ok)return;
  const globals=await hierarchy.json();
  const firstPersonnel=await personnelResponse.json();
  const personnel=[...(firstPersonnel.items||firstPersonnel.personnel||[])];
  const pages=Number(firstPersonnel.pagination?.pages||1);
  if(pages>1){
   const responses=await Promise.all(Array.from({length:pages-1},(_,i)=>fetch('/api/settings/personnel?per_page=100&page='+(i+2),{headers:{Accept:'application/json'}})));
   for(const response of responses){if(!response.ok)continue;const data=await response.json();personnel.push(...(data.items||data.personnel||[]));}
  }
  globals.personnel=personnel;
  const fill=(sel,items,placeholder='Seçiniz')=>{if(!sel)return;const current=sel.value;sel.innerHTML=`<option value="">${placeholder}</option>`+(items||[]).map(x=>`<option value="${String(x.id??x.name).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">${String(x.name??x).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}</option>`).join('');if(current)sel.value=current;};
  fill(form.querySelector('[name="factory"]'),globals.factories);
  fill(form.querySelector('[name="department"]'),globals.departments);
  fill(form.querySelector('[name="person"]'),globals.personnel,'Atanmamış');
 }catch(e){console.warn('[master-data]',e)}
};
document.addEventListener('shown.bs.modal',e=>{const form=e.target.querySelector('#itDynamicForm');if(form)bind(form);});
})();
