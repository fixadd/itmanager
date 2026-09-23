(() => {
  const API = '/api/knowledge';
  const state = { items: [], categories: [], pagination: { page: 1, pages: 1, total: 0, per_page: 20 } };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const statusMeta = {
    published: { label: 'Yayınlandı', badge: 'bg-success' },
    draft: { label: 'Taslak', badge: 'bg-secondary' },
    archived: { label: 'Arşiv', badge: 'bg-warning text-dark' }
  };

  async function load(page = state.pagination.page || 1) {
    if (location.hash.replace('#','') !== 'knowledge') return;
    try {
      const params = new URLSearchParams();
      const q = document.querySelector('#knowledgeSearch')?.value?.trim();
      const category = document.querySelector('#knowledgeCategory')?.value;
      const status = document.querySelector('#knowledgeStatus')?.value;
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      if (status) params.set('status', status);
      params.set('page', page);
      params.set('per_page', state.pagination.per_page || 20);
      const res = await fetch(`${API}?${params}`);
      if (!res.ok) throw new Error('Bilgi bankası alınamadı');
      const data = await res.json();
      state.items = data.items || [];
      state.pagination = data.pagination || state.pagination;
      render();
      renderPagination();
      await loadCategories();
    } catch (e) {
      console.warn(e);
      const tbody = document.querySelector('#knowledgeTableBody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Bilgi bankası yüklenemedi.</td></tr>';
    }
  }

  async function loadCategories() {
    try {
      const res = await fetch(`${API}/categories`);
      if (!res.ok) return;
      state.categories = await res.json();
      const s = document.querySelector('#knowledgeCategory');
      if (!s) return;
      const current = s.value;
      s.innerHTML = '<option value="">Tüm Kategoriler</option>' +
        state.categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      s.value = current;
    } catch (_) {}
  }

  function render() {
    const tbody = document.querySelector('#knowledgeTableBody');
    if (!tbody) return;
    tbody.innerHTML = state.items.length ? state.items.map(a => {
      const meta = statusMeta[a.status] || statusMeta.draft;
      const action = a.status === 'published'
        ? `<button class="btn btn-outline-warning" data-knowledge-archive="${a.id}">Arşivle</button>`
        : a.status === 'archived'
          ? `<button class="btn btn-outline-success" data-knowledge-restore="${a.id}">Geri Al</button>`
          : `<button class="btn btn-outline-success" data-knowledge-publish="${a.id}">Yayınla</button>`;
      return `<tr>
        <td><strong>${esc(a.title)}</strong><div class="small text-secondary">${esc(a.summary || '')}</div></td>
        <td>${esc(a.category)}</td>
        <td>${esc(a.author?.name || '-')}</td>
        <td><span class="badge ${meta.badge}">${meta.label}</span></td>
        <td>${a.view_count ?? 0}</td>
        <td class="text-end"><div class="btn-group btn-group-sm">
          <button class="btn btn-outline-light" data-knowledge-view="${a.id}">Görüntüle</button>
          <button class="btn btn-outline-secondary" data-knowledge-edit="${a.id}">Düzenle</button>
          ${action}
        </div></td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" class="text-center text-secondary py-4">Kayıt bulunamadı.</td></tr>';
  }

  function renderPagination() {
    const wrap = document.querySelector('#knowledgePagination');
    if (!wrap) return;
    const p = state.pagination;
    if (!p.total || p.pages <= 1) { wrap.innerHTML = ''; return; }
    const buttons = [];
    const start = Math.max(1, p.page - 2);
    const end = Math.min(p.pages, p.page + 2);
    buttons.push(`<button class="btn btn-sm btn-outline-secondary" data-knowledge-page="${p.page - 1}" ${p.page <= 1 ? 'disabled' : ''}>‹</button>`);
    for (let i = start; i <= end; i++) {
      buttons.push(`<button class="btn btn-sm ${i === p.page ? 'btn-primary' : 'btn-outline-secondary'}" data-knowledge-page="${i}">${i}</button>`);
    }
    buttons.push(`<button class="btn btn-sm btn-outline-secondary" data-knowledge-page="${p.page + 1}" ${p.page >= p.pages ? 'disabled' : ''}>›</button>`);
    wrap.innerHTML = `<div class="d-flex justify-content-between align-items-center mt-3"><small class="text-secondary">${p.total} makale</small><div class="btn-group">${buttons.join('')}</div></div>`;
  }

  async function get(id) {
    const r = await fetch(`${API}/${id}`);
    if (!r.ok) throw new Error('Makale alınamadı');
    return r.json();
  }

  async function save(payload, id) {
    const r = await fetch(id ? `${API}/${id}` : API, {
      method: id ? 'PATCH' : 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const x = await r.json().catch(() => ({}));
      throw new Error(x.error || 'Kayıt başarısız');
    }
    return r.json();
  }

  async function change(id, action) {
    const r = await fetch(`${API}/${id}/${action}`, {method:'POST'});
    if (!r.ok) {
      const x = await r.json().catch(() => ({}));
      throw new Error(x.error || 'Durum değiştirilemedi');
    }
    return r.json();
  }

  function openEditor(article) {
    const modal = document.querySelector('#knowledgeEditModal');
    const form = document.querySelector('#knowledgeEditForm');
    if (!modal || !form) return;
    form.dataset.id = article?.id || '';
    form.title.value = article?.title || '';
    form.category.value = article?.category || 'Genel';
    form.summary.value = article?.summary || '';
    form.tags.value = (article?.tags || []).join(', ');
    form.status.value = article?.status || 'draft';
    form.content.value = article?.content || '';
    modal.querySelector('.modal-title').textContent = article?.id ? 'Makale Düzenle' : 'Yeni Bilgi Bankası Makalesi';
    bootstrap.Modal.getOrCreateInstance(modal).show();
  }

  function show(a) {
    const modal = document.querySelector('#knowledgeModal');
    if (!modal || !window.bootstrap) { alert(`${a.title}\n\n${a.content}`); return; }
    const meta = statusMeta[a.status] || statusMeta.draft;
    modal.querySelector('.modal-title').textContent = a.title;
    modal.querySelector('.modal-body').innerHTML =
      `<div class="d-flex gap-2 flex-wrap mb-3"><span class="badge ${meta.badge}">${meta.label}</span><span class="badge bg-secondary">${esc(a.category)}</span><span class="small text-secondary align-self-center">Görüntüleme: ${a.view_count ?? 0}</span></div>
       ${a.summary ? `<div class="alert alert-secondary">${esc(a.summary)}</div>` : ''}
       <div style="white-space:pre-wrap">${esc(a.content)}</div>
       ${a.tags?.length ? `<div class="mt-4 small text-secondary">Etiketler: ${a.tags.map(esc).join(', ')}</div>` : ''}`;
    bootstrap.Modal.getOrCreateInstance(modal).show();
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-knowledge-view],[data-knowledge-edit],[data-knowledge-publish],[data-knowledge-archive],[data-knowledge-restore],[data-knowledge-page]');
    if (!b) return;
    try {
      if (b.dataset.knowledgePage) return load(Number(b.dataset.knowledgePage));
      const id = b.dataset.knowledgeView || b.dataset.knowledgeEdit || b.dataset.knowledgePublish || b.dataset.knowledgeArchive || b.dataset.knowledgeRestore;
      if (b.dataset.knowledgeView) show(await get(id));
      else if (b.dataset.knowledgeEdit) openEditor(await get(id));
      else {
        const action = b.dataset.knowledgePublish ? 'publish' : b.dataset.knowledgeArchive ? 'archive' : 'restore';
        await change(id, action);
        await load(state.pagination.page);
      }
    } catch(err) { alert(err.message); }
  });

  document.addEventListener('input', e => {
    if (e.target.id === 'knowledgeSearch') {
      clearTimeout(window.__knowledgeTimer);
      window.__knowledgeTimer = setTimeout(() => load(1), 250);
    }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'knowledgeCategory' || e.target.id === 'knowledgeStatus') load(1);
  });
  window.addEventListener('hashchange', () => load(1));
  document.addEventListener('DOMContentLoaded', () => load(1));
  window.IT_KNOWLEDGE_API = {load, get, save, openEditor};
})();