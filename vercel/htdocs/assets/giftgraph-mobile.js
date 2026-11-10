(function () {
  'use strict';
  var media = matchMedia('(max-width: 760px), (max-height: 500px) and (pointer: coarse)');
  var graph = !!document.getElementById('giftgraph-toolbar');
  var panel = document.getElementById(graph ? 'giftgraph-theme-panel' : 'theme-panel');
  var toggle = document.getElementById(graph ? 'giftgraph-settings-toggle' : 'settings-toggle');
  var close = document.getElementById(graph ? 'giftgraph-settings-close' : 'settings-close');
  var input = document.getElementById('graph-search');
  var previousFocus;
  var panelWasOpen = false;
  var bootTimer;
  var dock = document.createElement('nav');
  dock.className = 'mobile-dock liquid-glass-menu';
  dock.dataset.page = graph ? 'graph' : 'archive';
  dock.setAttribute('aria-label', 'Нижнее меню');
  var icons = {
    archive: '<rect x="4" y="4" width="16" height="5" rx="1.5"/><path d="M5 9v10h14V9M10 13h4"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    fit: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/><circle cx="12" cy="12" r="3"/>',
    copy: '<path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0) scale(.92)"/>'
  };
  var items = graph ? [['archive','Архив'],['fit','Весь граф'],['copy','Ссылка'],['settings','Настройки']]
    : [['archive','Графы'],['search','Поиск'],['settings','Настройки']];
  items.forEach(function (item) {
    var element = document.createElement(item[0] === 'archive' ? 'a' : 'button');
    if (element.tagName === 'A') element.href = graph ? '/' : '#archive';
    else element.type = 'button';
    element.className = 'dock-item';
    element.dataset.dockAction = item[0];
    if (item[0] === (graph ? 'fit' : 'archive')) {
      element.classList.add('active');
      element.setAttribute('aria-current', graph ? 'true' : 'page');
    }
    if (item[0] === 'settings') {
      element.setAttribute('aria-controls', panel.id);
      element.setAttribute('aria-expanded', 'false');
    }
    element.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[item[0]] + '</svg><span>' + item[1] + '</span>';
    dock.appendChild(element);
  });
  document.body.appendChild(dock);

  function fitGraph() {
    var net = window.network;
    var canvas = document.getElementById('mynetwork');
    if (!media.matches || !net || !net.body || !net.body.data || !canvas) return false;
    var ids = net.body.data.nodes.getIds();
    if (!ids.length || typeof net.getBoundingBox !== 'function') return false;
    var boxes = ids.map(function (id) { return net.getBoundingBox(id); });
    var left = Math.min.apply(null, boxes.map(function (box) { return box.left; }));
    var right = Math.max.apply(null, boxes.map(function (box) { return box.right; }));
    var top = Math.min.apply(null, boxes.map(function (box) { return box.top; }));
    var bottom = Math.max.apply(null, boxes.map(function (box) { return box.bottom; }));
    var frame = canvas.getBoundingClientRect();
    var upper = document.getElementById('giftgraph-toolbar').getBoundingClientRect().bottom + 20;
    var lower = dock.getBoundingClientRect().top - 20;
    if (lower <= upper || ![left,right,top,bottom].every(Number.isFinite)) return false;
    net.moveTo({
      position: { x: (left + right) / 2, y: (top + bottom) / 2 },
      scale: Math.max(.02, Math.min(1, (frame.width - 48) / Math.max(1, right - left), (lower - upper) / Math.max(1, bottom - top))),
      offset: { x: 0, y: (upper + lower) / 2 - (frame.top + frame.bottom) / 2 },
      animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 300, easingFunction: 'easeInOutQuad' }
    });
    return true;
  }
  window.GiftGraphMobile = { fitGraph: fitGraph };

  function active(action) {
    dock.querySelectorAll('.dock-item').forEach(function (item) {
      var selected = item.dataset.dockAction === action;
      item.classList.toggle('active', selected);
      if (selected) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
  }
  dock.addEventListener('click', function (event) {
    var item = event.target.closest('[data-dock-action]');
    if (!item) return;
    event.stopPropagation();
    var action = item.dataset.dockAction;
    if (action === 'archive' && graph) return;
    event.preventDefault();
    if (action === 'settings') { toggle.click(); return; }
    if (action === 'copy') { document.querySelector('#giftgraph-toolbar .tb-copy').click(); return; }
    if (action === 'fit') {
      var detailsClose = document.querySelector('#giftgraph-node-details:not([hidden]) .gg-node-close');
      if (detailsClose) detailsClose.click();
      fitGraph();
    } else if (input) {
      if (action === 'archive') { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); input.blur(); }
      document.getElementById('archive').scrollIntoView({ block: 'start', behavior: 'auto' });
      if (action === 'search') input.focus({ preventScroll: true });
    }
    active(action);
  });

  function syncPanel() {
    var open = panel.classList.contains('open');
    document.body.classList.toggle('sheet-open', open);
    dock.querySelector('[data-dock-action="settings"]').setAttribute('aria-expanded', String(open));
    if (open && !panelWasOpen) {
      previousFocus = document.activeElement;
      close.focus({ preventScroll: true });
    } else if (!open && panelWasOpen && previousFocus && previousFocus.isConnected) {
      previousFocus.focus({ preventScroll: true });
    }
    panelWasOpen = open;
  }
  var panelObserver = new MutationObserver(syncPanel);
  panelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
  syncPanel();
  var frame = panel.querySelector('.panel-frame,.tb-panel-frame');
  var handle = document.createElement('div');
  handle.className = 'sheet-handle';
  handle.setAttribute('aria-hidden', 'true');
  frame.prepend(handle);
  var swipe;
  frame.addEventListener('pointerdown', function (event) {
    if (!media.matches || event.pointerType !== 'touch' || event.target.closest('button,input,a')) return;
    if (!event.target.closest('.sheet-handle,.panel-head,.tb-panel-head')) return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  frame.addEventListener('pointerup', function (event) {
    if (swipe && swipe.id === event.pointerId && event.clientY - swipe.y > 70 && Math.abs(event.clientX - swipe.x) < 60) close.click();
    swipe = null;
  });
  frame.addEventListener('pointercancel', function () { swipe = null; });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Tab' || !panel.classList.contains('open')) return;
    var controls = Array.from(panel.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')).filter(function (element) { return !element.disabled && element.getClientRects().length; });
    var first = controls[0]; var last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  function keyboard() {
    var editable = document.activeElement && document.activeElement.matches('input[type="search"],input[type="text"],textarea');
    var viewport = window.visualViewport;
    document.body.classList.toggle('mobile-keyboard-open', !!(media.matches && editable && viewport && innerHeight - viewport.height > 150));
  }
  if (window.visualViewport) window.visualViewport.addEventListener('resize', keyboard);
  document.addEventListener('focusin', keyboard);
  document.addEventListener('focusout', function () { requestAnimationFrame(keyboard); });
  if (input) input.addEventListener('input', function () { active(input.value ? 'search' : 'archive'); });
  if (window.GiftGraphI18n) window.GiftGraphI18n.translate(dock);
  if (graph && media.matches) {
    var attempts = 0;
    bootTimer = setInterval(function () {
      if (fitGraph() || ++attempts >= 40) clearInterval(bootTimer);
    }, 120);
  }
  window.addEventListener('pagehide', function () { clearInterval(bootTimer); });
})();
