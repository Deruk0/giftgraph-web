const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/htdocs/assets/giftgraph-graph.js', 'utf8');
const feature = source.slice(source.indexOf('  function nodeDetailsText('), source.indexOf('  function graphEdgeTitle('));

function fixture(meta, networkOptions = {}, clipboard = { writeText: () => Promise.resolve() }) {
  const elements = {};
  function element() {
    return {
      children: [], attributes: {}, listeners: {}, hidden: false,
      appendChild(child) { this.children.push(child); if (child.id) elements[child.id] = child; },
      replaceChildren() { this.children = []; },
      setAttribute(name, value) { this.attributes[name] = value; },
      addEventListener(name, handler) { this.listeners[name] = handler; }
    };
  }
  const events = {};
  const context = vm.createContext({
    document: { createElement: element, getElementById: id => elements[id], body: element() },
    currentLanguage: () => 'ru', getGraphMeta: () => meta,
    getNetwork: () => Object.assign({ on(event, handler) { assert.equal(events[event], undefined); events[event] = handler; } }, networkOptions),
    navigator: { clipboard }, window: { giftgraphNotify() {} },
    nodeDetailsBound: false, selectedDetailsNode: null, minZoomScale: 0.02
  });
  vm.runInContext(feature, context);
  return { context, elements, events };
}

test('participant metrics count unique peers and merged mutual gifts once', () => {
  const { context } = fixture({ nodes: { alice: { label: '@alice', kind: 'start', is_bot: true } }, edges: [
    { from: 'alice', to: 'bob', count: 5, mutual: true },
    { from: 'charlie', to: 'alice', count: 2 },
    { from: 'alice', to: 'charlie', count: 3 }
  ] });
  const result = vm.runInContext("nodeDetailsData('alice', getGraphMeta())", context);
  assert.equal(result.connections, 2);
  assert.equal(result.gifts, 10);
  assert.equal(result.mutual, 1);
  assert.equal(result.type, 'bot', 'start role must not mask bot type');
  assert.equal(result.username, 'alice');
});

test('numeric IDs, anonymous nodes and invalid labels do not become profile links', () => {
  const { context } = fixture({ nodes: {
    id7861819283: { label: '@id7861819283', kind: 'bot' },
    anon: { label: '@alice', anonymous: true },
    evil: { label: '<img src=x onerror=alert(1)>' }
  }, edges: [] });
  for (const id of ['id7861819283', 'anon', 'evil']) {
    context.testId = id;
    assert.equal(vm.runInContext('nodeDetailsData(testId, getGraphMeta()).username', context), '');
  }
  assert.equal(vm.runInContext("nodeDetailsData('id7861819283', getGraphMeta()).identity", context), '7861819283');
  assert.equal(vm.runInContext("nodeDetailsData('missing', getGraphMeta())", context), null);
});

test('selection opens details, replaces stale content and closes on empty canvas or close button', () => {
  const label = '<b>Alice</b>';
  const { context, elements, events } = fixture({ nodes: {
    alice: { label, level: 0, kind: 'start' },
    robot: { label: '@robot', kind: 'bot' }
  }, edges: [{ from: 'alice', to: 'robot', count: 3 }] });
  vm.runInContext('bindNodeDetails(); bindNodeDetails();', context);
  assert.equal(elements['giftgraph-node-details'], undefined, 'no panel until selection');
  events.click({ nodes: ['alice'] });
  const panel = elements['giftgraph-node-details'];
  assert.equal(panel.hidden, false);
  assert.equal(panel.children[0].children[0].children[1].textContent, label, 'label is rendered as text');
  events.click({ nodes: ['robot'] });
  assert.equal(panel.children.length, 2, 'old content is replaced');
  assert.equal(panel.children[0].children[0].children[1].textContent, '@robot');
  panel.children[0].children[1].listeners.click();
  assert.equal(panel.hidden, true);
  events.click({ nodes: ['alice'] });
  events.click({ nodes: [] });
  assert.equal(panel.hidden, true);
  assert.equal(vm.runInContext('selectedDetailsNode', context), null);
});

test('snapshots without gift counts show unknown rather than zero', () => {
  const { context } = fixture({ nodes: { alice: { label: '@alice' } }, edges: [{ from: 'alice', to: 'bob' }] });
  assert.equal(vm.runInContext("nodeDetailsData('alice', getGraphMeta()).gifts", context), null);
});

