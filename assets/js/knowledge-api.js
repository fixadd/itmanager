(() => {
  const API = '/api/knowledge';
  const state = { items: [], categories: [] };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const badge = s => ({published:'bg-success',draft:'bg-secondary',archived:'bg-warning text-dark'}[s] || 'bg-secondary');

  async function load() {
    if (location.hash.replace('#','') !== 'knowledge') return;
    try {
      const params = new URLSearchParams();
      const q = document.querySelector('#knowledgeSearch')?.value?.trim();
      const category = document.querySelector('#knowledgeCategory')?.value;
      const status = document.querySelector('#knowledgeStatus')?.value;
      if (q) params.set('q', q); if (category) params.set('category', category); if (status) params.set('status', status);
      const res = await fetch(`${API}?${params}`); if (!res.ok) throw new Error('Bilgi bankası alınamadı');
      const data = await res.json(); state.items = data.items || []; render(); loadCategories();
    } catch (e) { console.warn(e); }
  }
  async function loadCategories() {
    try { const res = await fetch(`${API}/categories`); if (!res.ok) return; state.categories = await res.json();
      const s = document.querySelector('#knowledgeCategory'); if (!s) return; const current = s.value;
      s.innerHTML = '<option value="">Tüm Kategoriler</option>' + state.categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join(''); s.value = current;
    } catch (_) {}
  }
  function render() {
    const tbody = document.querySelector('#knowledgeTableBody'); if (!tbody) return;
    tbody.innerHTML = state.items.length ? state.items.map(a => `<tr><td><strong>${esc(a.title)}</strong><div class="small text-secondary">${esc(a.summary || '')}</div></td><td>${esc(a.category)}</td><td>${esc(a.author?.name || '-')}</td><td><span class="badge ${badge(a.status)}">${esc(a.status)}</span></td><td>${a.view_count ?? 0}</td><td class="text-end"><div class="btn-group btn-group-sm"><button class="btn btn-outline-light" data-knowledge-view="${a.id}">Görüntüle</button><button class="btn btn-outline-secondary" data-knowledge-edit="${a.id}">Düzenle</button>${a.status === 'published' ? `<button class="btn btn-outline-warning" data-knowledge-archive="${a.id}">Arşivle</button>` : `<button class="btn btn-outline-success" data-knowledge-publish="${a.id}">Yayınla</button>`}</div></td></tr>`).join('') : '<tr><td colspan="6" class="text-center text-secondary py-4">Kayıt bulunamadı.</td></tr>';
  }
  async function get(id) { const r = await fetch(`${API}/${id}`); if (!r.ok) throw new Error('Makale alınamadı'); return r.json(); }
  async function save(payload, id) { const r = await fetch(id ? `${API}/${id}` : API, {method:id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); if(!r.ok){const x=await r.json().catch(()=>({}));throw new Error(x.error||'Kayıt başarısız');} return r.json(); }
  async function change(id, action) { const r = await fetch(`${API}/${id}/${action}`, {method:'POST'}); if(!r.ok) throw new Error('Durum değiştirilemedi'); return r.json(); }
  async function edit(id) { const a=await get(id); const title=prompt('Başlık',a.title); if(title===null)return; const category=prompt('Kategori',a.category); if(category===null)return; const content=prompt('İçerik',a.content); if(content===null)return; await save({title,category,content,summary:a.summary||'',tags:a.tags||[]},id); await load(); }
  function show(a) { const modal=document.querySelector('#knowledgeModal'); if(!modal||!window.bootstrap){alert(`${a.title}\n\n${a.content}`);return;} modal.querySelector('.modal-title').textContent=a.title; modal.querySelector('.modal-body').innerHTML=`<div class="small text-secondary mb-3">${esc(a.category)} · ${esc(a.status)}</div><div style="white-space:pre-wrap">${esc(a.content)}</div>`; bootstrap.Modal.getOrCreateInstance(modal).show(); }
  document.addEventListener('click', async e => { const b=e.target.closest('[data-knowledge-view],[data-knowledge-edit],[data-knowledge-publish],[data-knowledge-archive]'); if(!b)return; try { const id=b.dataset.knowledgeView||b.dataset.knowledgeEdit||b.dataset.knowledgePublish||b.dataset.knowledgeArchive; if(b.dataset.knowledgeView)show(await get(id)); else if(b.dataset.knowledgeEdit)await edit(id); else {await change(id,b.dataset.knowledgePublish?'publish':'archive');await load();} } catch(err){alert(err.message);} });
  document.addEventListener('input',e=>{if(e.target.id==='knowledgeSearch'){clearTimeout(window.__knowledgeTimer);window.__knowledgeTimer=setTimeout(load,250);}});
  document.addEventListener('change',e=>{if(e.target.id==='knowledgeCategory'||e.target.id==='knowledgeStatus')load();});
  window.addEventListener('hashchange',load); document.addEventListener('DOMContentLoaded',load); window.IT_KNOWLEDGE_API={load,get,save};
})();
