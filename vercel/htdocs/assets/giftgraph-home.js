(function () {
  var root = document.documentElement;
  var i18n = window.GiftGraphI18n || null;
  var storagePalette = 'giftgraph-palette';
  var storageMode = 'giftgraph-mode';
  var storageCustomPrefix = 'giftgraph-theme-custom';
  var defaultAutoDeleteKey = 'giftgraph-auto-delete-default-minutes';
  var panel = document.getElementById('theme-panel');
  var settingsToggle = document.getElementById('settings-toggle');
  var settingsClose = document.getElementById('settings-close');
  var searchInput = document.getElementById('graph-search');
  var emptyFilter = document.getElementById('empty-filter');
  var canvas = document.getElementById('ambient-canvas');
  var ctx = canvas ? canvas.getContext('2d') : null;
  var raf = 0;
  var points = [];
  var allowedPalettes = ['ember', 'reef', 'iris', 'graphite'];
  var paletteAliases = {
    violet: 'ember',
    plum: 'reef',
    moss: 'iris',
    mono: 'graphite'
  };
  var themeDefaults = {
    ember: {
      dark: { accent:'#b693ff', accent2:'#7d58d9', accent3:'#dbcbff' },
      light:{ accent:'#7a3cff', accent2:'#b08cff', accent3:'#eadcff' }
    },
    reef: {
      dark: { accent:'#8bb3ff', accent2:'#4677e8', accent3:'#d7e5ff' },
      light:{ accent:'#2f6bff', accent2:'#79a8ff', accent3:'#dbe7ff' }
    },
    iris: {
      dark: { accent:'#ff8fbf', accent2:'#c95682', accent3:'#ffd5e5' },
      light:{ accent:'#ca3c76', accent2:'#ff8bb7', accent3:'#ffd7e8' }
    },
    graphite: {
      dark: { accent:'#f0e1c7', accent2:'#b9a58e', accent3:'#73695c' },
      light:{ accent:'#22201c', accent2:'#7b7267', accent3:'#e3d8c8' }
    }
  };

  function tr(key, fallback) {
    return i18n && i18n.t ? i18n.t(key) : fallback;
  }

  function currentLanguage() {
    return i18n && i18n.lang ? i18n.lang() : 'ru';
  }

  function preferredMode() {
    return 'light';
  }

  function getSaved(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }

  function customKey(palette, mode) {
    return storageCustomPrefix + '.' + cleanPalette(palette) + '.' + cleanMode(mode);
  }

  function cleanHex(value) {
    value = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '';
  }

  function defaultThemeColors() {
    var palette = cleanPalette(root.getAttribute('data-palette') || 'ember');
    var mode = cleanMode(root.getAttribute('data-mode') || 'light');
    return themeDefaults[palette][mode];
  }

  function getThemeCustom() {
    try {
      var raw = localStorage.getItem(customKey(root.getAttribute('data-palette') || 'ember', root.getAttribute('data-mode') || 'light'));
      var data = raw ? JSON.parse(raw) : {};
      return {
        accent: cleanHex(data.accent),
        accent2: cleanHex(data.accent2),
        accent3: cleanHex(data.accent3)
      };
    } catch (e) {
      return {};
    }
  }

  function saveThemeCustom(next) {
    var current = getThemeCustom();
    var data = {
      accent: cleanHex(next.accent) || current.accent || '',
      accent2: cleanHex(next.accent2) || current.accent2 || '',
      accent3: cleanHex(next.accent3) || current.accent3 || ''
    };
    try {
      localStorage.setItem(customKey(root.getAttribute('data-palette') || 'ember', root.getAttribute('data-mode') || 'light'), JSON.stringify(data));
    } catch (e) {}
  }

  function clearThemeCustom() {
    try {
      localStorage.removeItem(customKey(root.getAttribute('data-palette') || 'ember', root.getAttribute('data-mode') || 'light'));
    } catch (e) {}
  }

  function activeThemeColors() {
    var defaults = defaultThemeColors();
    var custom = getThemeCustom();
    return {
      accent: custom.accent || defaults.accent,
      accent2: custom.accent2 || defaults.accent2,
      accent3: custom.accent3 || defaults.accent3
    };
  }

  function applyCustomColors() {
    var custom = getThemeCustom();
    ['accent', 'accent2', 'accent3'].forEach(function (key) {
      var cssName = key === 'accent' ? '--accent' : key === 'accent2' ? '--accent-2' : '--accent-3';
      if (custom[key]) root.style.setProperty(cssName, custom[key]);
      else root.style.removeProperty(cssName);
    });
  }

  function syncThemeColorInputs() {
    var colors = activeThemeColors();
    document.querySelectorAll('[data-theme-color]').forEach(function (input) {
      var key = input.getAttribute('data-theme-color');
      if (colors[key]) input.value = colors[key];
    });
  }

  function cleanPalette(value) {
    value = paletteAliases[value] || value;
    return allowedPalettes.indexOf(value) === -1 ? 'ember' : value;
  }

  function cleanMode(value) {
    return ['dark', 'light'].indexOf(value) === -1 ? 'light' : value;
  }

  function applyTheme(palette, mode) {
    palette = cleanPalette(palette);
    mode = cleanMode(mode);
    root.setAttribute('data-palette', palette);
    root.setAttribute('data-mode', mode);
    save(storagePalette, palette);
    save(storageMode, mode);
    applyCustomColors();
    updateControls();
    resetAmbient();
  }

  function cleanDefaultAutoDelete(value) {
    var minutes = parseInt(String(value || '0'), 10) || 0;
    return [0, 60, 1440, 10080].indexOf(minutes) === -1 ? 0 : minutes;
  }

  function defaultAutoDeleteLabel(minutes) {
    if (i18n && i18n.formatDefaultAutoDelete) return i18n.formatDefaultAutoDelete(minutes);
    if (!minutes) return 'По умолчанию автоудаление выключено';
    if (minutes === 60) return 'Новые графы будут удаляться через 1 час';
    if (minutes === 1440) return 'Новые графы будут удаляться через 24 часа';
    if (minutes === 10080) return 'Новые графы будут удаляться через 7 дней';
    return 'Автоудаление настроено';
  }

  function syncDefaultAutoDeleteControls() {
    var minutes = cleanDefaultAutoDelete(getSaved(defaultAutoDeleteKey, '0'));
    document.querySelectorAll('[data-default-autodelete]').forEach(function (button) {
      button.classList.toggle('active', cleanDefaultAutoDelete(button.getAttribute('data-default-autodelete')) === minutes);
    });
    var status = document.getElementById('default-autodelete-status');
    if (status) status.textContent = defaultAutoDeleteLabel(minutes);
  }

  function updateControls() {
    var palette = root.getAttribute('data-palette') || 'ember';
    var mode = root.getAttribute('data-mode') || 'light';
    document.querySelectorAll('[data-palette-choice]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-palette-choice') === palette);
    });
    document.querySelectorAll('[data-mode-choice]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-mode-choice') === mode);
    });
    syncThemeColorInputs();
    syncDefaultAutoDeleteControls();
  }

  function togglePanel(force) {
    if (!panel || !settingsToggle) return;
    var open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    settingsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('panel-open', open);
  }

  function css(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }

  function hexToRgb(hex) {
    hex = (hex || '#ffffff').replace('#', '').trim();
    if (hex.length === 3) {
      hex = hex.split('').map(function (x) { return x + x; }).join('');
    }
    var n = parseInt(hex.slice(0, 6), 16);
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255
    };
  }

  function rgba(hex, alpha) {
    var c = hexToRgb(hex || '#ffffff');
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    resetAmbient();
  }

  function resetAmbient() {
    if (!canvas || !ctx) return;
    var count = Math.max(18, Math.min(52, Math.round(window.innerWidth / 30)));
    points = Array.from({ length: count }, function (_, index) {
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        speed: 0.08 + Math.random() * 0.24,
        phase: Math.random() * Math.PI * 2,
        size: index % 7 === 0 ? 2.4 : 1.35
      };
    });
  }

  function drawAmbient(time) {
    if (!canvas || !ctx) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    var accent = css('--accent');
    var accent2 = css('--accent-2');
    var accent3 = css('--accent-3');
    var grid = css('--grid') || rgba(accent2, 0.1);
    ctx.clearRect(0, 0, w, h);

    ctx.lineWidth = 1;
    for (var ring = 0; ring < 4; ring++) {
      var cx = w * (0.16 + ring * 0.22);
      var cy = h * (0.2 + (ring % 2) * 0.32);
      var rx = 150 + ring * 50 + Math.sin(time * 0.0004 + ring) * 12;
      var ry = 68 + ring * 18;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.35 + ring * 0.18);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(ring % 2 ? accent2 : accent3, 0.12);
      ctx.stroke();
      ctx.restore();
    }

    for (var line = 0; line < 7; line++) {
      var y = h * (0.08 + line * 0.14);
      ctx.beginPath();
      ctx.moveTo(-40, y);
      for (var x = -40; x <= w + 80; x += 80) {
        var wobble = Math.sin(x * 0.01 + time * 0.00034 + line) * (10 + line);
        ctx.lineTo(x, y + wobble);
      }
      ctx.strokeStyle = line % 2 ? grid : rgba(accent, 0.11);
      ctx.stroke();
    }

    points.forEach(function (p, index) {
      p.x += Math.cos(time * 0.00026 + p.phase) * p.speed;
      p.y += Math.sin(time * 0.00022 + p.phase) * p.speed;
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = rgba(index % 3 === 0 ? accent : index % 3 === 1 ? accent2 : accent3, 0.34);
      ctx.fill();
    });

    raf = requestAnimationFrame(drawAmbient);
  }

  function normalizeSearch(value) {
    return (value || '').toLocaleLowerCase(currentLanguage() === 'en' ? 'en-US' : 'ru-RU').trim();
  }

  function syncArchiveCountLabel(visible) {
    var count = document.getElementById('graphs-count');
    if (!count) return;
    var label = count.closest('.archive-count');
    count.textContent = String(visible);
    if (!label || !i18n || !i18n.formatUnit) return;
    label.innerHTML = '<span id="graphs-count">' + String(visible) + '</span> ' + i18n.formatUnit('record', visible);
  }

  function refreshArchiveSummary() {
    if (!i18n || !i18n.formatArchiveSummary) return;
    var graphs = parseInt((document.getElementById('total-graphs') || {}).textContent || '0', 10) || 0;
    var nodes = parseInt((document.getElementById('total-nodes') || {}).textContent || '0', 10) || 0;
    var edges = parseInt((document.getElementById('total-edges') || {}).textContent || '0', 10) || 0;
    var summary = document.querySelector('.signal-banner h2');
    if (summary) summary.textContent = i18n.formatArchiveSummary(graphs, nodes, edges);
  }

  function deleteUrl(gid, source) {
    return (source && source.getAttribute('data-delete-url')) || ('/api/graphs/' + encodeURIComponent(gid));
  }

  function applyFilter() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('.graph-card'));
    var query = normalizeSearch(searchInput ? searchInput.value : '');
    var visible = 0;

    cards.forEach(function (card) {
      var haystack = normalizeSearch(card.getAttribute('data-search') || card.textContent || '');
      var match = !query || haystack.indexOf(query) !== -1;
      card.hidden = !match;
      if (match) visible += 1;
    });

    syncArchiveCountLabel(visible);
    refreshArchiveSummary();
    if (emptyFilter) emptyFilter.hidden = !query || visible > 0 || cards.length === 0;
  }

  window.showToast = function (msg, isError) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.className = 'toast'; }, 2500);
  };

  function askConfirm(options) {
    options = options || {};
    return new Promise(function (resolve) {
      var modal = document.createElement('div');
      modal.className = 'gg-confirm';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = '' +
        '<div class="gg-confirm-card">' +
          '<p class="gg-confirm-kicker">' + (options.kicker || tr('confirmKicker', 'подтверждение')) + '</p>' +
          '<h2 class="gg-confirm-title">' + (options.title || tr('confirmTitle', 'Подтвердить действие?')) + '</h2>' +
          '<p class="gg-confirm-text">' + (options.text || 'Это действие нельзя будет быстро отменить.') + '</p>' +
          '<div class="gg-confirm-actions">' +
            '<button class="gg-confirm-cancel" type="button" data-confirm="cancel">' + (options.cancel || 'Отмена') + '</button>' +
            '<button class="gg-confirm-danger" type="button" data-confirm="ok">' + (options.ok || tr('confirmOk', 'Удалить')) + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
      if (i18n && i18n.translate) i18n.translate(modal);

      function finish(value) {
        modal.classList.remove('open');
        setTimeout(function () { modal.remove(); }, 140);
        document.removeEventListener('keydown', onKey);
        resolve(value);
      }

      function onKey(event) {
        if (event.key === 'Escape') finish(false);
      }

      modal.addEventListener('click', function (event) {
        if (event.target === modal || event.target.getAttribute('data-confirm') === 'cancel') finish(false);
        if (event.target.getAttribute('data-confirm') === 'ok') finish(true);
      });
      document.addEventListener('keydown', onKey);
      requestAnimationFrame(function () {
        modal.classList.add('open');
        var cancel = modal.querySelector('[data-confirm="cancel"]');
        if (cancel) cancel.focus();
      });
    });
  }

  window.bumpMetric = function (id, delta) {
    var el = document.getElementById(id);
    if (!el) return;
    var next = Math.max(0, (parseInt(el.textContent, 10) || 0) + delta);
    el.textContent = String(next);
  };

  window.deleteGraph = async function (gid, btn) {
    var confirmed = await askConfirm({
      kicker: tr('confirmKicker', 'удаление графа'),
      title: tr('confirmTitle', 'Удалить этот граф?'),
      text: tr('confirmText', 'Граф исчезнет из архива и больше не будет открываться по старой ссылке.'),
      ok: tr('confirmOk', 'Удалить'),
      cancel: tr('confirmCancel', 'Оставить')
    });
    if (!confirmed) return;
    btn.disabled = true;
    var token = btn.getAttribute('data-delete-token') || '';
    var headers = token ? { 'X-GiftGraph-Delete-Token': token } : {};
    try {
      var r = await fetch(deleteUrl(gid, btn), { method: 'DELETE', headers: headers });
      if (r.ok) {
        var card = document.getElementById('card-' + gid);
        if (card) {
          var nodes = parseInt(card.getAttribute('data-nodes') || '0', 10) || 0;
          var edges = parseInt(card.getAttribute('data-edges') || '0', 10) || 0;
          card.style.opacity = '0';
          card.style.transform = 'translateY(8px) scale(0.99)';
          setTimeout(function () {
            card.remove();
            window.bumpMetric('total-nodes', -nodes);
            window.bumpMetric('total-edges', -edges);
            window.bumpMetric('total-graphs', -1);
            applyFilter();
            if (!document.querySelector('.graph-card')) window.location.reload();
          }, 240);
        }
        window.showToast(tr('graphDeleted', 'Граф удалён'));
      } else {
        var d = await r.json().catch(function () { return {}; });
        window.showToast(d.error || tr('deleteError', 'Ошибка удаления'), true);
        btn.disabled = false;
      }
    } catch (e) {
      window.showToast(tr('networkError', 'Ошибка сети'), true);
      btn.disabled = false;
    }
  };

  document.querySelectorAll('[data-palette-choice]').forEach(function (button) {
    button.addEventListener('click', function () {
      applyTheme(button.getAttribute('data-palette-choice'), root.getAttribute('data-mode') || 'light');
    });
  });

  document.querySelectorAll('[data-mode-choice]').forEach(function (button) {
    button.addEventListener('click', function () {
      applyTheme(root.getAttribute('data-palette') || 'ember', button.getAttribute('data-mode-choice'));
    });
  });

  document.querySelectorAll('[data-default-autodelete]').forEach(function (button) {
    button.addEventListener('click', function () {
      var minutes = cleanDefaultAutoDelete(button.getAttribute('data-default-autodelete'));
      save(defaultAutoDeleteKey, String(minutes));
      syncDefaultAutoDeleteControls();
    });
  });

  document.querySelectorAll('[data-theme-color]').forEach(function (input) {
    input.addEventListener('input', function () {
      var key = input.getAttribute('data-theme-color');
      var payload = {};
      payload[key] = input.value;
      saveThemeCustom(payload);
      applyCustomColors();
      resetAmbient();
    });
  });

  var colorReset = document.getElementById('theme-color-reset');
  if (colorReset) {
    colorReset.addEventListener('click', function () {
      clearThemeCustom();
      applyCustomColors();
      syncThemeColorInputs();
      resetAmbient();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyFilter);
  }

  if (settingsToggle) settingsToggle.addEventListener('click', function () { togglePanel(); });
  if (settingsClose) settingsClose.addEventListener('click', function () { togglePanel(false); });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') togglePanel(false);
  });

  document.addEventListener('click', function (event) {
    if (!panel || !panel.classList.contains('open')) return;
    if (event.target === panel) {
      togglePanel(false);
      return;
    }
    if (panel.contains(event.target) || (settingsToggle && settingsToggle.contains(event.target))) return;
    togglePanel(false);
  });

  document.addEventListener('giftgraph:languagechange', function () {
    if (i18n && i18n.translate) i18n.translate(document);
    syncDefaultAutoDeleteControls();
    applyFilter();
  });

  applyTheme(getSaved(storagePalette, 'ember'), getSaved(storageMode, preferredMode()));
  if (i18n && i18n.init) i18n.init(document);
  applyFilter();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    raf = requestAnimationFrame(drawAmbient);
  } else {
    drawAmbient(0);
    cancelAnimationFrame(raf);
  }
})();
