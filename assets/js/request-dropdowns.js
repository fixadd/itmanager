/* Purchase request dependent Brand / Model dropdowns */
(() => {
  const data = {
    Envanter: {
      brands: ['Dell','HP','Lenovo','Asus','Acer','Canon','Kyocera','Xerox','Hikvision','Aruba','Samsung','Zebra','Diğer'],
      models: {
        Dell: ['Latitude 5440','OptiPlex 7010','P2422H','PowerEdge R550','Diğer'],
        HP: ['ProBook 450 G10','EliteBook 840 G10','ProDesk 600 G6','E24 G5','Diğer'],
        Lenovo: ['ThinkPad E14','ThinkPad T14','ThinkCentre M70q','L24e','Diğer'],
        Asus: ['ExpertBook B1','ExpertCenter D5','VA24E','Diğer'],
        Acer: ['TravelMate P2','Veriton','Vero B7','Diğer'],
        Canon: ['LBP631C','i-SENSYS MF455dw','Diğer'],
        Kyocera: ['M5526cdw','M2635dn','Diğer'],
        Xerox: ['Phaser 3020','VersaLink C405','Diğer'],
        Hikvision: ['DS-2CD2043G2','DS-7608NI','Diğer'],
        Aruba: ['6000 24G','2530-48G','AP-505','Diğer'],
        Samsung: ['M2020','ViewFinity S6','Diğer'],
        Zebra: ['ZD421','ZT230','Diğer'],
        Diğer: ['Model giriniz']
      }
    },
    Lisans: {
      brands: ['Microsoft','Adobe','Autodesk','ESET','Fortinet','Diğer'],
      models: {
        Microsoft: ['Windows 11 Pro','Windows Server','Office 2021','Microsoft 365','VPN','Diğer'],
        Adobe: ['Adobe Acrobat Pro','Adobe Creative Cloud','Diğer'],
        Autodesk: ['AutoCAD','Revit','Diğer'],
        ESET: ['Endpoint Antivirus','Protect Advanced','Diğer'],
        Fortinet: ['FortiClient VPN','Diğer'],
        Diğer: ['Model / Lisans adı']
      }
    },
    Stok: {
      brands: ['Logitech','Microsoft','Ugreen','Baseus','HP','Dell','Canon','Kyocera','Xerox','Samsung','Zebra','Diğer'],
      models: {
        Logitech: ['M185','M190','K120','K270','Diğer'],
        Microsoft: ['Basic Mouse','Basic Keyboard','Diğer'],
        Ugreen: ['HDMI 2.0','USB Adapter','Network Adapter','Diğer'],
        Baseus: ['HDMI Cable','USB Adapter','Diğer'],
        HP: ['Mouse','Keyboard','USB-C Adapter','Diğer'],
        Dell: ['MS116','KB216','USB-C Adapter','Diğer'],
        Canon: ['Toner','Drum','Diğer'],
        Kyocera: ['TK-5240','TK-1150','Diğer'],
        Xerox: ['106R02773','Diğer'],
        Samsung: ['M2020 Toner','Diğer'],
        Zebra: ['Ribbon','Label','Diğer'],
        Diğer: ['Model giriniz']
      }
    }
  };

  const esc = v => String(v ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[m]));

  function selectMarkup(name, placeholder, options, cls) {
    return `<select class="form-select ${cls}" name="${name}"><option value="">${placeholder}</option>${options.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select>`;
  }

  function convertRow(row) {
    if (!row || !row.closest('#requestRows')) return;
    const product = row.querySelector('.request-row-product')?.value;
    if (!product || !data[product]) return;

    const brandInput = row.querySelector('input[name="brand[]"]');
    if (brandInput && !row.querySelector('.request-row-brand')) {
      brandInput.outerHTML = selectMarkup('brand[]', 'Marka seçiniz', data[product].brands, 'request-row-brand');
    }

    const modelInput = row.querySelector('input[name="model[]"]');
    if (modelInput && !row.querySelector('.request-row-model')) {
      modelInput.outerHTML = selectMarkup('model[]', 'Önce marka seçiniz', [], 'request-row-model');
    }

    const brand = row.querySelector('.request-row-brand')?.value;
    const model = row.querySelector('.request-row-model');
    if (model && brand) {
      const options = data[product].models[brand] || ['Model giriniz'];
      model.innerHTML = `<option value="">Model seçiniz</option>${options.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}`;
    }
  }

  function convertAll() {
    document.querySelectorAll('.request-extra-row').forEach(convertRow);
  }

  document.addEventListener('change', e => {
    const product = e.target.closest('.request-row-product');
    if (product) {
      const row = product.closest('.request-extra-row');
      convertRow(row);
      const brand = row?.querySelector('.request-row-brand');
      if (brand) brand.value = '';
      const model = row?.querySelector('.request-row-model');
      if (model) model.innerHTML = '<option value="">Önce marka seçiniz</option>';
      return;
    }

    const brand = e.target.closest('.request-row-brand');
    if (brand) {
      const row = brand.closest('.request-extra-row');
      const product = row?.querySelector('.request-row-product')?.value;
      const model = row?.querySelector('.request-row-model');
      if (model && data[product]) {
        const options = data[product].models[brand.value] || ['Model giriniz'];
        model.innerHTML = `<option value="">Model seçiniz</option>${options.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}`;
      }
    }
  }, true);

  const observer = new MutationObserver(convertAll);
  observer.observe(document.body, {childList:true, subtree:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', convertAll); else convertAll();
})();
