(() => {
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));

  const api = async (url, options = {}) => {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  };

  let modalEl = null;

  function closeModal() {
    if (!modalEl) return;
    bootstrap.Modal.getInstance(modalEl)?.hide();
    setTimeout(() => {
      modalEl?.remove();
      modalEl = null;
    }, 200);
  }

  function showModal(title, body, submitHandler) {
    closeModal();

    modalEl = document.createElement('div');
    modalEl.className = 'modal fade';
    modalEl.id = 'inventoryActionModal';
    modalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark text-light">
          <div class="modal-header">
            <h5 class="modal-title">${esc(title)}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <form>
            <div class="modal-body">${body}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Vazgeç</button>
              <button class="btn btn-primary" type="submit">Onayla</button>
            </div>
          </form>
        </div>
      </div>`;

    document.body.appendChild(modalEl);
    const modal = new bootstrap.Modal(modalEl);

    modalEl.addEventListener('hidden.bs.modal', () => {
      modalEl?.remove();
      modalEl = null;
    }, { once: true });

    modalEl.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;

      try {
        await submitHandler(new FormData(event.currentTarget));
        modal.hide();
      } catch (error) {
        window.itToast?.(error.message || 'İşlem başarısız.');
        button.disabled = false;
      }
    });

    modal.show();
  }

  function refreshInventory(id) {
    window.itToast?.('İşlem başarıyla tamamlandı.');
    location.hash = `#inventory/${id}`;
    window.dispatchEvent(new Event('hashchange'));
  }

  async function action(id, operation) {
    if (operation === 'mark-faulty') {
      return showModal(
        'Cihazı Arızalı İşaretle',
        '<div class="mb-3"><label class="form-label">Açıklama / Not</label><textarea name="note" class="form-control" rows="3" placeholder="Arıza hakkında kısa açıklama"></textarea></div>',
        async (form) => {
          await api(`/api/inventory/${id}/mark-faulty`, {
            method: 'POST',
            body: JSON.stringify({ note: form.get('note') || '' })
          });
          refreshInventory(id);
        }
      );
    }

    if (operation === 'send-to-it') {
      return showModal(
        'Bilgi İşleme Al',
        '<div class="mb-3"><label class="form-label">Açıklama / Not</label><textarea name="note" class="form-control" rows="3" placeholder="Bilgi İşlem notu"></textarea></div>',
        async (form) => {
          await api(`/api/inventory/${id}/send-to-it`, {
            method: 'POST',
            body: JSON.stringify({ note: form.get('note') || '' })
          });
          refreshInventory(id);
        }
      );
    }

    if (operation === 'scrap') {
      return showModal(
        'Envanteri Hurdaya Ayır',
        '<div class="alert alert-warning">Bu işlem cihazın durumunu <strong>Hurda</strong> yapar ve mevcut personel atamasını kaldırır.</div><div class="mb-3"><label class="form-label">Hurda Nedeni <span class="text-danger">*</span></label><textarea name="reason" class="form-control" rows="3" required placeholder="Hurdaya ayırma nedeni"></textarea></div><div><label class="form-label">Ek Not</label><textarea name="note" class="form-control" rows="2" placeholder="İsteğe bağlı"></textarea></div>',
        async (form) => {
          const reason = String(form.get('reason') || '').trim();
          if (!reason) throw new Error('Hurda nedeni zorunludur.');

          await api(`/api/inventory/${id}/scrap`, {
            method: 'POST',
            body: JSON.stringify({
              reason,
              note: form.get('note') || ''
            })
          });
          refreshInventory(id);
        }
      );
    }

    if (operation === 'assign') {
      let data;
      try {
        data = await api('/api/settings/personnel?per_page=100&page=1');
      } catch (error) {
        return showModal(
          'Personel Ataması',
          '<div class="alert alert-danger">Personel listesi yüklenemedi. Lütfen tekrar deneyin.</div>',
          async () => {}
        );
      }

      return showModal(
        'Personel Ataması',
        `<div class="mb-3"><label class="form-label">Personel <span class="text-danger">*</span></label><select name="personnel_id" class="form-select" required><option value="">Personel seçin</option>${(data.items || data.personnel || data || []).map((person) => `<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('')}</select></div><div><label class="form-label">Not</label><textarea name="note" class="form-control" rows="3" placeholder="Atama notu"></textarea></div>`,
        async (form) => {
          const personnelId = String(form.get('personnel_id') || '');
          if (!personnelId) throw new Error('Personel seçimi zorunludur.');

          await api(`/api/inventory/${id}/assign`, {
            method: 'POST',
            body: JSON.stringify({
              personnel_id: personnelId,
              note: form.get('note') || ''
            })
          });
          refreshInventory(id);
        }
      );
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('.iv-op');
    if (!button) return;
    if (button.dataset.op === 'license') return;

    const id = location.hash.match(/^#inventory\/(\d+)$/)?.[1];
    if (!id) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    action(id, button.dataset.op);
  }, true);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-api-op]');
    if (!button) return;

    const menu = button.closest('.row-operation-menu');
    const id = menu?.dataset.inventoryId;
    if (!id) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    menu.remove();
    action(id, button.dataset.apiOp);
  }, true);
})();
