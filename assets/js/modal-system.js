/* Central Modal + Drawer system for IT Manager */
(function(){
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const ensure=()=>{
    if(document.getElementById('itModalRoot')) return;
    const root=document.createElement('div'); root.id='itModalRoot';
    root.innerHTML='<div class="modal fade" id="itManagerModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="itManagerModalTitle">İşlem</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body" id="itManagerModalBody"></div><div class="modal-footer" id="itManagerModalFooter"></div></div></div></div><div class="offcanvas offcanvas-end" tabindex="-1" id="itManagerDrawer"><div class="offcanvas-header"><h5 class="offcanvas-title" id="itManagerDrawerTitle">Bildirimler</h5><button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button></div><div class="offcanvas-body" id="itManagerDrawerBody"></div></div>';
    document.body.appendChild(root);
  };
  window.ITUI={
    modal(title,body,opts={}){
      ensure(); const el=document.getElementById('itManagerModal');
      const dialog=el.querySelector('.modal-dialog'); dialog.className='modal-dialog modal-dialog-scrollable '+(opts.size||'modal-lg');
      document.getElementById('itManagerModalTitle').textContent=title;
      document.getElementById('itManagerModalBody').innerHTML=body;
      document.getElementById('itManagerModalFooter').innerHTML=opts.footer||'<button class="btn btn-light" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary" data-save>Kaydet</button>';
      return bootstrap.Modal.getOrCreateInstance(el).show();
    },
    drawer(title,body){
      ensure(); document.getElementById('itManagerDrawerTitle').textContent=title;
      document.getElementById('itManagerDrawerBody').innerHTML=body;
      return bootstrap.Offcanvas.getOrCreateInstance(document.getElementById('itManagerDrawer')).show();
    }
  };
  document.addEventListener('click',e=>{
    const bell=e.target.closest('#notificationBtn');
    if(bell){ e.preventDefault(); e.stopImmediatePropagation(); ITUI.drawer('Bildirimler','<div class="list-group list-group-flush"><div class="list-group-item px-0"><strong>🔴 Arızalı cihaz</strong><div class="small text-muted">3 cihaz işlem bekliyor</div></div><div class="list-group-item px-0"><strong>🟠 Lisans uyarısı</strong><div class="small text-muted">2 lisansın süresi yaklaşıyor</div></div><div class="list-group-item px-0"><strong>🟡 Bakım zamanı</strong><div class="small text-muted">4 cihaz için bakım planlandı</div></div></div>'); }
  },true);
})();