(function () {
  'use strict';

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  var token = localStorage.getItem('adminToken');
  if (!token) { window.location.href = '/admin/login.html'; return; }

  function api(method, url, body) {
    var opts = {
      method: method,
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; }
      return r.json();
    });
  }

  // ─── NAV ───────────────────────────────────────────────────────────────────
  var currentSection = 'dashboard';

  document.querySelectorAll('.sidebar-link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var sec = this.getAttribute('data-section');
      switchSection(sec);
      // Mobile: close sidebar
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  function switchSection(sec) {
    currentSection = sec;
    document.querySelectorAll('.sidebar-link').forEach(function (l) {
      l.classList.toggle('active', l.getAttribute('data-section') === sec);
    });
    document.querySelectorAll('.adm-section').forEach(function (s) {
      s.classList.toggle('active', s.id === 'sec-' + sec);
    });
    if (sec === 'dashboard') loadDashboard();
    if (sec === 'portfolio') loadPortfolio();
    if (sec === 'requests')  loadRequests('all');
    if (sec === 'photos')    loadSitePhotos();
    if (sec === 'settings')  loadSettings();
  }

  // Burger (mobile)
  document.getElementById('admBurger').addEventListener('click', function () {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', function () {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login.html';
  });

  // ─── DASHBOARD ─────────────────────────────────────────────────────────────
  function loadDashboard() {
    Promise.all([
      api('GET', '/api/admin/requests'),
      api('GET', '/api/admin/portfolio')
    ]).then(function (results) {
      var reqs  = results[0].requests || [];
      var works = results[1].items || [];
      var newCount = reqs.filter(function (r) { return r.status === 'new'; }).length;

      document.getElementById('dcNew').textContent   = newCount;
      document.getElementById('dcTotal').textContent = reqs.length;
      document.getElementById('dcWorks').textContent = works.length;

      // Бейдж нових заявок у sidebar
      var badge = document.getElementById('newBadge');
      if (newCount > 0) { badge.textContent = newCount; badge.style.display = ''; }
      else { badge.style.display = 'none'; }

      // Таблиця — останні 10
      var tbody = document.getElementById('dashTableBody');
      tbody.innerHTML = '';
      reqs.slice(0, 10).forEach(function (r) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + fmtDate(r.createdAt) + '</td>' +
          '<td>' + esc(r.name) + '</td>' +
          '<td>' + esc(r.phone) + '</td>' +
          '<td>' + esc(r.size) + '</td>' +
          '<td>' + badge_(r.status) + '</td>';
        tbody.appendChild(tr);
      });
      if (reqs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:rgba(248,245,240,0.25);padding:32px">Заявок немає</td></tr>';
      }
    });
  }

  // ─── PORTFOLIO ─────────────────────────────────────────────────────────────
  var portfolioItems = [];
  var editingWorkId = null;
  var workMaterials = [];
  var uploadedUrls = [];

  function loadPortfolio() {
    api('GET', '/api/admin/portfolio').then(function (data) {
      portfolioItems = data.items || [];
      renderPortfolioTable();
    });
  }

  function renderPortfolioTable() {
    var tbody = document.getElementById('portfolioTableBody');
    tbody.innerHTML = '';
    portfolioItems.forEach(function (item) {
      var tr = document.createElement('tr');
      var thumbHtml = item.images && item.images.length
        ? '<img class="tbl-thumb" src="' + esc(item.images[0]) + '" alt="">'
        : '<div class="tbl-thumb-placeholder">—</div>';
      var catLabel = { wedding: 'Весільний', evening: 'Вечірній', casual: 'Casual' }[item.category] || item.category;
      var price = item.pricing && item.pricing.basePrice ? item.pricing.basePrice.toLocaleString('uk-UA') + ' грн' : '—';
      tr.innerHTML =
        '<td>' + thumbHtml + '</td>' +
        '<td style="color:var(--text)">' + esc(item.title) + '</td>' +
        '<td>' + esc(catLabel) + '</td>' +
        '<td>' + esc(price) + '</td>' +
        '<td>' +
          '<label class="toggle" title="Видимість">' +
            '<input type="checkbox" class="toggle-vis" data-id="' + item.id + '"' + (item.isVisible ? ' checked' : '') + '>' +
            '<span class="toggle-slider"></span>' +
          '</label>' +
        '</td>' +
        '<td style="white-space:nowrap">' +
          '<button class="adm-btn-icon btn-edit-work" data-id="' + item.id + '" title="Редагувати">✏️</button> ' +
          '<button class="adm-btn-icon danger btn-del-work" data-id="' + item.id + '" title="Видалити">🗑</button>' +
        '</td>';
      tbody.appendChild(tr);
    });
    if (portfolioItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:rgba(248,245,240,0.25);padding:32px">Робіт немає. Додайте першу!</td></tr>';
    }

    // Toggle visibility
    tbody.querySelectorAll('.toggle-vis').forEach(function (cb) {
      cb.addEventListener('change', function () {
        api('PUT', '/api/admin/portfolio/' + this.getAttribute('data-id') + '/toggle');
      });
    });
    // Edit
    tbody.querySelectorAll('.btn-edit-work').forEach(function (btn) {
      btn.addEventListener('click', function () { openWorkModal(this.getAttribute('data-id')); });
    });
    // Delete
    tbody.querySelectorAll('.btn-del-work').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        showConfirm('Видалити роботу? Це незворотньо.', function () {
          api('DELETE', '/api/admin/portfolio/' + id).then(loadPortfolio);
        });
      });
    });
  }

  // Відкрити форму роботи
  document.getElementById('addWorkBtn').addEventListener('click', function () { openWorkModal(null); });

  function openWorkModal(id) {
    editingWorkId = id;
    workMaterials = [];
    uploadedUrls = [];
    document.getElementById('uploadPreviews').innerHTML = '';
    document.getElementById('workForm').reset();
    renderMaterialsTags();

    if (id) {
      document.getElementById('workModalTitle').textContent = 'Редагувати роботу';
      var item = portfolioItems.find(function (i) { return i.id === id; });
      if (!item) return;
      document.getElementById('workId').value     = item.id;
      document.getElementById('wTitle').value     = item.title || '';
      document.getElementById('wCategory').value  = item.category || 'wedding';
      document.getElementById('wDesc').value      = item.description || '';
      document.getElementById('wImages').value    = (item.images || []).join(', ');
      document.getElementById('wBust').value      = (item.parameters && item.parameters.bust) || '';
      document.getElementById('wWaist').value     = (item.parameters && item.parameters.waist) || '';
      document.getElementById('wHips').value      = (item.parameters && item.parameters.hips) || '';
      document.getElementById('wTime').value      = item.workingTime || '';
      document.getElementById('wPrice').value     = (item.pricing && item.pricing.basePrice) || '';
      document.getElementById('wPriceNote').value = (item.pricing && item.pricing.priceNote) || '';
      document.getElementById('wVisible').checked = item.isVisible !== false;
      workMaterials = (item.materials || []).slice();
      renderMaterialsTags();
    } else {
      document.getElementById('workModalTitle').textContent = 'Додати роботу';
      document.getElementById('workId').value = '';
    }

    document.getElementById('workOverlay').classList.add('open');
  }

  document.getElementById('workModalClose').addEventListener('click', closeWorkModal);
  document.getElementById('workCancelBtn').addEventListener('click', closeWorkModal);
  document.getElementById('workOverlay').addEventListener('click', function (e) {
    if (e.target === this) closeWorkModal();
  });
  function closeWorkModal() { document.getElementById('workOverlay').classList.remove('open'); }

  // Матеріали як теги
  function renderMaterialsTags() {
    var list = document.getElementById('materialsTags');
    list.innerHTML = '';
    workMaterials.forEach(function (m, i) {
      var span = document.createElement('span');
      span.className = 'tag-item';
      span.innerHTML = esc(m) + '<button class="tag-remove" data-i="' + i + '">×</button>';
      list.appendChild(span);
    });
    list.querySelectorAll('.tag-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        workMaterials.splice(parseInt(this.getAttribute('data-i')), 1);
        renderMaterialsTags();
      });
    });
  }
  document.getElementById('materialsField').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      var val = this.value.trim().replace(/,+$/, '');
      if (val) { workMaterials.push(val); renderMaterialsTags(); this.value = ''; }
    }
  });

  // Upload zone
  var uploadZone = document.getElementById('uploadZone');
  var uploadInput = document.getElementById('uploadInput');
  uploadZone.addEventListener('click', function (e) {
    if (e.target !== uploadInput) uploadInput.click();
  });
  uploadZone.addEventListener('dragover', function (e) { e.preventDefault(); this.classList.add('drag'); });
  uploadZone.addEventListener('dragleave', function () { this.classList.remove('drag'); });
  uploadZone.addEventListener('drop', function (e) {
    e.preventDefault();
    this.classList.remove('drag');
    handleFiles(e.dataTransfer.files);
  });
  uploadInput.addEventListener('change', function () { handleFiles(this.files); });

  function handleFiles(files) {
    Array.from(files).forEach(function (file) {
      if (!file.type.startsWith('image/')) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        var wrap = document.createElement('div');
        wrap.className = 'upload-preview';
        wrap.innerHTML = '<img src="' + e.target.result + '" alt=""><button class="upload-preview-remove" type="button">×</button>';
        wrap.querySelector('.upload-preview-remove').addEventListener('click', function () {
          wrap.remove();
        });
        document.getElementById('uploadPreviews').appendChild(wrap);
      };
      reader.readAsDataURL(file);
    });
    // Якщо підключений Cloudinary — тут буде реальний upload через /api/admin/upload
    // Зараз попередження
    if (files.length > 0) {
      document.getElementById('uploadPlaceholder').style.display = 'none';
    }
  }

  // Збереження роботи
  document.getElementById('workForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = document.getElementById('wTitle').value.trim();
    var cat   = document.getElementById('wCategory').value;
    if (!title) { alert("Введіть назву роботи"); return; }

    var imagesRaw = document.getElementById('wImages').value.trim();
    var images = imagesRaw ? imagesRaw.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [];

    var body = {
      title:       title,
      category:    cat,
      description: document.getElementById('wDesc').value.trim(),
      images:      images,
      materials:   workMaterials,
      parameters: {
        bust:  document.getElementById('wBust').value.trim(),
        waist: document.getElementById('wWaist').value.trim(),
        hips:  document.getElementById('wHips').value.trim()
      },
      workingTime: document.getElementById('wTime').value.trim(),
      pricing: {
        basePrice: parseInt(document.getElementById('wPrice').value) || 0,
        priceNote: document.getElementById('wPriceNote').value.trim(),
        currency:  'грн'
      },
      isVisible: document.getElementById('wVisible').checked
    };

    var btn = document.getElementById('workSubmitBtn');
    btn.disabled = true;

    var req = editingWorkId
      ? api('PUT',  '/api/admin/portfolio/' + editingWorkId, body)
      : api('POST', '/api/admin/portfolio', body);

    req.then(function () {
      btn.disabled = false;
      closeWorkModal();
      loadPortfolio();
    }).catch(function () {
      btn.disabled = false;
      alert('Помилка збереження');
    });
  });

  // ─── REQUESTS ──────────────────────────────────────────────────────────────
  var requestsData = [];
  var currentReqStatus = 'all';
  var currentReqId = null;

  function loadRequests(status) {
    currentReqStatus = status;
    var url = '/api/admin/requests' + (status && status !== 'all' ? '?status=' + status : '');
    api('GET', url).then(function (data) {
      requestsData = data.requests || [];
      renderRequestsTable();
    });
  }

  document.getElementById('reqFilters').addEventListener('click', function (e) {
    var btn = e.target.closest('.adm-filter-btn');
    if (!btn) return;
    document.querySelectorAll('.adm-filter-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    loadRequests(btn.getAttribute('data-status'));
  });

  function renderRequestsTable() {
    var tbody = document.getElementById('requestsTableBody');
    tbody.innerHTML = '';
    requestsData.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML =
        '<td>' + fmtDate(r.createdAt) + '</td>' +
        '<td style="color:var(--text)">' + esc(r.name) + '</td>' +
        '<td>' + esc(r.phone) + '</td>' +
        '<td>' + esc(r.size) + '</td>' +
        '<td>' + esc(r.portfolioItem || '—') + '</td>' +
        '<td>' + badge_(r.status) + '</td>' +
        '<td><button class="adm-btn-icon btn-view-req" data-id="' + r.id + '">👁</button></td>';
      tbody.appendChild(tr);
    });
    if (requestsData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:rgba(248,245,240,0.25);padding:32px">Заявок немає</td></tr>';
    }
    tbody.querySelectorAll('.btn-view-req').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openReqModal(this.getAttribute('data-id'));
      });
    });
    tbody.querySelectorAll('tr').forEach(function (tr) {
      tr.addEventListener('click', function () {
        var btn = this.querySelector('.btn-view-req');
        if (btn) openReqModal(btn.getAttribute('data-id'));
      });
    });
  }

  function openReqModal(id) {
    currentReqId = id;
    var r = requestsData.find(function (x) { return x.id === id; });
    if (!r) return;
    document.getElementById('reqModalTitle').textContent = 'Заявка від ' + r.name;
    document.getElementById('reqDetail').innerHTML =
      row('Ім\'я',    r.name) +
      row('Телефон',  r.phone) +
      row('Розмір',   r.size) +
      row('Робота',   r.portfolioItem || '—') +
      row('Побажання',r.message || '—') +
      row('Джерело',  r.source === 'telegram' ? 'Telegram' : 'Сайт') +
      row('Дата',     fmtDate(r.createdAt));
    document.getElementById('reqStatusSelect').value = r.status;
    document.getElementById('reqOverlay').classList.add('open');
  }

  function row(key, val) {
    return '<div class="req-row"><div class="req-key">' + key + '</div><div class="req-val">' + esc(String(val)) + '</div></div>';
  }

  document.getElementById('reqModalClose').addEventListener('click', closeReqModal);
  document.getElementById('reqModalCloseBtn').addEventListener('click', closeReqModal);
  document.getElementById('reqOverlay').addEventListener('click', function (e) {
    if (e.target === this) closeReqModal();
  });
  function closeReqModal() { document.getElementById('reqOverlay').classList.remove('open'); }

  document.getElementById('reqSaveStatus').addEventListener('click', function () {
    if (!currentReqId) return;
    var status = document.getElementById('reqStatusSelect').value;
    api('PUT', '/api/admin/requests/' + currentReqId + '/status', { status: status })
      .then(function () {
        closeReqModal();
        loadRequests(currentReqStatus);
        loadDashboard(); // оновити бейдж
      });
  });

  // ─── SITE PHOTOS ───────────────────────────────────────────────────────────
  function loadSitePhotos() {
    // Оновити превью з cache-bust щоб показати актуальне фото
    var v = '?v=' + Date.now();
    var heroImg = document.getElementById('heroPreviewImg');
    var aboutImg = document.getElementById('aboutPreviewImg');

    heroImg.style.display = '';
    document.getElementById('heroPreviewPlaceholder').style.display = 'none';
    heroImg.src = '/img/hero-photo.webp' + v;
    heroImg.onerror = function () {
      this.style.display = 'none';
      document.getElementById('heroPreviewPlaceholder').style.display = 'flex';
    };

    aboutImg.style.display = '';
    document.getElementById('aboutPreviewPlaceholder').style.display = 'none';
    aboutImg.src = '/img/inna-photo.webp' + v;
    aboutImg.onerror = function () {
      this.style.display = 'none';
      document.getElementById('aboutPreviewPlaceholder').style.display = 'flex';
    };
  }

  document.querySelectorAll('.site-photo-input').forEach(function (input) {
    input.addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      var type = this.getAttribute('data-type');
      var msgEl = document.getElementById(type === 'hero' ? 'heroPhotoMsg' : 'aboutPhotoMsg');
      var previewImg = document.getElementById(type === 'hero' ? 'heroPreviewImg' : 'aboutPreviewImg');
      var placeholder = document.getElementById(type === 'hero' ? 'heroPreviewPlaceholder' : 'aboutPreviewPlaceholder');

      msgEl.textContent = '⏳ Завантаження...';
      msgEl.className = 'site-photo-msg';

      var fd = new FormData();
      fd.append('photo', file);
      fd.append('type', type);

      fetch('/api/admin/upload/site-photo', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: fd
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.url) {
            previewImg.style.display = '';
            placeholder.style.display = 'none';
            previewImg.src = data.url;
            msgEl.textContent = '✓ Збережено';
            msgEl.className = 'site-photo-msg ok';
          } else {
            msgEl.textContent = '✗ ' + (data.error || 'Помилка');
            msgEl.className = 'site-photo-msg err';
          }
          setTimeout(function () { msgEl.textContent = ''; msgEl.className = 'site-photo-msg'; }, 4000);
        })
        .catch(function () {
          msgEl.textContent = '✗ Помилка з\'єднання';
          msgEl.className = 'site-photo-msg err';
        });

      this.value = ''; // reset щоб можна було завантажити знову
    });
  });

  // ─── SETTINGS ──────────────────────────────────────────────────────────────
  function loadSettings() {
    api('GET', '/api/admin/settings').then(function (data) {
      document.getElementById('sPhone').value     = data.phone     || '';
      document.getElementById('sInstagram').value = data.instagram || '';
      document.getElementById('sTelegram').value  = data.telegram  || '';
      document.getElementById('sAddress').value   = data.address   || '';
    });
    api('GET', '/api/admin/settings/integrations').then(function (data) {
      document.getElementById('iTelegramToken').placeholder  = data.telegramToken
        ? 'Збережено: ' + data.telegramToken
        : '1234567890:AAF...';
      document.getElementById('iTelegramChatId').value = data.telegramChatId || '';
      document.getElementById('iSiteUrl').value        = data.siteUrl        || '';
      document.getElementById('iAdminLogin').value     = data.adminLogin     || '';
    });
  }

  document.getElementById('settingsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var body = {
      phone:     document.getElementById('sPhone').value.trim(),
      instagram: document.getElementById('sInstagram').value.trim(),
      telegram:  document.getElementById('sTelegram').value.trim(),
      address:   document.getElementById('sAddress').value.trim()
    };
    api('PUT', '/api/admin/settings', body).then(function () {
      showSettingsMsg('settingsMsg', '✓ Збережено', 'ok');
    }).catch(function () {
      showSettingsMsg('settingsMsg', '✗ Помилка', 'err');
    });
  });

  document.getElementById('passwordForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var pw   = document.getElementById('pwNew').value;
    var conf = document.getElementById('pwConfirm').value;
    if (pw !== conf) { showSettingsMsg('passwordMsg', '✗ Паролі не співпадають', 'err'); return; }
    if (pw.length < 6) { showSettingsMsg('passwordMsg', '✗ Мінімум 6 символів', 'err'); return; }
    api('PUT', '/api/admin/settings/password', {
      currentPassword: document.getElementById('pwCurrent').value,
      newPassword: pw
    }).then(function (data) {
      if (data.success) {
        showSettingsMsg('passwordMsg', data.message || '✓ Пароль змінено', 'ok');
        document.getElementById('passwordForm').reset();
      } else {
        showSettingsMsg('passwordMsg', '✗ ' + (data.error || 'Помилка'), 'err');
      }
    });
  });

  document.getElementById('integrationsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var body = {
      telegramToken:  document.getElementById('iTelegramToken').value.trim(),
      telegramChatId: document.getElementById('iTelegramChatId').value.trim()
    };
    api('PUT', '/api/admin/settings/integrations', body).then(function (data) {
      showSettingsMsg('integrationsMsg', data.message || '✓ Збережено', data.success ? 'ok' : 'err');
      if (data.success) {
        document.getElementById('iTelegramToken').value = '';
        loadSettings();
      }
    });
  });

  document.getElementById('siteForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var body = {
      siteUrl:    document.getElementById('iSiteUrl').value.trim(),
      adminLogin: document.getElementById('iAdminLogin').value.trim()
    };
    api('PUT', '/api/admin/settings/integrations', body).then(function (data) {
      showSettingsMsg('siteMsg', data.message || '✓ Збережено', data.success ? 'ok' : 'err');
    });
  });

  document.getElementById('testTelegramBtn').addEventListener('click', function () {
    api('POST', '/api/admin/settings/test-telegram').then(function (data) {
      showSettingsMsg('telegramMsg', data.message || data.error, data.success ? 'ok' : 'err');
    });
  });

  function showSettingsMsg(id, text, cls) {
    var el = document.getElementById(id);
    el.textContent = text;
    el.className = 'settings-msg ' + cls;
    setTimeout(function () { el.textContent = ''; el.className = 'settings-msg'; }, 4000);
  }

  // ─── CONFIRM DIALOG ────────────────────────────────────────────────────────
  var confirmCallback = null;
  function showConfirm(text, cb) {
    document.getElementById('confirmText').textContent = text;
    confirmCallback = cb;
    document.getElementById('confirmOverlay').classList.add('open');
  }
  document.getElementById('confirmYes').addEventListener('click', function () {
    document.getElementById('confirmOverlay').classList.remove('open');
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });
  document.getElementById('confirmNo').addEventListener('click', function () {
    document.getElementById('confirmOverlay').classList.remove('open');
    confirmCallback = null;
  });
  document.getElementById('confirmOverlay').addEventListener('click', function (e) {
    if (e.target === this) { this.classList.remove('open'); confirmCallback = null; }
  });

  // ─── ESC ───────────────────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['workOverlay','reqOverlay','confirmOverlay'].forEach(function (id) {
      document.getElementById(id).classList.remove('open');
    });
  });

  // ─── УТИЛІТИ ───────────────────────────────────────────────────────────────
  var STATUS_LABELS = { new: '🆕 Нова', viewed: '👀 Переглянута', in_progress: '🔨 В роботі', done: '✅ Завершена' };

  function badge_(status) {
    var cls = { new:'badge-new', viewed:'badge-viewed', in_progress:'badge-in_progress', done:'badge-done' }[status] || '';
    return '<span class="badge ' + cls + '">' + (STATUS_LABELS[status] || status) + '</span>';
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.getDate() + '.' + String(d.getMonth()+1).padStart(2,'0') + ' '
      + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }
  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── СТАРТ ─────────────────────────────────────────────────────────────────
  switchSection('dashboard');

})();
