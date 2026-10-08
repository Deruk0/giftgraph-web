(function () {
  var root = document.documentElement;
  var i18n = window.GiftGraphI18n || null;
  var storagePalette = 'giftgraph-palette';
  var storageMode = 'giftgraph-mode';
  var storageCustomPrefix = 'giftgraph-theme-custom';
  var defaultAutoDeleteKey = 'giftgraph-auto-delete-default-minutes';
  var canvas = document.getElementById('giftgraph-ambient-canvas');
  var ctx = canvas ? canvas.getContext('2d') : null;
  var points = [];
  var raf = 0;
  var allowedPalettes = ['ember', 'reef', 'iris', 'graphite'];
  var paletteAliases = {
    violet: 'ember',
    plum: 'reef',
    moss: 'iris',
    mono: 'graphite'
  };
  var graphBase = { nodes: null, edges: null };
  var worldGridBound = false;
  var zoomLimitBound = false;
  var nodeDetailsBound = false;
  var selectedDetailsNode = null;
  var minZoomScale = 0.02;
  var autoDeleteTimer = 0;
  var graphPalettes = {
    ember: {
      dark: { start:'#fff7fb', regular:'#8c68e6', path:'#b693ff', anonymous:'#ffaf5f', bot:'#45d3be', promo:'#f6c85f', edge:'#8e8299', edgePath:'#c7b0ff', font:'#f7f0ff' },
      light:{ start:'#16110d', regular:'#b08cff', path:'#7a3cff', anonymous:'#ef8a24', bot:'#149d88', promo:'#d68112', edge:'#7b7065', edgePath:'#7a3cff', font:'#16110d' }
    },
    reef: {
      dark: { start:'#fbfdff', regular:'#5d8df3', path:'#8bb3ff', anonymous:'#ffaf5f', bot:'#45d3be', promo:'#f6c85f', edge:'#8494ab', edgePath:'#9fc1ff', font:'#eff5ff' },
      light:{ start:'#11151d', regular:'#79a8ff', path:'#2f6bff', anonymous:'#ef8a24', bot:'#149d88', promo:'#d68112', edge:'#738191', edgePath:'#2f6bff', font:'#11151d' }
    },
    iris: {
      dark: { start:'#fff7fb', regular:'#d8689a', path:'#ff8fbf', anonymous:'#ffaf5f', bot:'#45d3be', promo:'#f6c85f', edge:'#997c8a', edgePath:'#ffadd0', font:'#fff0f6' },
      light:{ start:'#181113', regular:'#ff8bb7', path:'#ca3c76', anonymous:'#ef8a24', bot:'#149d88', promo:'#d68112', edge:'#826f76', edgePath:'#ca3c76', font:'#181113' }
    },
    graphite: {
      dark: { start:'#fff8ec', regular:'#cdb79b', path:'#f0e1c7', anonymous:'#ffb46c', bot:'#54d1bf', promo:'#f6cb6b', edge:'#978a7b', edgePath:'#f0e1c7', font:'#f5ecdf' },
      light:{ start:'#14110d', regular:'#7b7267', path:'#22201c', anonymous:'#d9791f', bot:'#1c8f7f', promo:'#b7791f', edge:'#7b7065', edgePath:'#22201c', font:'#14110d' }
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

  function cleanPalette(value) {
    value = paletteAliases[value] || value;
    return allowedPalettes.indexOf(value) === -1 ? 'ember' : value;
  }

  function cleanMode(value) {
    return ['dark', 'light'].indexOf(value) === -1 ? 'light' : value;
  }

  function cleanHex(value) {
    value = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '';
  }

  function customKey(palette, mode) {
    return storageCustomPrefix + '.' + cleanPalette(palette) + '.' + cleanMode(mode);
  }

  function graphAccentDefaults() {
    var palette = cleanPalette(root.getAttribute('data-gg-palette') || 'ember');
    var mode = cleanMode(root.getAttribute('data-gg-mode') || 'light');
    var base = graphPalettes[palette][mode] || graphPalettes.ember.dark;
    return { accent: base.path, accent2: base.regular, accent3: base.bot };
  }

  function getThemeCustom() {
    try {
      var raw = localStorage.getItem(customKey(root.getAttribute('data-gg-palette') || 'ember', root.getAttribute('data-gg-mode') || 'light'));
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
      localStorage.setItem(customKey(root.getAttribute('data-gg-palette') || 'ember', root.getAttribute('data-gg-mode') || 'light'), JSON.stringify(data));
    } catch (e) {}
  }

  function clearThemeCustom() {
    try {
      localStorage.removeItem(customKey(root.getAttribute('data-gg-palette') || 'ember', root.getAttribute('data-gg-mode') || 'light'));
    } catch (e) {}
  }

  function activeThemeColors() {
    var defaults = graphAccentDefaults();
    var custom = getThemeCustom();
    return {
      accent: custom.accent || defaults.accent,
      accent2: custom.accent2 || defaults.accent2,
      accent3: custom.accent3 || defaults.accent3
    };
  }

  function applyCustomColors() {
    var custom = getThemeCustom();
    [
      { key: 'accent', css: '--gg-accent' },
      { key: 'accent2', css: '--gg-accent-2' },
      { key: 'accent3', css: '--gg-accent-3' }
    ].forEach(function (item) {
      if (custom[item.key]) root.style.setProperty(item.css, custom[item.key]);
      else root.style.removeProperty(item.css);
    });
  }

  function syncThemeColorInputs() {
    var colors = activeThemeColors();
    document.querySelectorAll('[data-gg-theme-color]').forEach(function (input) {
      var key = input.getAttribute('data-gg-theme-color');
      if (colors[key]) input.value = colors[key];
    });
  }

  function css(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }

  function hexToRgb(hex) {
    hex = (hex || '#ffffff').replace('#', '').trim();
    if (hex.length === 3) hex = hex.split('').map(function (x) { return x + x; }).join('');
    var n = parseInt(hex.slice(0, 6), 16);
    return { r:(n >> 16) & 255, g:(n >> 8) & 255, b:n & 255 };
  }

  function rgba(hex, alpha) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getNetwork() {
    try {
      if (typeof network !== 'undefined' && network) return network;
    } catch (e) {}
    return window.network || null;
  }

  function getGraphMeta() {
    var shell = document.getElementById('giftgraph-shell');
    if (!shell || !shell.dataset || !shell.dataset.meta) return null;
    try {
      return JSON.parse(shell.dataset.meta);
    } catch (e) {
      return null;
    }
  }

  function graphNodeTitle(id, info) {
    info = Object.assign({ id: id }, info || {});
    if (i18n && i18n.formatNodeTitle) return i18n.formatNodeTitle(info);
    return info.title || info.label || id;
  }

  function nodeDetailsText(ru, en) {
    return currentLanguage() === 'en' ? en : ru;
  }

  // Saved snapshots already contain this metadata, including merged mutual gifts.
  function nodeDetailsData(id, meta) {
    if (!meta || !meta.nodes || !Object.prototype.hasOwnProperty.call(meta.nodes, id)) return null;
    var info = meta.nodes[id];
    var peers = new Set();
    var mutualPeers = new Set();
    var gifts = 0;
    var hasGiftCounts = true;
    (meta.edges || []).forEach(function (edge) {
      if (String(edge.from) !== String(id) && String(edge.to) !== String(id)) return;
      var peer = String(edge.from) === String(id) ? String(edge.to) : String(edge.from);
      if (peer !== String(id)) peers.add(peer);
      if (edge.mutual && peer !== String(id)) mutualPeers.add(peer);
      if (edge.count == null || !Number.isFinite(Number(edge.count))) hasGiftCounts = false;
      else gifts += Math.max(0, Number(edge.count));
    });
    var numericId = /^id_?\d+$/.test(String(id));
    var username = String(info.label || id).replace(/^@/, '');
    if (info.anonymous || info.kind === 'anonymous' || numericId || !/^[a-z][a-z0-9_]{4,31}$/i.test(username)) username = '';
    return {
      id: String(id), label: info.label || String(id), info: info,
      type: info.anonymous || info.kind === 'anonymous' ? 'anonymous' : info.is_bot || info.kind === 'bot' ? 'bot' : 'user',
      connections: peers.size, gifts: hasGiftCounts ? gifts : null,
      peers: Array.from(peers),
      mutual: mutualPeers.size, username: username,
      identity: numericId ? String(id).replace(/^id_?/, '') : String(id)
    };
  }

  function closeNodeDetails() {
    selectedDetailsNode = null;
    var panel = document.getElementById('giftgraph-node-details');
    if (panel) panel.hidden = true;
    applyNodeFocus();
  }

  function applyNodeFocus() {
    var net = getNetwork();
    if (!net || !net.body || !net.body.data) return;
    var data = selectedDetailsNode !== null ? nodeDetailsData(selectedDetailsNode, getGraphMeta()) : null;
    var bright = data ? new Set([data.id].concat(data.peers)) : null;
    net.body.data.nodes.update(net.body.data.nodes.get().map(function (node) {
      return { id: node.id, opacity: !bright || bright.has(String(node.id)) ? 1 : 0.2 };
    }));
    net.body.data.edges.update(net.body.data.edges.get().map(function (edge) {
      var connected = !data || String(edge.from) === data.id || String(edge.to) === data.id;
      return { id: edge.id, color: Object.assign({}, typeof edge.color === 'object' ? edge.color : { color: edge.color }, { opacity: connected ? 0.86 : 0.12 }) };
    }));
  }

  function focusNodeConnections(id) {
    var net = getNetwork();
    var data = nodeDetailsData(id, getGraphMeta());
    if (!net || !data || typeof net.fit !== 'function') return;
    if (typeof net.stopSimulation === 'function') net.stopSimulation();
    var canvas = document.getElementById('mynetwork');
    var toolbar = document.getElementById('giftgraph-toolbar');
    var panel = document.getElementById('giftgraph-node-details');
    if (canvas && typeof net.getBoundingBox === 'function' && typeof net.moveTo === 'function') {
      var frame = canvas.getBoundingClientRect();
      var top = Math.max(frame.top + 16, toolbar ? toolbar.getBoundingClientRect().bottom + 12 : frame.top + 16);
      var bottom = Math.min(frame.bottom - 16, panel && !panel.hidden ? panel.getBoundingClientRect().top - 12 : frame.bottom - 16);
      var boxes = [data.id].concat(data.peers).map(function (nodeId) { return net.getBoundingBox(nodeId); });
      var left = Math.min.apply(null, boxes.map(function (box) { return box.left; }));
      var right = Math.max.apply(null, boxes.map(function (box) { return box.right; }));
      var upper = Math.min.apply(null, boxes.map(function (box) { return box.top; }));
      var lower = Math.max.apply(null, boxes.map(function (box) { return box.bottom; }));
      if (bottom > top && frame.width > 32 && [left, right, upper, lower].every(Number.isFinite)) {
        net.moveTo({
          position: { x: (left + right) / 2, y: (upper + lower) / 2 },
          scale: Math.max(minZoomScale, Math.min(1, (frame.width - 32) / Math.max(1, right - left), (bottom - top) / Math.max(1, lower - upper))),
          offset: { x: 0, y: (top + bottom) / 2 - (frame.top + frame.bottom) / 2 },
          animation: { duration: 420, easingFunction: 'easeInOutQuad' }
        });
        return;
      }
    }
    net.fit({ nodes: [data.id].concat(data.peers), animation: { duration: 420, easingFunction: 'easeInOutQuad' } });
  }

  function copyNodeIdentity(data) {
    var value = data.username ? '@' + data.username : data.identity;
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      window.giftgraphNotify(nodeDetailsText('Копирование недоступно в этом браузере', 'Clipboard is unavailable in this browser'), true);
      return;
    }
    navigator.clipboard.writeText(value).then(function () {
      window.giftgraphNotify(nodeDetailsText('Скопировано: ', 'Copied: ') + value);
    }).catch(function () {
      window.giftgraphNotify(nodeDetailsText('Не удалось скопировать', 'Could not copy'), true);
    });
  }

  function showNodeDetails(id) {
    var data = nodeDetailsData(id, getGraphMeta());
    if (!data) { closeNodeDetails(); return; }
    selectedDetailsNode = id;
    var panel = document.getElementById('giftgraph-node-details');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'giftgraph-node-details';
      panel.setAttribute('aria-labelledby', 'gg-node-name');
      document.body.appendChild(panel);
    }
    panel.replaceChildren();
    function element(tag, className, text, parent) {
      var el = document.createElement(tag);
      el.className = className;
      if (text != null) el.textContent = String(text);
      if (parent) parent.appendChild(el);
      return el;
    }
    var head = element('div', 'gg-node-head', null, panel);
    var heading = element('div', 'gg-node-heading', null, head);
    var type = data.type === 'bot' ? nodeDetailsText('Бот', 'Bot') : data.type === 'anonymous' ? nodeDetailsText('Анонимный отправитель', 'Anonymous sender') : nodeDetailsText('Пользователь', 'User');
    element('span', 'gg-node-type', type, heading);
    element('h2', 'gg-node-name', data.label, heading).id = 'gg-node-name';
    var close = element('button', 'gg-node-close', '×', head);
    close.type = 'button';
    close.setAttribute('aria-label', nodeDetailsText('Закрыть карточку участника', 'Close participant details'));
    close.addEventListener('click', closeNodeDetails);
    var body = element('div', 'gg-node-body', null, panel);
    var stats = element('dl', 'gg-node-stats', null, body);
    [
      [nodeDetailsText('Связей', 'Connections'), data.connections],
      [nodeDetailsText('Подарков', 'Gifts'), data.gifts == null ? '—' : data.gifts],
      [nodeDetailsText('Взаимных', 'Mutual'), data.mutual]
    ].forEach(function (stat) {
      var cell = element('div', 'gg-node-stat', null, stats);
      element('dt', '', stat[0], cell);
      element('dd', '', stat[1], cell);
    });
    var more = element('div', 'gg-node-more' + (data.username ? ' has-profile' : ''), null, body);
    var extra = element('details', 'gg-node-extra', null, more);
    element('summary', '', nodeDetailsText('Подробнее', 'More details'), extra);
    var content = element('div', 'gg-node-extra-content', null, extra);
    element('p', 'gg-node-identity', (data.username ? 'Username: @' + data.username : 'ID: ' + data.identity), content);
    if (data.info.kind === 'start' || data.info.kind === 'path') {
      element('span', 'gg-node-role', data.info.kind === 'start' ? nodeDetailsText('Начало поиска', 'Search start') : nodeDetailsText('На найденном пути', 'On the found path'), content);
    }
    if (Number.isFinite(data.info.level)) {
      element('p', 'gg-node-level', nodeDetailsText('Уровень от начала поиска: ', 'Level from search start: ') + data.info.level, content);
    }
    var actions = element('div', 'gg-node-actions', null, more);
    var focus = element('button', 'gg-node-action', '◎', actions);
    focus.type = 'button';
    focus.setAttribute('aria-label', nodeDetailsText('Показать связи', 'Show connections'));
    focus.title = nodeDetailsText('Показать связи', 'Show connections');
    focus.addEventListener('click', function () { extra.open = false; focusNodeConnections(id); });
    var copy = element('button', 'gg-node-action', '⧉', actions);
    copy.type = 'button';
    copy.setAttribute('aria-label', data.username ? nodeDetailsText('Копировать ник', 'Copy username') : nodeDetailsText('Копировать ID', 'Copy ID'));
    copy.title = data.username ? nodeDetailsText('Копировать ник', 'Copy username') : nodeDetailsText('Копировать ID', 'Copy ID');
    copy.addEventListener('click', function () { copyNodeIdentity(data); });
    if (data.username) {
      var profile = element('a', 'gg-node-action gg-node-profile', 'TG', actions);
      profile.setAttribute('aria-label', nodeDetailsText('Открыть Telegram', 'Open Telegram'));
      profile.title = nodeDetailsText('Открыть Telegram', 'Open Telegram');
      profile.href = 'https://t.me/' + data.username;
      profile.target = '_blank';
      profile.rel = 'noopener noreferrer';
    }
    element('p', 'gg-node-note', nodeDetailsText('Данные только из этого графа. Взаимные подарки учтены суммарно.', 'Data from this graph only. Mutual gifts are counted together.'), content);
    if (data.peers.length) {
      element('h3', 'gg-node-neighbors-title', nodeDetailsText('Связанные участники', 'Connected participants'), content);
      var list = element('div', 'gg-node-neighbors', null, content);
      var meta = getGraphMeta();
      var peers = data.peers.slice().sort(function (a, b) {
        return String(meta.nodes[a] && meta.nodes[a].label || a).localeCompare(String(meta.nodes[b] && meta.nodes[b].label || b));
      });
      var shown = 0;
      var next = element('button', 'gg-node-more-peers', nodeDetailsText('Показать ещё', 'Show more'), content);
      next.type = 'button';
      function appendPeers() {
        var end = Math.min(shown + 20, peers.length);
        for (; shown < end; shown++) {
          (function (peer) {
            var button = element('button', 'gg-node-neighbor', meta.nodes[peer] && meta.nodes[peer].label || peer, list);
            button.type = 'button';
            button.addEventListener('click', function () {
              var net = getNetwork();
              showNodeDetails(peer);
              if (net && typeof net.selectNodes === 'function') net.selectNodes([peer], false);
              if (net && typeof net.focus === 'function') net.focus(peer, { scale: Math.max(0.3, Math.min(net.getScale(), 1)), locked: false, animation: { duration: 350 } });
            });
          }(peers[shown]));
        }
        next.hidden = shown >= peers.length;
      }
      next.addEventListener('click', appendPeers);
      appendPeers();
    }
    panel.hidden = false;
    applyNodeFocus();
  }

  function bindNodeDetails() {
    var net = getNetwork();
    if (!net || nodeDetailsBound) return;
    nodeDetailsBound = true;
    net.on('click', function (params) {
      if (params.nodes && params.nodes.length) showNodeDetails(params.nodes[0]);
      else closeNodeDetails();
    });
  }

  function graphEdgeTitle(edge) {
    if (i18n && i18n.formatGiftCount) return i18n.formatGiftCount(edge.count || 0, !!edge.mutual);
    return edge.title || '';
  }

  function syncToolbarText() {
    var title = document.querySelector('#giftgraph-toolbar .tb-title');
    if (title && i18n && i18n.formatGraphLabel) {
      title.textContent = i18n.formatGraphLabel(title.textContent);
    }
    var meta = document.querySelector('#giftgraph-toolbar .tb-meta[data-gg-nodes]');
    if (meta && i18n && i18n.formatToolbarMeta) {
      meta.textContent = i18n.formatToolbarMeta(
        meta.getAttribute('data-gg-nodes') || 0,
        meta.getAttribute('data-gg-edges') || 0,
        meta.getAttribute('data-gg-path-length') || 0
      );
    }
  }

  function syncNativeGraphText() {
    var meta = getGraphMeta();
    var subtitle = document.getElementById('giftgraph-subtitle');
    if (subtitle && meta && meta.summary && i18n && i18n.formatNumberUnit) {
      var subtitleText = i18n.formatNumberUnit('node', meta.summary.nodes || 0) + ' · ' +
        i18n.formatNumberUnit('edge', meta.summary.edges || 0);
      if (subtitle.innerHTML !== subtitleText) subtitle.innerHTML = subtitleText;
    }
    document.querySelectorAll('.giftgraph-pill').forEach(function (pill) {
      var dot = pill.querySelector('.giftgraph-dot');
      if (!dot) return;
      var kind = dot.getAttribute('data-kind');
      var label = kind === 'start' ? 'Старт' : kind === 'regular' ? 'Обычный узел' : kind === 'anonymous' ? 'Анонимный' : kind === 'bot' ? 'Бот' : '';
      var text = i18n && i18n.translateString ? i18n.translateString(label, currentLanguage()) : label;
      var textNodes = Array.prototype.slice.call(pill.childNodes).filter(function (node) {
        return node.nodeType === Node.TEXT_NODE;
      });
      // This also runs from MutationObserver: identical labels must not mutate DOM.
      if (textNodes.map(function (node) { return node.nodeValue; }).join('').trim() !== text) {
        textNodes.forEach(function (node) { pill.removeChild(node); });
        pill.appendChild(document.createTextNode(text));
      }
    });
    var hint = document.getElementById('giftgraph-hint');
    if (hint && i18n && i18n.translateString) {
      var hintText = i18n.translateString('Колесо: масштаб · drag: панорама и узлы', currentLanguage());
      if (hint.textContent !== hintText) hint.textContent = hintText;
    }
  }

  function syncLanguage() {
    if (i18n && i18n.translate) i18n.translate(document);
    syncToolbarText();
    syncNativeGraphText();
  }

  function deleteUrl(gid, source) {
    return (source && source.getAttribute('data-delete-url')) || ('/api/graphs/' + gid);
  }

  function currentGraphColors() {
    var palette = cleanPalette(root.getAttribute('data-gg-palette') || 'ember');
    var mode = cleanMode(root.getAttribute('data-gg-mode') || 'light');
    var colors = Object.assign({}, graphPalettes[palette][mode] || graphPalettes.ember.dark);
    var custom = getThemeCustom();
    if (custom.accent) {
      colors.path = custom.accent;
      colors.edgePath = custom.accent;
    }
    if (custom.accent2) colors.regular = custom.accent2;
    if (custom.accent3) colors.bot = custom.accent3;
    return colors;
  }

  function nodeFill(info, colors) {
    if (!info) return colors.regular;
    if (info.kind === 'start') return colors.start;
    if (info.kind === 'path') return colors.path;
    if (info.kind === 'anonymous' || info.anonymous) return colors.anonymous;
    if (info.kind === 'bot' || info.is_bot) return colors.bot;
    if (info.kind === 'promo' || info.is_promo) return colors.promo || colors.path;
    return colors.regular;
  }

  function nodeFontSize(info, fallback) {
    var size = Number(fallback) || (!info ? 13 : info.kind === 'start' ? 17 :
      ['anonymous', 'bot', 'promo'].indexOf(info.kind) !== -1 ? 10 : 13);
    return Math.round(size * 1.45);
  }

  function nodeShape(info) {
    return 'dot';
  }

  function nodeBorder(info, colors) {
    if (!info) return colors.regular;
    if (info.kind === 'start') return colors.font;
    if (info.kind === 'path') return colors.path;
    if (info.kind === 'anonymous' || info.anonymous) return colors.anonymous;
    if (info.kind === 'bot' || info.is_bot) return colors.bot;
    if (info.kind === 'promo' || info.is_promo) return colors.promo || colors.path;
    return colors.regular;
  }

  function legendColor(kind, colors) {
    if (kind === 'start') return colors.font;
    if (kind === 'path') return colors.path;
    if (kind === 'anonymous') return colors.anonymous;
    if (kind === 'bot') return colors.bot;
    if (kind === 'promo') return colors.promo || colors.path;
    return colors.regular;
  }

  function captureGraphBase() {
    var net = getNetwork();
    if (!net || !net.body || !net.body.data) return false;

    if (!graphBase.nodes) {
      graphBase.nodes = {};
      net.body.data.nodes.get().forEach(function (node) {
        var font = node.font && typeof node.font === 'object' ? node.font : {};
        graphBase.nodes[node.id] = {
          size: Number(node.size) || 20,
          fontSize: Number(font.size) || 13,
          font: Object.assign({}, font)
        };
      });
    }

    if (!graphBase.edges) {
      graphBase.edges = {};
      net.body.data.edges.get().forEach(function (edge) {
        graphBase.edges[edge.id] = {
          width: Number(edge.width) || 1.5
        };
      });
    }

    return true;
  }

  function applyNetworkTheme() {
    var net = getNetwork();
    if (!net || !net.body || !net.body.data) return;
    captureGraphBase();

    var meta = getGraphMeta();
    var colors = currentGraphColors();

    if (meta && meta.nodes) {
      var nodeUpdates = Object.keys(meta.nodes).map(function (id) {
        var info = meta.nodes[id] || {};
        var base = graphBase.nodes && graphBase.nodes[id] ? graphBase.nodes[id] : {};
        var fill = nodeFill(info, colors);
        var font = Object.assign({}, base.font || {}, {
          color: colors.font,
          size: nodeFontSize(info, base.fontSize),
          bold: info.kind === 'start'
        });
        return {
          id: id,
          shape: nodeShape(info),
          borderWidth: info.kind === 'start' ? 3 : 2,
          color: {
            background: fill,
            border: nodeBorder(info, colors)
          },
          font: font,
          title: graphNodeTitle(id, info)
        };
      });
      if (nodeUpdates.length) net.body.data.nodes.update(nodeUpdates);
    }

    if (meta && Array.isArray(meta.edges)) {
      var edgeUpdates = meta.edges.map(function (edge) {
        var color = edge.on_path ? colors.edgePath : colors.edge;
        return {
          id: edge.id,
          color: {
            color: color,
            highlight: colors.accent || colors.regular,
            hover: colors.accent2 || colors.path,
            opacity: 0.86
          },
          title: graphEdgeTitle(edge)
        };
      });
      if (edgeUpdates.length) net.body.data.edges.update(edgeUpdates);
    }

    document.querySelectorAll('.giftgraph-dot').forEach(function (dot) {
      var kind = dot.getAttribute('data-kind');
      var fill = nodeFill({ kind: kind }, colors);
      var pill = dot.closest ? dot.closest('.giftgraph-pill') : null;
      dot.style.background = fill;
      if (pill) {
        pill.setAttribute('data-kind', kind || 'regular');
        pill.style.setProperty('border-color', rgba(legendColor(kind, colors), 0.58), 'important');
        pill.style.setProperty('box-shadow', 'inset 0 0 0 1px ' + rgba(legendColor(kind, colors), 0.16), 'important');
      }
    });
    applyNodeFocus();
  }

  function controlNumber(id, fallback) {
    var input = document.getElementById(id);
    var value = input ? parseFloat(input.value) : NaN;
    return Number.isFinite(value) ? value : fallback;
  }

  function setControlLabel(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  window.giftgraphNotify = function (msg, isError) {
    var toast = document.getElementById('gg-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'gg-toast';
      toast.className = 'gg-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = 'gg-toast show' + (isError ? ' error' : '');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { toast.className = 'gg-toast'; }, 2500);
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
          '<p class="gg-confirm-kicker">' + (options.kicker || 'подтверждение') + '</p>' +
          '<h2 class="gg-confirm-title">' + (options.title || 'Подтвердить действие?') + '</h2>' +
          '<p class="gg-confirm-text">' + (options.text || 'Это действие нельзя будет быстро отменить.') + '</p>' +
          '<div class="gg-confirm-actions">' +
            '<button class="gg-confirm-cancel" type="button" data-confirm="cancel">' + (options.cancel || 'Отмена') + '</button>' +
            '<button class="gg-confirm-danger" type="button" data-confirm="ok">' + (options.ok || 'Удалить') + '</button>' +
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

  window.deleteGraphFromToolbar = async function (button) {
    if (!button) return;
    var confirmed = await askConfirm({
      kicker: tr('confirmKicker', 'удаление графа'),
      title: tr('confirmTitle', 'Удалить этот граф?'),
      text: tr('confirmText', 'Граф исчезнет из архива и больше не будет открываться по старой ссылке.'),
      ok: tr('confirmOk', 'Удалить'),
      cancel: tr('confirmCancel', 'Оставить')
    });
    if (!confirmed) return;

    var gid = button.getAttribute('data-gid') || '';
    var token = button.getAttribute('data-delete-token') || '';
    var headers = token ? { 'X-GiftGraph-Delete-Token': token } : {};
    button.disabled = true;
    fetch(deleteUrl(gid, button), { method: 'DELETE', headers: headers }).then(function (response) {
      if (response.ok) {
        window.location.href = '/';
        return;
      }
      window.giftgraphNotify(tr('deleteFailed', 'Не удалось удалить граф'), true);
      button.disabled = false;
    }).catch(function () {
      window.giftgraphNotify(tr('deleteNetworkError', 'Ошибка сети при удалении'), true);
      button.disabled = false;
    });
  };

  function saveGraphControlSettings() {
    try {
      localStorage.setItem('giftgraph-node-scale', String(controlNumber('gg-node-scale', 1)));
      localStorage.setItem('giftgraph-edge-scale', String(controlNumber('gg-edge-scale', 1)));
      localStorage.setItem('giftgraph-spring-length', String(controlNumber('gg-spring-length', 300)));
      localStorage.setItem('giftgraph-grid-enabled', document.getElementById('gg-grid-toggle') && document.getElementById('gg-grid-toggle').checked ? '1' : '0');
      localStorage.setItem('giftgraph-grid-strength', String(controlNumber('gg-grid-strength', 1)));
    } catch (e) {}
  }

  function applyGraphControls(skipSave) {
    var net = getNetwork();
    var nodeScale = controlNumber('gg-node-scale', 1);
    var edgeScale = controlNumber('gg-edge-scale', 1);
    var spring = Math.round(controlNumber('gg-spring-length', 300));
    var gridStrength = controlNumber('gg-grid-strength', 1);

    setControlLabel('gg-node-scale-value', nodeScale.toFixed(2));
    setControlLabel('gg-edge-scale-value', edgeScale.toFixed(2));
    setControlLabel('gg-spring-value', String(spring));
    setControlLabel('gg-grid-value', gridStrength.toFixed(2));
    if (!skipSave) saveGraphControlSettings();

    if (!net || !net.body || !net.body.data || !captureGraphBase()) return;

    var meta = getGraphMeta();
    var colors = currentGraphColors();
    var nodeUpdates = Object.keys(graphBase.nodes || {}).map(function (id) {
      var base = graphBase.nodes[id];
      var info = meta && meta.nodes ? meta.nodes[id] : null;
      var font = Object.assign({}, base.font || {}, {
        color: colors.font,
        size: Math.round(clamp(nodeFontSize(info, base.fontSize) * clamp(nodeScale, 0.7, 1.55), 12, 36))
      });
      return {
        id: id,
        size: clamp(base.size * nodeScale, 6, 78),
        font: font
      };
    });
    if (nodeUpdates.length) net.body.data.nodes.update(nodeUpdates);

    var edgeUpdates = Object.keys(graphBase.edges || {}).map(function (id) {
      var base = graphBase.edges[id];
      return {
        id: id,
        width: clamp(base.width * edgeScale, 0.6, 22)
      };
    });
    if (edgeUpdates.length) net.body.data.edges.update(edgeUpdates);

    try {
      net.setOptions({
        physics: {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: { springLength: spring }
        }
      });
    } catch (e) {}

    if (typeof net.redraw === 'function') net.redraw();
  }

  function readSavedControl(id, key) {
    var input = document.getElementById(id);
    if (!input) return;
    try {
      var value = localStorage.getItem(key);
      if (value !== null && value !== '') input.value = value;
    } catch (e) {}
  }

  function loadGraphControlSettings() {
    // Upgrade the previous default once; retain custom spacing and future edits.
    try {
      if (!localStorage.getItem('giftgraph-layout-v2')) {
        if (localStorage.getItem('giftgraph-spring-length') === '350') {
          localStorage.setItem('giftgraph-spring-length', '300');
        }
        localStorage.setItem('giftgraph-layout-v2', '1');
      }
    } catch (e) {}
    readSavedControl('gg-node-scale', 'giftgraph-node-scale');
    readSavedControl('gg-edge-scale', 'giftgraph-edge-scale');
    readSavedControl('gg-spring-length', 'giftgraph-spring-length');
    readSavedControl('gg-grid-strength', 'giftgraph-grid-strength');
    try {
      var grid = document.getElementById('gg-grid-toggle');
      var saved = localStorage.getItem('giftgraph-grid-enabled');
      if (grid && saved !== null) grid.checked = saved === '1';
    } catch (e) {}
  }

  function bindSettingsControls() {
    if (i18n && i18n.bindLanguageControls) i18n.bindLanguageControls(document);
    loadGraphControlSettings();
    ['gg-node-scale', 'gg-edge-scale', 'gg-spring-length', 'gg-grid-strength'].forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input', function () { applyGraphControls(false); });
      input.addEventListener('change', function () { applyGraphControls(false); });
    });

    var gridToggle = document.getElementById('gg-grid-toggle');
    if (gridToggle) {
      gridToggle.addEventListener('change', function () {
        saveGraphControlSettings();
        var net = getNetwork();
        if (net && typeof net.redraw === 'function') net.redraw();
      });
    }

    document.querySelectorAll('[data-gg-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        var action = button.getAttribute('data-gg-action');
        var net = getNetwork();
        if (!net) return;
        if (action === 'fit' && typeof net.fit === 'function') {
          net.fit({ animation: { duration: 420, easingFunction: 'easeInOutQuad' } });
        }
        if (action === 'stabilize') {
          try {
            net.startSimulation();
            net.stabilize(180);
          } catch (e) {}
        }
      });
    });

    document.querySelectorAll('[data-gg-theme-color]').forEach(function (input) {
      input.addEventListener('input', function () {
        var key = input.getAttribute('data-gg-theme-color');
        var payload = {};
        payload[key] = input.value;
        saveThemeCustom(payload);
        applyCustomColors();
        applyNetworkTheme();
        resetAmbient();
      });
    });

    var colorReset = document.getElementById('gg-theme-color-reset');
    if (colorReset) {
      colorReset.addEventListener('click', function () {
        clearThemeCustom();
        applyCustomColors();
        syncThemeColorInputs();
        applyNetworkTheme();
        resetAmbient();
      });
    }

    applyGraphControls(true);
  }

  function bindWorldGrid() {
    var net = getNetwork();
    if (!net || !net.on || worldGridBound) return;
    worldGridBound = true;
    net.on('beforeDrawing', function (drawCtx) {
      var toggle = document.getElementById('gg-grid-toggle');
      if (toggle && !toggle.checked) return;

      var scale = net.getScale ? net.getScale() : 1;
      if (!Number.isFinite(scale) || scale <= 0) return;
      var strength = controlNumber('gg-grid-strength', 1);
      if (strength <= 0.01) return;

      var rect = net.body && net.body.container ? net.body.container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
      var topLeft = net.DOMtoCanvas({ x: 0, y: 0 });
      var bottomRight = net.DOMtoCanvas({ x: rect.width, y: rect.height });
      var left = Math.min(topLeft.x, bottomRight.x);
      var right = Math.max(topLeft.x, bottomRight.x);
      var top = Math.min(topLeft.y, bottomRight.y);
      var bottom = Math.max(topLeft.y, bottomRight.y);
      // Keep the grid sparse when viewing a large graph from far away.
      var major = 320 * Math.max(1, Math.pow(2, Math.ceil(Math.log2(0.08 / scale))));
      var minor = major / 2;
      var minorAlpha = clamp((scale - 0.72) / 0.82, 0, 1);

      function strokeGrid(cell, color, alpha, width) {
        var x;
        var y;
        drawCtx.save();
        drawCtx.beginPath();
        for (x = Math.floor(left / cell) * cell; x <= right + cell; x += cell) {
          drawCtx.moveTo(x, top - cell);
          drawCtx.lineTo(x, bottom + cell);
        }
        for (y = Math.floor(top / cell) * cell; y <= bottom + cell; y += cell) {
          drawCtx.moveTo(left - cell, y);
          drawCtx.lineTo(right + cell, y);
        }
        drawCtx.strokeStyle = color;
        drawCtx.globalAlpha = alpha;
        drawCtx.lineWidth = width;
        drawCtx.stroke();
        drawCtx.restore();
      }

      strokeGrid(minor, css('--gg-subgrid') || 'rgba(255,255,255,0.035)', minorAlpha * strength, Math.max(0.42 / scale, 0.12));
      strokeGrid(major, css('--gg-grid') || 'rgba(255,255,255,0.07)', 0.85 * strength, Math.max(0.72 / scale, 0.18));
    });
  }

  function bindZoomLimit() {
    var net = getNetwork();
    if (!net || !net.on || zoomLimitBound) return;
    zoomLimitBound = true;

    net.on('zoom', function () {
      if (!net.getScale || !net.moveTo) return;
      var scale = net.getScale();
      if (scale >= minZoomScale) return;

      try {
        net.moveTo({
          position: net.getViewPosition ? net.getViewPosition() : undefined,
          scale: minZoomScale,
          animation: false
        });
      } catch (e) {}
    });
  }

  function formatAutoDelete(ms) {
    if (i18n && i18n.formatAutoDelete) return i18n.formatAutoDelete(ms);
    if (ms <= 0) return 'Удаляю граф';
    var minutes = Math.ceil(ms / 60000);
    if (minutes < 60) return 'Удаление через ' + minutes + ' мин.';
    var hours = Math.ceil(minutes / 60);
    if (hours < 48) return 'Удаление через ' + hours + ' ч.';
    return 'Удаление через ' + Math.ceil(hours / 24) + ' дн.';
  }

  function bindAutoDelete() {
    var deleteButton = document.querySelector('[data-gid]');
    var status = document.getElementById('gg-auto-delete-status');
    var buttons = Array.from(document.querySelectorAll('[data-gg-autodelete]'));
    if (!deleteButton || !status || !buttons.length) return;
    var gid = deleteButton.getAttribute('data-gid') || '';
    var key = 'giftgraph-auto-delete-' + gid;

    function setActive(minutes) {
      buttons.forEach(function (button) {
        button.classList.toggle('active', button.getAttribute('data-gg-autodelete') === String(minutes));
      });
    }

    function loadRecord() {
      try {
        var raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }

    function buildDefaultRecord() {
      var minutes = parseInt(getSaved(defaultAutoDeleteKey, '0'), 10) || 0;
      if ([60, 1440, 10080].indexOf(minutes) === -1) return null;
      var record = { minutes: minutes, deadline: Date.now() + minutes * 60000 };
      try { localStorage.setItem(key, JSON.stringify(record)); } catch (e) {}
      return record;
    }

    function clearRecord() {
      if (autoDeleteTimer) clearTimeout(autoDeleteTimer);
      autoDeleteTimer = 0;
      // Keep an explicit opt-out so the archive default is not reapplied on reload.
      try { localStorage.setItem(key, JSON.stringify({ minutes: 0, deadline: 0 })); } catch (e) {}
      setActive(0);
      status.textContent = tr('autoNotPlanned', 'Не запланировано');
    }

    function deleteGraphNow() {
      status.textContent = tr('autoDeleting', 'Удаляю граф');
      var token = deleteButton.getAttribute('data-delete-token') || '';
      var headers = token ? { 'X-GiftGraph-Delete-Token': token } : {};
      fetch(deleteUrl(gid, deleteButton), { method: 'DELETE', headers: headers }).then(function (response) {
        if (response.ok) {
          try { localStorage.removeItem(key); } catch (e) {}
          window.location.href = '/';
          return;
        }
        status.textContent = tr('autoDeleteFailed', 'Не удалось удалить автоматически');
      }).catch(function () {
        status.textContent = tr('autoDeleteFailed', 'Не удалось удалить автоматически');
      });
    }

    function schedule(record) {
      if (!record || !record.deadline) {
        clearRecord();
        return;
      }
      if (autoDeleteTimer) clearTimeout(autoDeleteTimer);
      var remaining = record.deadline - Date.now();
      setActive(record.minutes || 0);
      status.textContent = formatAutoDelete(remaining);
      if (remaining <= 0) {
        deleteGraphNow();
        return;
      }
      autoDeleteTimer = setTimeout(function () {
        schedule(record);
      }, Math.min(remaining, 60000));
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var minutes = parseInt(button.getAttribute('data-gg-autodelete') || '0', 10) || 0;
        if (!minutes) {
          clearRecord();
          return;
        }
        var record = { minutes: minutes, deadline: Date.now() + minutes * 60000 };
        try { localStorage.setItem(key, JSON.stringify(record)); } catch (e) {}
        schedule(record);
      });
    });

    schedule(loadRecord() || buildDefaultRecord());
  }

  function syncNativeTheme(mode) {
    var shell = document.getElementById('giftgraph-shell');
    if (shell) shell.setAttribute('data-theme', mode);
    try { localStorage.setItem('giftgraph-theme', mode); } catch (e) {}
  }

  function triggerNativeTheme(targetMode) {
    var nativeToggle = document.getElementById('giftgraph-theme-toggle');
    if (!nativeToggle || typeof nativeToggle.click !== 'function') return false;
    try {
      localStorage.setItem('giftgraph-theme', targetMode === 'light' ? 'dark' : 'light');
    } catch (e) {}
    nativeToggle.click();
    return true;
  }

  function applyTheme(palette, mode) {
    palette = cleanPalette(palette);
    mode = cleanMode(mode);
    root.setAttribute('data-gg-palette', palette);
    root.setAttribute('data-gg-mode', mode);
    root.setAttribute('data-theme', mode);
    save(storagePalette, palette);
    save(storageMode, mode);
    syncNativeTheme(mode);
    applyCustomColors();
    updateControls();
    resetAmbient();
    setTimeout(function () {
      applyNetworkTheme();
      applyGraphControls(true);
    }, 0);
  }

  function updateControls() {
    var palette = root.getAttribute('data-gg-palette') || 'ember';
    var mode = root.getAttribute('data-gg-mode') || 'light';
    document.querySelectorAll('[data-gg-mode-choice]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-gg-mode-choice') === mode);
    });
    document.querySelectorAll('[data-gg-palette-choice]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-gg-palette-choice') === palette);
    });
    syncThemeColorInputs();
  }

  function togglePanel(force) {
    var panel = document.getElementById('giftgraph-theme-panel');
    var btn = document.getElementById('giftgraph-settings-toggle');
    if (!panel || !btn) return;
    var open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function tidyOldChrome() {
    var mode = root.getAttribute('data-gg-mode') || 'light';
    syncNativeTheme(mode);
    var label = function (text) {
      return i18n && i18n.translateString ? i18n.translateString(text, currentLanguage()) : text;
    };
    var themeBtn = document.getElementById('giftgraph-theme-toggle') || document.getElementById('btn-toggle-theme');
    if (themeBtn) {
      var themeText = mode === 'dark' ? label('Светлая') : label('Темная');
      if (themeBtn.textContent !== themeText) themeBtn.textContent = themeText;
    }
    var settings = document.getElementById('btn-toggle-settings') || document.getElementById('btn-settings-toggle');
    if (settings && settings.textContent !== label('Настройки')) settings.textContent = label('Настройки');
    var shuffle = document.getElementById('btn-reshuffle');
    if (shuffle && shuffle.textContent !== label('Перемешать')) shuffle.textContent = label('Перемешать');
    var apply = document.getElementById('btn-apply') || document.getElementById('btn-apply-settings');
    if (apply && apply.textContent !== label('Применить')) apply.textContent = label('Применить');
    var box = document.getElementById('giftgraph-settings-box') || document.getElementById('gg-sbox');
    if (box) {
      var title = box.querySelector('div');
      if (title && /Настройки|Settings/.test(title.textContent || '') && title.textContent !== label('Настройки')) {
        title.textContent = label('Настройки');
      }
    }
    syncNativeGraphText();
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
    var count = Math.max(20, Math.min(56, Math.round(window.innerWidth / 27)));
    points = Array.from({ length: count }, function (_, index) {
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: index % 8 === 0 ? 2.4 : 1 + Math.random() * 1.4,
        a: Math.random() * Math.PI * 2,
        s: 0.07 + Math.random() * 0.22
      };
    });
  }

  function draw(time) {
    if (!canvas || !ctx) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    var accent = css('--gg-accent');
    var accent2 = css('--gg-accent-2');
    var accent3 = css('--gg-accent-3');
    ctx.clearRect(0, 0, w, h);

    for (var ring = 0; ring < 5; ring++) {
      var cx = w * (0.12 + ring * 0.2);
      var cy = h * (0.25 + (ring % 2) * 0.28);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.45 + ring * 0.14 + Math.sin(time * 0.0002) * 0.03);
      ctx.beginPath();
      ctx.ellipse(0, 0, 180 + ring * 32, 70 + ring * 12, 0, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(ring % 3 === 0 ? accent : ring % 3 === 1 ? accent2 : accent3, 0.10);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    points.forEach(function (p, index) {
      p.x += Math.cos(time * 0.00025 + p.a) * p.s;
      p.y += Math.sin(time * 0.00021 + p.a) * p.s;
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(index % 3 === 0 ? accent : index % 3 === 1 ? accent2 : accent3, 0.30);
      ctx.fill();
    });

    raf = requestAnimationFrame(draw);
  }

  function waitForNetworkBoot() {
    var attempts = 0;
    function boot() {
      var net = getNetwork();
      if (!net || !net.body || !net.body.data || !net.on) {
        attempts += 1;
        if (attempts < 120) setTimeout(boot, 100);
        return;
      }
      captureGraphBase();
      bindWorldGrid();
      bindZoomLimit();
      bindNodeDetails();
      applyNetworkTheme();
      applyGraphControls(true);
      try {
        net.once('stabilizationIterationsDone', function () {
          applyNetworkTheme();
          applyGraphControls(true);
        });
        net.once('stabilized', function () {
          applyNetworkTheme();
          applyGraphControls(true);
        });
      } catch (e) {}
    }
    boot();
  }

  document.addEventListener('click', function (event) {
    var settingsBtn = event.target.closest && event.target.closest('#giftgraph-settings-toggle');
    var closeBtn = event.target.closest && event.target.closest('#giftgraph-settings-close');
    var modeChoice = event.target.closest && event.target.closest('[data-gg-mode-choice]');
    var paletteChoice = event.target.closest && event.target.closest('[data-gg-palette-choice]');
    var panel = document.getElementById('giftgraph-theme-panel');

    if (settingsBtn) {
      togglePanel();
    } else if (closeBtn) {
      togglePanel(false);
    } else if (modeChoice) {
      var chosenMode = modeChoice.getAttribute('data-gg-mode-choice');
      triggerNativeTheme(chosenMode);
      applyTheme(root.getAttribute('data-gg-palette') || 'ember', chosenMode);
    } else if (paletteChoice) {
      applyTheme(paletteChoice.getAttribute('data-gg-palette-choice'), root.getAttribute('data-gg-mode') || 'light');
    } else if (panel && event.target === panel) {
      togglePanel(false);
    } else if (panel && panel.classList.contains('open') && !panel.contains(event.target)) {
      togglePanel(false);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { togglePanel(false); closeNodeDetails(); }
  });

  document.addEventListener('giftgraph:languagechange', function () {
    if (selectedDetailsNode !== null) showNodeDetails(selectedDetailsNode);
    syncLanguage();
    updateControls();
    applyNetworkTheme();
    applyGraphControls(true);
    tidyOldChrome();
  });

  applyTheme(getSaved(storagePalette, 'ember'), getSaved(storageMode, preferredMode()));
  if (i18n && i18n.init) i18n.init(document);
  syncLanguage();
  bindSettingsControls();
  bindAutoDelete();
  waitForNetworkBoot();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  tidyOldChrome();
  setTimeout(tidyOldChrome, 400);
  setTimeout(tidyOldChrome, 1300);
  if (window.MutationObserver && document.body) {
    new MutationObserver(tidyOldChrome).observe(document.body, { childList:true, subtree:true, characterData:true });
  }
  if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    raf = requestAnimationFrame(draw);
  } else {
    draw(0);
    cancelAnimationFrame(raf);
  }
})();
