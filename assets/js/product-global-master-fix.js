(()=>{
const req=(p,o={})=>window.IT_AUTH.request(p,o);
const wire=()=>{
 const bind=(id,resource,label)=>{
  const form=document.getElementById(id);
  if(!form||form.dataset.globalFix==='1')return;
  form.dataset.globalFix='1';
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   e.stopImmediatePropagation();
   const input=form.querySelector('[name="name"]');
   const name=input?.value.trim();
   if(!name)return;
   const btn=form.querySelector('button');
   if(btn)btn.disabled=true;
   try{
    await req(`/settings/${resource}`,{method:'POST',body:JSON.stringify({name})});
    input.value='';
    window.itToast?.(`${label} eklendi`)||alert(`${label} eklendi`);
    document.dispatchEvent(new CustomEvent('itmanager:global-master-updated',{detail:{resource,name}}));
   }catch(err){
    alert(err.message);
   }finally{
    if(btn)btn.disabled=false;
   }
  },true);
 };
 bind('phFactoryForm','factories','Fabrika');
 bind('phDepartmentForm','departments','Departman');
};
document.addEventListener('DOMContentLoaded',wire);
new MutationObserver(wire).observe(document.body,{childList:true,subtree:true});
})();