test('selection dims unrelated nodes and edges, then restores opacity without losing colors or sizes', () => {
  function dataset(items) {
    return { get: () => items, update: changes => changes.forEach(change => Object.assign(items.find(item => item.id === change.id), change)) };
  }
  const nodes = [{ id: 'alice', size: 25 }, { id: 'bob', size: 15 }, { id: 'other', size: 20 }];
  const edges = [
    { id: 'ab', from: 'alice', to: 'bob', color: { color: '#123456', highlight: '#abcdef' } },
    { id: 'bo', from: 'bob', to: 'other', color: { color: '#987654' } }
  ];
  const fitCalls = [];
  const meta = { nodes: { alice: { label: '@alice' }, bob: { label: '@bobby' }, other: { label: '@other' } }, edges };
  const { context, events } = fixture(meta, { body: { data: { nodes: dataset(nodes), edges: dataset(edges) } }, fit: options => fitCalls.push(options) });
  vm.runInContext('bindNodeDetails()', context);
  events.click({ nodes: ['alice'] });
  assert.deepEqual(nodes.map(node => node.opacity), [1, 1, 0.2]);
  assert.equal(edges[0].color.opacity, 0.86);
  assert.equal(edges[1].color.opacity, 0.12);
  assert.equal(edges[0].color.highlight, '#abcdef');
  assert.equal(nodes[0].size, 25);
  vm.runInContext("focusNodeConnections('alice')", context);
  assert.deepEqual(Array.from(fitCalls[0].nodes), ['alice', 'bob'], 'fit must include only this participant and direct neighbors');
  events.click({ nodes: [] });
  assert.deepEqual(nodes.map(node => node.opacity), [1, 1, 1]);
  assert.equal(edges[1].color.opacity, 0.86);
  assert.equal(edges[1].color.color, '#987654');
});

test('neighbor list moves to its participant and clipboard copies username or numeric ID', async () => {
  const copied = [], focusCalls = [];
  const meta = { nodes: { alice: { label: '@alice' }, id_123: { label: 'Sender', anonymous: true } }, edges: [{ from: 'alice', to: 'id_123', count: 2 }] };
  const { context, elements, events } = fixture(meta, {
    selectNodes() {}, getScale: () => 0.5, focus: (id, options) => focusCalls.push({ id, options })
  }, { writeText: value => { copied.push(value); return Promise.resolve(); } });
  vm.runInContext('bindNodeDetails()', context);
  events.click({ nodes: ['alice'] });
  function descendants(element) { return [element].concat(element.children.flatMap(descendants)); }
  const panel = elements['giftgraph-node-details'];
  const actions = descendants(panel);
  actions.find(element => element.attributes['aria-label'] === 'Копировать ник').listeners.click();
  actions.find(element => element.className === 'gg-node-neighbor').listeners.click();
  assert.equal(vm.runInContext('selectedDetailsNode', context), 'id_123');
  assert.equal(focusCalls[0].id, 'id_123');
  descendants(panel).find(element => element.attributes['aria-label'] === 'Копировать ID').listeners.click();
  assert.deepEqual(copied, ['@alice', '123']);
  assert.equal(descendants(panel).some(element => element.attributes['aria-label'] === 'Открыть Telegram'), false);
});

test('show connections freezes movement and frames the group between toolbar and participant card', () => {
  const moves = [];
  let stopped = false;
  const { context, elements } = fixture({ nodes: { alice: {}, bob: {} }, edges: [{ from: 'alice', to: 'bob' }] }, {
    fit() { assert.fail('should use unobstructed viewport'); },
    stopSimulation() { stopped = true; }, moveTo: options => moves.push(options),
    getBoundingBox: id => id === 'alice' ? { left: -100, right: 0, top: 0, bottom: 100 } : { left: 300, right: 500, top: 400, bottom: 600 }
  });
  elements.mynetwork = { getBoundingClientRect: () => ({ top: 0, bottom: 844, width: 390 }) };
  elements['giftgraph-toolbar'] = { getBoundingClientRect: () => ({ bottom: 124 }) };
  elements['giftgraph-node-details'] = { hidden: false, getBoundingClientRect: () => ({ top: 691 }) };
  vm.runInContext("focusNodeConnections('alice')", context);
  assert.equal(stopped, true);
  assert.equal(moves[0].position.x, 200);
  assert.equal(moves[0].position.y, 300);
  assert.equal(moves[0].scale, 358 / 600);
  assert.equal(moves[0].offset.y, -14.5);
});
