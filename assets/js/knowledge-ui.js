(() => {
  function renderPage() {
    if (location.hash.replace('#','') !== 'knowledge') return;
    const content = document.querySelector('#pageContent');
    if (!content) return;
    content.innerHTML = `<div class="page-head"><div><h1>Bilgi Bankası</h1><p>IT ekipleri için teknik doküman, çözüm ve prosedür merkezi.</p></div><div class="page-actions"><button class="btn btn-primary" id="knowledgeNew"><i class="ti ti-plus me-1"></i>Yeni Makale</button></div></div><div class="filter-bar"><input id="knowledgeSearch" placeholder="Başlık, içerik veya etiket ara..."><select id="knowledgeCategory"><option value="">Tüm Kategoriler</option></select><select id="knowledgeStatus"><option value="">Tüm Durumlar</option><option value="published">Yayınlandı</option><option value="draft">Taslak</option><option value="archived">Arşiv</option></select><button class="btn btn-outline-secondary" id="knowledgeFilter"><i class="ti ti-filter me-1"></i>Filtrele</button></div><div class="panel"><div class="panel-head"><div><h3>Teknik Dokümanlar</h3><p>Merkezi PostgreSQL bilgi bankası</p></div></div><div class="table-responsive"><table class="table align-middle"><thead><tr><th>BAŞLIK</th><th>KATEGORİ</th><th>YAZAR</th><th>DURUM</th><th>GÖRÜNTÜLEME</th><th class="text-end">İŞLEM</th></tr></thead><tbody id="knowledgeTableBody"><tr><td colspan="6" class="text-center text-secondary py-4">Yükleniyor...</td></tr></tbody></table></div></div><div class="modal fade" id="knowledgeModal" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h5 class="modal-title"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"></div></div></div></div><div class="modal fade" id="knowledgeNewModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Yeni Bilgi Bankası Makalesi</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><form id="knowledgeNewForm"><div class="modal-body"><div class="row g-3"><div class="col-md-8"><label class="form-label">Başlık</label><input class="form-control" name="title" required></div><div class="col-md-4"><label class="form-label">Kategori</label><input class="form-control" name="category" value="Genel"></div><div class="col-12"><label class="form-label">Özet</label><input class="form-control" name="summary"></div><div class="col-12"><label class="form-label">Etiketler</label><input class="form-control" name="tags" placeholder="vpn, ağ, yazıcı"></div><div class="col-12"><label class="form-label">İçerik</label><textarea class="form-control" name="content" rows="12" required></textarea></div></div></div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary">Kaydet</button></div></form></div></div></div>`;
    setTimeout(() => window.IT_KNOWLEDGE_API?.load(), 0);
  }
  document.addEventListener('click', e => {
    if (e.target.closest('#knowledgeNew')) {
      const m=document.querySelector('#knowledgeNewModal'); if(window.bootstrap&&m) bootstrap.Modal.getOrCreateInstance(m).show();
    }
    if (e.target.closest('#knowledgeFilter')) window.IT_KNOWLEDGE_API?.load();
  });
  document.addEventListener('submit', async e => {
    if (e.target.id !== 'knowledgeNewForm') return;
    e.preventDefault(); const f=e.target;
    try {
      await window.IT_KNOWLEDGE_API.save({title:f.title.value,category:f.category.value,summary:f.summary.value,content:f.content.value,tags:f.tags.value.split(',').map(x=>x.trim()).filter(Boolean),status:'draft'});
      bootstrap.Modal.getInstance(document.querySelector('#knowledgeNewModal'))?.hide(); f.reset(); await window.IT_KNOWLEDGE_API.load();
    } catch(err) { alert(err.message); }
  });
  window.addEventListener('hashchange', () => setTimeout(renderPage, 0));
  document.addEventListener('DOMContentLoaded', () => setTimeout(renderPage, 50));
})();
