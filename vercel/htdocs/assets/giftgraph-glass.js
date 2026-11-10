(function () {
  'use strict';
  function discover() {
    document.body.classList.add('liquid-glass-backdrop');
    document.querySelectorAll('.topbar,.metrics,.graph-card,.search-shell,#giftgraph-toolbar,.panel-frame,.tb-panel-frame,.gg-confirm-card,#giftgraph-node-details').forEach(function (element) {
      element.classList.add('liquid-glass');
      if (element.matches('.panel-frame,.tb-panel-frame,.gg-confirm-card,#giftgraph-node-details')) element.classList.add('liquid-glass--modal');
    });
    document.querySelectorAll('.toast,.gg-toast').forEach(function (element) { element.classList.add('liquid-glass-menu'); });
  }
  function start() {
    discover();
    var observer = new MutationObserver(discover);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pagehide', function () { observer.disconnect(); }, { once: true });
  }
  window.addEventListener('pageshow', function (event) { if (event.persisted) start(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
