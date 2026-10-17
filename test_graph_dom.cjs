const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('native theme click keeps settings open while an actual outside click closes them', () => {
  const source = fs.readFileSync(__dirname + '/htdocs/assets/giftgraph-graph.js', 'utf8');
  const start = source.indexOf("  document.addEventListener('click', function (event) {");
  const handler = source.slice(start, source.indexOf("  document.addEventListener('keydown'", start));
  let click;
  let open = true;
  const panel = { classList: { contains: () => open }, contains: () => false };
  const context = vm.createContext({
    document: { addEventListener: (_, fn) => { click = fn; }, getElementById: () => panel },
    togglePanel: value => { open = value; },
    triggerNativeTheme() { click({ target: { closest: selector => selector === '#giftgraph-theme-toggle' ? {} : null } }); },
    applyTheme() {}, root: { getAttribute: () => 'ember' }
  });
  vm.runInContext(handler, context);
  click({ target: { closest: selector => selector === '[data-gg-mode-choice]' ? { getAttribute: () => 'dark' } : null } });
  assert.equal(open, true);
  click({ target: { closest: () => null } });
  assert.equal(open, false);
});

test('camera can zoom out to 2 percent while retaining a lower limit', () => {
  const source = fs.readFileSync(__dirname + '/htdocs/assets/giftgraph-graph.js', 'utf8');
  const binding = source.slice(source.indexOf('  function bindZoomLimit()'), source.indexOf('  function formatAutoDelete('));
  let onZoom;
  let scale = 0.05;
  const moves = [];
  const net = {
    on: (event, callback) => { onZoom = callback; },
    getScale: () => scale,
    getViewPosition: () => ({ x: 30, y: 40 }),
    moveTo: options => moves.push(options)
  };
  const context = vm.createContext({ getNetwork: () => net, zoomLimitBound: false });
  vm.runInContext(source.match(/  var minZoomScale = [^;]+;/)[0] + binding + 'bindZoomLimit();', context);
  onZoom();
  assert.equal(moves.length, 0, '5 percent should no longer be clamped');
  scale = 0.01;
  onZoom();
  assert.equal(moves[0].scale, 0.02);
  assert.equal(moves[0].position.x, 30);
});

test('graph label synchronization settles instead of retriggering its observer', () => {
  const source = fs.readFileSync(__dirname + '/htdocs/assets/giftgraph-graph.js', 'utf8');
  const sync = source.slice(source.indexOf('  function syncNativeGraphText()'), source.indexOf('  function syncLanguage()'));
  let mutations = 0;
  let subtitle = '';
  let hint = '';
  const pill = {
    childNodes: [{ nodeType: 3, nodeValue: 'Old label' }],
    querySelector: () => ({ getAttribute: () => 'start' }),
    appendChild(node) { mutations++; this.childNodes.push(node); },
    removeChild(node) { mutations++; this.childNodes.splice(this.childNodes.indexOf(node), 1); }
  };
  const elements = {
    'giftgraph-subtitle': {
      get innerHTML() { return subtitle; },
      set innerHTML(value) { mutations++; subtitle = value; }
    },
    'giftgraph-hint': {
      get textContent() { return hint; },
      set textContent(value) { mutations++; hint = value; }
    }
  };
  const context = vm.createContext({
    Node: { TEXT_NODE: 3 },
    document: {
      getElementById: id => elements[id],
      querySelectorAll: () => [pill],
      createTextNode: text => ({ nodeType: 3, nodeValue: text })
    },
    getGraphMeta: () => ({ summary: { nodes: 500, edges: 2367 } }),
    currentLanguage: () => 'ru',
    i18n: { formatNumberUnit: (unit, count) => `${count} ${unit}`, translateString: text => text }
  });
  vm.runInContext(sync, context);
  vm.runInContext('syncNativeGraphText()', context);
  assert.ok(mutations > 0, 'initial labels should change');
  mutations = 0;
  vm.runInContext('syncNativeGraphText()', context);
  assert.equal(mutations, 0, 'observer callback must not mutate already synchronized labels');
});

test('larger labels are derived from original font size without accumulating on theme or control changes', () => {
  const source = fs.readFileSync(__dirname + '/htdocs/assets/giftgraph-graph.js', 'utf8');
  const fontSize = source.slice(source.indexOf('  function nodeFontSize('), source.indexOf('  function nodeShape('));
  const controls = source.slice(source.indexOf('  function applyGraphControls('), source.indexOf('  function readSavedControl('));
  const updates = [];
  const context = vm.createContext({
    getNetwork: () => ({
      body: { data: { nodes: { update: data => updates.push(data) }, edges: { update() {} } } },
      setOptions() {}, redraw() {}
    }),
    graphBase: { nodes: { alice: { size: 20, fontSize: 13, font: { size: 13 } } }, edges: {} },
    getGraphMeta: () => ({ nodes: { alice: { kind: 'regular' } } }),
    currentGraphColors: () => ({ font: '#111111' }), captureGraphBase: () => true,
    controlNumber: (id, fallback) => fallback, setControlLabel() {}, saveGraphControlSettings() {},
    clamp: (value, min, max) => Math.max(min, Math.min(max, value))
  });
  vm.runInContext(fontSize + controls + 'applyGraphControls(true); applyGraphControls(true);', context);
  assert.equal(updates[0][0].font.size, 19);
  assert.equal(updates[1][0].font.size, 19);
  assert.equal(updates[0][0].size, 20, 'increasing labels must not enlarge graph dots');
});

test('spacing upgrade changes old default once and preserves custom and subsequent choices', () => {
  const source = fs.readFileSync(__dirname + '/htdocs/assets/giftgraph-graph.js', 'utf8');
  const settings = source.slice(source.indexOf('  function readSavedControl('), source.indexOf('  function bindSettingsControls('));
  function load(saved, upgraded) {
    const storage = new Map([['giftgraph-spring-length', saved]]);
    if (upgraded) storage.set('giftgraph-layout-v2', '1');
    const control = { value: '300' };
    const context = vm.createContext({
      document: { getElementById: id => id === 'gg-spring-length' ? control : null },
      localStorage: { getItem: key => storage.has(key) ? storage.get(key) : null, setItem: (key, value) => storage.set(key, value) }
    });
    vm.runInContext(settings + 'loadGraphControlSettings()', context);
    return control.value;
  }
  assert.equal(load('350'), '300');
  assert.equal(load('420'), '420');
  assert.equal(load('350', true), '350', 'a later deliberate spacing choice must survive reload');
});
