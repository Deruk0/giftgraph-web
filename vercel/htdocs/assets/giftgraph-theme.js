(function () {
  // Apply stored preferences before the stylesheet can paint either page.
  var root = document.documentElement;
  var palette = 'ember';
  var mode = 'light';
  try {
    palette = localStorage.getItem('giftgraph-palette') || palette;
    mode = localStorage.getItem('giftgraph-mode') || mode;
  } catch (error) {}
  var aliases = { violet: 'ember', plum: 'reef', moss: 'iris', mono: 'graphite' };
  palette = aliases[palette] || palette;
  if (['ember', 'reef', 'iris', 'graphite'].indexOf(palette) < 0) palette = 'ember';
  if (mode !== 'dark') mode = 'light';
  root.dataset.theme = mode;
  root.dataset.mode = mode;
  root.dataset.ggMode = mode;
  root.dataset.palette = palette;
  root.dataset.ggPalette = palette;
})();
