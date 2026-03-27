(function () {
  'use strict';

  var PAGE_SIZE = 9;
  var currentPage = 1;
  var currentFilter = 'all';
  var totalItems = 0;
  var loadedItems = 0;
  var currentModalItem = null;
  var currentSlide = 0;
  var selectedSize = '';

  var grid        = document.getElementById('ptfGrid');
  var loadMoreBtn = document.getElementById('loadMoreBtn');
  var loadMoreWrap= document.getElementById('loadMoreWrap');
  var ptfCount    = document.getElementById('ptfCount');
  var ptfEmpty    = document.getElementById('ptfEmpty');

  // ─── КАТЕГОРІЇ ────────────────────────────────────────────────────────────
  var CAT_LABELS = { wedding: 'Весільний', evening: 'Вечірній', casual: 'Casual' };
  var CAT_COLORS = {
    wedding: 'linear-gradient(135deg,#1a1410,#0d0b09)',
    evening: 'linear-gradient(135deg,#1a1016,#110d14)',
    casual:  'linear-gradient(135deg,#141a14,#0d1410)'
  };

  // ─── ЗАВАНТАЖЕННЯ ПОРТФОЛІО ───────────────────────────────────────────────
  function buildUrl(page, filter) {
    var url = '/api/portfolio?page=' + page + '&limit=' + PAGE_SIZE;
    if (filter && filter !== 'all') url += '&category=' + filter;
    return url;
  }

  function fetchItems(page, filter, append) {
    loadMoreBtn.disabled = true;
    fetch(buildUrl(page, filter))
      .then(function(r){ return r.json(); })
      .then(function(data) {
        var items = data.items || [];
        totalItems = data.total || 0;

        if (!append) {
          grid.innerHTML = '';
          loadedItems = 0;
        }

        if (items.length === 0 && !append) {
          ptfEmpty.style.display = 'block';
          loadMoreWrap.style.display = 'none';
          return;
        }

        ptfEmpty.style.display = 'none';
        items.forEach(function(item) { grid.appendChild(buildCard(item)); });
        loadedItems += items.length;

        updateCount();
        updateLoadMore(data);
        initReveal();
      })
      .catch(function() {
        if (!append) {
          grid.innerHTML = '<div class="ptf-empty"><p>Помилка завантаження. Спробуйте пізніше.</p></div>';
          loadMoreWrap.style.display = 'none';
        }
      });
  }

  function updateCount() {
    ptfCount.textContent = 'Показано ' + loadedItems + ' з ' + totalItems + ' робіт';
  }

  function updateLoadMore(data) {
    var hasMore = loadedItems < totalItems;
    loadMoreWrap.style.display = 'flex';
    loadMoreBtn.disabled = !hasMore;
    loadMoreBtn.style.display = hasMore ? '' : 'none';
  }

  // ─── ПОБУДОВА КАРТКИ ──────────────────────────────────────────────────────
  function buildCard(item) {
    var div = document.createElement('div');
    div.className = 'ptf-card reveal';
    div.setAttribute('data-id', item.id);

    var bgHtml;
    if (item.images && item.images.length > 0) {
      bgHtml = '<img src="' + item.images[0] + '" alt="' + esc(item.title) + '" loading="lazy">';
    } else {
      bgHtml = '<div class="ptf-card-bg-placeholder">'
        + '<svg viewBox="0 0 200 300" fill="none"><path d="M100 20C60 20 30 50 25 90L20 160C20 180 30 200 50 210L70 220 70 280 100 280 100 220 130 220 150 210C170 200 180 180 180 160L175 90C170 50 140 20 100 20Z" stroke="#B8965A" stroke-width="1"/></svg>'
        + '</div>';
    }

    var catLabel = CAT_LABELS[item.category] || item.category;
    var priceStr = item.pricing && item.pricing.basePrice
      ? 'від ' + item.pricing.basePrice.toLocaleString('uk-UA') + ' грн'
      : '';

    div.innerHTML =
      '<div class="ptf-card-bg" style="background:' + (CAT_COLORS[item.category] || 'linear-gradient(135deg,#1e1a14,#120f0a)') + '">'
        + bgHtml
      + '</div>'
      + '<div class="ptf-card-overlay">'
        + '<div class="ptf-card-cat">' + esc(catLabel) + '</div>'
        + '<div class="ptf-card-name">' + esc(item.title) + '</div>'
        + (priceStr ? '<div class="ptf-card-price">' + esc(priceStr) + '</div>' : '')
        + '<button class="ptf-card-btn">Детальніше</button>'
      + '</div>';

    div.addEventListener('click', function() { openModal(item); });
    return div;
  }

  // ─── ФІЛЬТРИ ──────────────────────────────────────────────────────────────
  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      currentPage = 1;
      fetchItems(currentPage, currentFilter, false);
    });
  });

  // ─── LOAD MORE ────────────────────────────────────────────────────────────
  loadMoreBtn.addEventListener('click', function() {
    currentPage++;
    fetchItems(currentPage, currentFilter, true);
  });

  // ─── MODAL ────────────────────────────────────────────────────────────────
  var overlay    = document.getElementById('modalOverlay');
  var modalClose = document.getElementById('modalClose');
  var sliderTrack= document.getElementById('sliderTrack');
  var sliderDots = document.getElementById('sliderDots');
  var sliderCounter = document.getElementById('sliderCounter');
  var sliderPrev = document.getElementById('sliderPrev');
  var sliderNext = document.getElementById('sliderNext');

  function openModal(item) {
    currentModalItem = item;
    currentSlide = 0;

    // Заповнюємо інфо
    document.getElementById('modalCat').textContent = CAT_LABELS[item.category] || item.category;
    document.getElementById('modalTitle').textContent = item.title;
    document.getElementById('modalDesc').textContent = item.description || '—';

    // Матеріали
    var matSection = document.getElementById('materialsSection');
    var matEl = document.getElementById('modalMaterials');
    if (item.materials && item.materials.length > 0) {
      matEl.innerHTML = item.materials.map(function(m){ return '<span class="modal-tag">' + esc(m) + '</span>'; }).join('');
      matSection.style.display = '';
    } else {
      matSection.style.display = 'none';
    }

    // Параметри
    var paramSection = document.getElementById('paramsSection');
    var paramEl = document.getElementById('modalParams');
    var p = item.parameters || {};
    var paramRows = [];
    if (p.bust)  paramRows.push('<div class="modal-param-row"><span class="modal-param-key">Груди:</span> ' + esc(p.bust) + '</div>');
    if (p.waist) paramRows.push('<div class="modal-param-row"><span class="modal-param-key">Талія:</span> ' + esc(p.waist) + '</div>');
    if (p.hips)  paramRows.push('<div class="modal-param-row"><span class="modal-param-key">Стегна:</span> ' + esc(p.hips) + '</div>');
    if (paramRows.length > 0) {
      paramEl.innerHTML = paramRows.join('');
      paramSection.style.display = '';
    } else {
      paramSection.style.display = 'none';
    }

    // Час виготовлення
    var timeSection = document.getElementById('timeSection');
    var timeEl = document.getElementById('modalTime');
    if (item.workingTime) {
      timeEl.textContent = item.workingTime;
      timeSection.style.display = '';
    } else {
      timeSection.style.display = 'none';
    }

    // Ціна
    if (item.pricing && item.pricing.basePrice) {
      document.getElementById('modalPrice').textContent = 'від ' + item.pricing.basePrice.toLocaleString('uk-UA') + ' грн';
      document.getElementById('modalPriceNote').textContent = item.pricing.priceNote || '';
    } else {
      document.getElementById('modalPrice').textContent = '';
      document.getElementById('modalPriceNote').textContent = '';
    }

    // Слайдер фото
    buildSlider(item.images || []);

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function buildSlider(images) {
    sliderTrack.innerHTML = '';
    sliderDots.innerHTML = '';

    var count = images.length || 1;

    if (images.length === 0) {
      // Заглушка
      var slide = document.createElement('div');
      slide.className = 'slider-slide active';
      slide.innerHTML = '<div class="slider-slide-placeholder">'
        + '<svg viewBox="0 0 200 300" fill="none"><path d="M100 20C60 20 30 50 25 90L20 160C20 180 30 200 50 210L70 220 70 280 100 280 100 220 130 220 150 210C170 200 180 180 180 160L175 90C170 50 140 20 100 20Z" stroke="#B8965A" stroke-width="1.2"/></svg>'
        + '</div>';
      sliderTrack.appendChild(slide);
      count = 1;
    } else {
      images.forEach(function(url, i) {
        var slide = document.createElement('div');
        slide.className = 'slider-slide' + (i === 0 ? ' active' : '');
        var img = document.createElement('img');
        img.src = url;
        img.alt = '';
        slide.appendChild(img);
        sliderTrack.appendChild(slide);

        var dot = document.createElement('button');
        dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Фото ' + (i+1));
        dot.addEventListener('click', function(){ goToSlide(i); });
        sliderDots.appendChild(dot);
      });
    }

    updateSliderUI(0, count);
    sliderPrev.classList.toggle('hidden', count <= 1);
    sliderNext.classList.toggle('hidden', count <= 1);
    sliderDots.style.display = count > 1 ? 'flex' : 'none';
  }

  function goToSlide(idx) {
    var slides = sliderTrack.querySelectorAll('.slider-slide');
    var dots   = sliderDots.querySelectorAll('.slider-dot');
    if (!slides.length) return;
    var count = slides.length;
    idx = ((idx % count) + count) % count;

    slides[currentSlide].classList.remove('active');
    if (dots[currentSlide]) dots[currentSlide].classList.remove('active');

    currentSlide = idx;
    slides[currentSlide].classList.add('active');
    if (dots[currentSlide]) dots[currentSlide].classList.add('active');

    updateSliderUI(currentSlide, count);
  }

  function updateSliderUI(idx, count) {
    sliderCounter.textContent = 'Фото ' + (idx + 1) + ' з ' + count;
  }

  sliderPrev.addEventListener('click', function() {
    var count = sliderTrack.querySelectorAll('.slider-slide').length;
    goToSlide(currentSlide - 1);
  });
  sliderNext.addEventListener('click', function() {
    goToSlide(currentSlide + 1);
  });

  function closeModal() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    currentModalItem = null;
  }

  modalClose.addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeModal();
  });

  // Кнопка "Замовити цей корсет" — відкриває order popup
  document.getElementById('modalOrderBtn').addEventListener('click', function() {
    var work = currentModalItem ? currentModalItem.title : '';
    openOrder(work);
  });

  // ─── ORDER POPUP ──────────────────────────────────────────────────────────
  var orderOverlay = document.getElementById('orderOverlay');
  var orderClose   = document.getElementById('orderClose');
  var orderForm    = document.getElementById('orderForm');
  var orderSuccess = document.getElementById('orderSuccess');
  var orderFormWrap= document.getElementById('orderFormWrap');

  function openOrder(prefillWork) {
    selectedSize = '';
    document.querySelectorAll('.size-btn').forEach(function(b){ b.classList.remove('active'); });
    orderForm.reset();
    document.getElementById('oNameErr').textContent = '';
    document.getElementById('oPhoneErr').textContent = '';
    orderFormWrap.style.display = '';
    orderSuccess.style.display = 'none';
    if (prefillWork) document.getElementById('oWork').value = prefillWork;
    orderOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeOrder() {
    orderOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  orderClose.addEventListener('click', closeOrder);
  orderOverlay.addEventListener('click', function(e) {
    if (e.target === orderOverlay) closeOrder();
  });

  // Кнопка "Замовити" в навігації → відкриває форму без прив'язки
  document.getElementById('navCta').addEventListener('click', function() {
    openOrder('');
  });

  // Вибір розміру
  document.querySelectorAll('.size-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.size-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      selectedSize = btn.getAttribute('data-size');
    });
  });

  // Відправка форми
  orderForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var name  = document.getElementById('oName').value.trim();
    var phone = document.getElementById('oPhone').value.trim();
    var work  = document.getElementById('oWork').value.trim();
    var msg   = document.getElementById('oMessage').value.trim();

    var valid = true;
    if (!name || name.length < 2) {
      document.getElementById('oNameErr').textContent = "Введіть ім'я (мінімум 2 символи)";
      valid = false;
    } else {
      document.getElementById('oNameErr').textContent = '';
    }
    if (!phone || phone.length < 5) {
      document.getElementById('oPhoneErr').textContent = 'Введіть телефон або Telegram';
      valid = false;
    } else {
      document.getElementById('oPhoneErr').textContent = '';
    }
    if (!valid) return;

    var btn = orderForm.querySelector('.form-submit');
    btn.disabled = true;
    btn.textContent = 'Надсилається...';

    fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, phone: phone, size: selectedSize, portfolioItem: work, message: msg })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success) {
        orderFormWrap.style.display = 'none';
        orderSuccess.style.display = 'block';
      } else {
        btn.disabled = false;
        btn.textContent = 'Надіслати заявку →';
        alert(data.error || 'Помилка. Спробуйте ще раз.');
      }
    })
    .catch(function() {
      btn.disabled = false;
      btn.textContent = 'Надіслати заявку →';
      alert('Помилка з\'єднання. Спробуйте ще раз.');
    });
  });

  // ─── ESC ──────────────────────────────────────────────────────────────────
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (orderOverlay.classList.contains('open')) closeOrder();
      else if (overlay.classList.contains('open')) closeModal();
    }
  });

  // ─── SCROLL REVEAL ────────────────────────────────────────────────────────
  function initReveal() {
    var els = grid.querySelectorAll('.reveal:not(.visible)');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(en) {
          if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
        });
      }, { threshold: 0.05 });
      els.forEach(function(el) { io.observe(el); });
    } else {
      els.forEach(function(el) { el.classList.add('visible'); });
    }
  }

  // ─── УТИЛІТИ ──────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── СТАРТ ────────────────────────────────────────────────────────────────
  fetchItems(1, 'all', false);

})();
