(() => {
  function renderPage() {
    if (location.hash.replace('#','') !== 'knowledge') return;
    const content = document.querySelector('#pageContent');
    if (!content) return;
    content.innerHTML = `<div class="page-head"><div><h1>Bilgi Bankası</h1><p>IT ekipleri için teknik doküman, çözüm ve prosedür merkezi.</p></div><div class="page-actions"><button class="btn btn-primary" id="knowledgeNew"><i class="ti ti-plus me-1"></i>Bilgi Ekle</button></div></div>
      <div class="filter-bar"><input id="knowledgeSearch" placeholder="Başlık, içerik veya etiket ara..."><select id="knowledgeCategory"><option value="">Tüm Kategoriler</option></select><select id="knowledgeStatus"><option value="">Tüm Durumlar</option><option value="published">Yayınlandı</option><option value="draft">Taslak</option><option value="archived">Arşiv</option></select><button class="btn btn-outline-secondary" id="knowledgeFilter"><i class="ti ti-filter me-1"></i>Filtrele</button></div>
      <div class="panel"><div class="panel-head"><div><h3>Teknik Dokümanlar</h3><p>Merkezi PostgreSQL bilgi bankası</p></div></div><div class="table-responsive"><table class="table align-middle"><thead><tr><th>BAŞLIK</th><th>KATEGORİ</th><th>YAZAR</th><th>DURUM</th><th>GÖRÜNTÜLEME</th><th class="text-end">İŞLEM</th></tr></thead><tbody id="knowledgeTableBody"><tr><td colspan="6" class="text-center text-secondary py-4">Yükleniyor...</td></tr></tbody></table></div><div id="knowledgePagination"></div></div>
      <div class="modal fade" id="knowledgeModal" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h5 class="modal-title"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"></div></div></div></div>
      <div class="modal fade" id="knowledgeEditModal" tabindex="-1"><div class="modal-dialog modal-xl modal-dialog-scrollable knowledge-editor-dialog"><div class="modal-content knowledge-editor-content"><div class="modal-header"><h5 class="modal-title">Makale Düzenle</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><form id="knowledgeEditForm" class="knowledge-editor-form"><div class="modal-body knowledge-editor-body"><div class="row g-3"><div class="col-md-8"><label class="form-label">Başlık</label><input class="form-control" name="title" required></div><div class="col-md-4"><label class="form-label">Kategori</label><input class="form-control" name="category" value="Genel"></div><div class="col-12"><label class="form-label">Özet</label><input class="form-control" name="summary"></div><div class="col-12"><label class="form-label">Etiketler</label><input class="form-control" name="tags" placeholder="vpn, ağ, yazıcı"></div><div class="col-md-4"><label class="form-label">Durum</label><select class="form-select" name="status"><option value="draft">Taslak</option><option value="published">Yayınlandı</option><option value="archived">Arşiv</option></select></div><div class="col-12"><label class="form-label">İçerik</label><textarea class="form-control" name="content" rows="18" required></textarea></div><div class="col-12" id="knowledgeEditorAttachmentSection"><hr><div class="d-flex justify-content-between align-items-center mb-2"><div><h6 class="mb-1">Ek Dosyalar</h6><div class="small text-secondary">PDF, PNG, JPG ve WEBP · Maksimum 20 MB</div></div><label class="btn btn-outline-secondary btn-sm mb-0"><i class="ti ti-upload me-1"></i>Dosya Ekle<input type="file" id="knowledgeAttachmentInput" class="d-none" accept=".pdf,.png,.jpg,.jpeg,.webp"></label></div><div id="knowledgeEditorAttachments"></div></div></div></div><div class="modal-footer knowledge-editor-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Vazgeç</button><button type="submit" class="btn btn-primary px-4">Kaydet</button></div></form></div></div></div>`;
    if (!document.getElementById('knowledgeEditorModalFix')) { const style = document.createElement('style'); style.id = 'knowledgeEditorModalFix'; style.textContent = '.knowledge-editor-dialog{max-width:min(1140px,calc(100vw - 24px));height:calc(100vh - 24px);margin:12px auto}.knowledge-editor-content{height:100%;min-height:0}.knowledge-editor-form{display:flex;flex:1;min-height:0;flex-direction:column}.knowledge-editor-body{flex:1;min-height:0;overflow-y:auto;padding-bottom:1.25rem}.knowledge-editor-body textarea[name="content"]{min-height:260px;resize:vertical}.knowledge-editor-footer{flex:0 0 auto;position:sticky;bottom:0;background:var(--bs-body-bg,#fff);border-top:1px solid var(--bs-border-color,#dee2e6);z-index:2}'; document.head.appendChild(style); }\n    const attachmentSection = document.querySelector("#knowledgeEditorAttachmentSection");
    if (attachmentSection) attachmentSection.style.display = "none";
    setTimeout(() => window.IT_KNOWLEDGE_API?.load(1), 0);
  }

  document.addEventListener('click', e => {
    if (e.target.closest('#knowledgeNew')) {
      const m = document.querySelector('#knowledgeEditModal');
      const f = document.querySelector('#knowledgeEditForm');
      if (f) { f.reset(); f.dataset.id = ''; f.category.value = 'Genel'; f.status.value = 'draft'; }
      if (m) { if (window.bootstrap) bootstrap.Modal.getOrCreateInstance(m).show(); else { m.classList.add('show'); m.style.display='block'; m.removeAttribute('aria-hidden'); } }
    }
    if (e.target.closest('#knowledgeFilter')) window.IT_KNOWLEDGE_API?.load(1);
  });

  document.addEventListener('submit', async e => {
    if (e.target.id !== 'knowledgeEditForm') return;
    e.preventDefault();
    const f = e.target;
    try {
      await window.IT_KNOWLEDGE_API.save({
        title: f.title.value.trim(),
        category: f.category.value.trim(),
        summary: f.summary.value.trim(),
        content: f.content.value.trim(),
        tags: f.tags.value.split(',').map(x => x.trim()).filter(Boolean),
        status: f.status.value
      }, f.dataset.id || null);
      (() => { const m=document.querySelector('#knowledgeEditModal'); if (!m) return; if (window.bootstrap) bootstrap.Modal.getInstance(m)?.hide(); else { m.classList.remove('show'); m.style.display='none'; m.setAttribute('aria-hidden','true'); } })();
      await window.IT_KNOWLEDGE_API.load();
    } catch(err) { window.itToast?.(err.message); }
  });

  window.IT_KNOWLEDGE_UI = { render: renderPage };
  window.addEventListener('hashchange', () => setTimeout(renderPage, 0));
  window.addEventListener('load', () => setTimeout(renderPage, 0));
  document.addEventListener('DOMContentLoaded', () => setTimeout(renderPage, 0));
})();