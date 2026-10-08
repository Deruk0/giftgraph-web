(function () {
  'use strict';
  var app = window.Telegram && window.Telegram.WebApp;
  if (!app || app.platform === 'unknown') return;

  var root = document.documentElement;
  root.dataset.telegram = 'true';
  // Preserve launch parameters on same-site navigation so each page can
  // initialize the Telegram SDK. This data is never treated as authorization.
  var launch = new URLSearchParams(window.location.hash.slice(1));
  var context = new URLSearchParams();
  launch.forEach(function (value, key) {
    if (key.indexOf('tgWebApp') === 0) context.set(key, value);
  });
  function appUrl(path) {
    var url = new URL(path, window.location.href);
    if (context.size && !url.hash) url.hash = context.toString();
    return url.href;
  }
  function viewport() {
    var height = Number(app.viewportStableHeight);
    if (height > 0) root.style.setProperty('--giftgraph-app-height', height + 'px');
  }
  function colors() {
    var css = getComputedStyle(root);
    var background = (css.getPropertyValue('--gg-page') || css.getPropertyValue('--page')).trim();
    if (/^#[0-9a-f]{6}$/i.test(background) && app.isVersionAtLeast('6.1')) {
      app.setHeaderColor(background);
      app.setBackgroundColor(background);
    }
  }
  function initialize() {
    app.expand();
    // Keep both archive scrolling and graph dragging inside the Mini App.
    if (app.isVersionAtLeast('7.7')) {
      app.disableVerticalSwipes();
    }
    viewport();
    colors();
    app.onEvent('viewportChanged', viewport);
    app.onEvent('themeChanged', colors);
    if (app.isVersionAtLeast('8.0')) {
      app.onEvent('fullscreenChanged', viewport);
      app.onEvent('safeAreaChanged', viewport);
      app.onEvent('contentSafeAreaChanged', viewport);
      app.onEvent('fullscreenFailed', function () { app.expand(); viewport(); });
    }
    new MutationObserver(colors).observe(root, {
      attributes: true,
      attributeFilter: ['data-mode', 'data-gg-mode', 'data-palette', 'data-gg-palette']
    });
    if (app.isVersionAtLeast('6.1')) {
      if (/^\/(view\/|view\.php)/.test(window.location.pathname)) {
        app.BackButton.show();
        app.BackButton.onClick(function () { window.location.href = appUrl('/'); });
      } else {
        app.BackButton.hide();
      }
    }
    document.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      var link = event.target.closest('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      var url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.hash) return;
      link.href = appUrl(url.href);
    });
    app.ready();
    if (app.isVersionAtLeast('8.0') && !app.isFullscreen && typeof app.requestFullscreen === 'function') {
      app.requestFullscreen();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
}());
