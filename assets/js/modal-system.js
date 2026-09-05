/* Central Modal + Notification Dropdown system for IT Manager */
(function(){
  const ensure=()=>{
    if(document.getElementById('itModalRoot')) return;
    const root=document.createElement('div'); root.id='itModalRoot';
    root.innerHTML='<div class="modal fade" id="itManagerModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="itManagerModalTitle">İşlem</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body" id="itManagerModalBody"></div><div class="modal-footer" id="itManagerModalFooter"></div></div></div></div>';
    document.body.appendChild(root);
  };
  window.ITUI={
    modal(title,body,opts={}){
      ensure(); const el=document.getElementById('itManagerModal');
      el.querySelector('.modal-dialog').className='modal-dialog modal-dialog-scrollable '+(opts.size||'modal-lg');
      document.getElementById('itManagerModalTitle').textContent=title;
      document.getElementById('itManagerModalBody').innerHTML=body;
      document.getElementById('itManagerModalFooter').innerHTML=opts.footer||'<button class="btn btn-light" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary" data-save>Kaydet</button>';
      bootstrap.Modal.getOrCreateInstance(el).show();
    }
  };
  const close=()=>document.getElementById('itNotificationDropdown')?.remove();
  const showNotifications=bell=>{
    close();
    const r=bell.getBoundingClientRect(), panel=document.createElement('div');
    panel.id='itNotificationDropdown';
    panel.innerHTML='<div class="it-notification-head"><strong>Bildirimler</strong><button type="button" class="it-notification-close">×</button></div><div class="it-notification-list"><button class="it-notification-item"><span class="it-notification-icon danger">!</span><span><strong>3 cihaz arızalı</strong><small>Bakım / Tamir bekliyor</small></span></button><button class="it-notification-item"><span class="it-notification-icon warning">!</span><span><strong>2 lisansın süresi yaklaşıyor</strong><small>Lisans Takip</small></span></button><button class="it-notification-item"><span class="it-notification-icon warning">!</span><span><strong>4 cihazın bakımı geldi</strong><small>Periyodik bakım</small></span></button><button class="it-notification-item"><span class="it-notification-icon info">i</span><span><strong>5 yeni satın alma talebi</strong><small>Satın Alma Talepleri</small></span></button></div><div class="it-notification-footer">Tüm bildirimleri gör</div>';
    const style=document.createElement('style'); style.id='itNotificationStyle';
    style.textContent='#itNotificationDropdown{position:fixed;z-index:100000;width:370px;max-width:calc(100vw - 24px);background:var(--panel,#fff);border:1px solid var(--border,#e2e8f0);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.22);overflow:hidden;color:var(--text,#1e293b)}.it-notification-head{height:52px;padding:0 15px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border,#e2e8f0)}.it-notification-close{border:0;background:transparent;font-size:22px;cursor:pointer;color:inherit}.it-notification-item{width:100%;border:0;background:transparent;text-align:left;display:flex;gap:11px;padding:13px 15px;cursor:pointer;color:inherit}.it-notification-item:hover{background:rgba(100,116,139,.08)}.it-notification-item small{display:block;margin-top:3px;opacity:.65}.it-notification-icon{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-weight:800;flex:0 0 30px}.it-notification-icon.danger{background:#fee2e2;color:#dc2626}.it-notification-icon.warning{background:#fef3c7;color:#d97706}.it-notification-icon.info{background:#dbeafe;color:#2563eb}.it-notification-footer{text-align:center;padding:11px;border-top:1px solid var(--border,#e2e8f0);font-size:13px;font-weight:700;color:#2563eb}';
    document.head.appendChild(style);
    document.body.appendChild(panel);
    const width=370, left=Math.min(Math.max(12,r.right-width),window.innerWidth-width-12); panel.style.left=left+'px'; panel.style.top=(r.bottom+8)+'px';
  };
  document.addEventListener('click',e=>{
    const bell=e.target.closest('#notificationBtn');
    if(bell){e.preventDefault();e.stopImmediatePropagation();showNotifications(bell);return;}
    if(e.target.closest('.it-notification-close')){e.preventDefault();e.stopImmediatePropagation();close();return;}
    if(!e.target.closest('#itNotificationDropdown')) close();
  },true);
  window.addEventListener('resize',close);
  window.addEventListener('scroll',close,true);
})();