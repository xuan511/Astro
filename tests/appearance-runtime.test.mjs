import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import {
  parseDisplay,
  displayDefaults,
  displayBootstrap,
  sceneModes,
  postModes,
} from '../src/lib/layout-preferences.ts';

const script = stripTypeScriptTypes(
  readFileSync(new URL('../src/scripts/appearance.ts', import.meta.url), 'utf8'),
).replace(/^import[\s\S]*?from ['"][^'"]+['"];?\s*/gm, '');
function harness({ blocked = false, stored = null } = {}) {
  const listeners = new Map(),
    rootListeners = new Map(),
    windowListeners = new Map();
  const listen = (map, type, handler) => {
    if (!map.has(type)) map.set(type, []);
    map.get(type).push(handler);
  };
  const emit = (map, type, event = {}) => map.get(type)?.forEach((handler) => handler(event));
  class Element {
    dataset = {};
    attributes = new Map();
    hidden = false;
    value = '';
    textContent = '';
    constructor(data = {}, attributes = []) {
      this.dataset = data;
      attributes.forEach((name) => this.attributes.set(name, ''));
    }
    hasAttribute(name) {
      return this.attributes.has(name);
    }
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
    closest(selector) {
      return selector === 'button' ? this : null;
    }
  }
  class HTMLSelectElement extends Element {}
  const fonts = [
    { id: 'system', family: 'system-ui' },
    { id: 'book', family: 'MyBook, serif' },
  ];
  const config = { defaults: displayDefaults, fonts };
  const selects = ['sidebar', 'layout', 'wallpaper', 'font'].map(
    (name) => new HTMLSelectElement({ displaySelect: name }, ['data-display-select']),
  );
  const surface = new Element(),
    hue = new Element(),
    output = new Element();
  hue.addEventListener = (type, handler) => listen(rootListeners, 'hue:' + type, handler);
  const scenes = sceneModes.map((scene) => new Element({ sceneChoice: scene }));
  const layouts = postModes.map((layout) => new Element({ layoutChoice: layout }));
  const open = new Element({}, ['data-appearance-open']);
  const root = {
    querySelector: (selector) =>
      selector === '[data-display-config]'
        ? { textContent: JSON.stringify(config) }
        : selector === 'dialog'
          ? {}
          : selector === '[data-appearance-solid]'
            ? surface
            : selector === '[data-display-hue]'
              ? hue
              : null,
    querySelectorAll: (selector) => (selector === '[data-hue-label]' ? [output] : selects),
    addEventListener: (type, handler) => listen(rootListeners, type, handler),
  };
  const html = () => ({
    dataset: {},
    style: {
      values: new Map(),
      setProperty(name, value) {
        this.values.set(name, value);
      },
    },
  });
  const controls = new Element();
  let opens = 0,
    closes = 0;
  const document = {
    body: { dataset: { base: '/Astro/' } },
    documentElement: html(),
    querySelector: () => root,
    querySelectorAll: (selector) =>
      ({
        '[data-scene-choice]': scenes,
        '[data-layout-choice]': layouts,
        '[data-appearance-open]': [open],
        '[data-layout-controls]': [controls],
      })[selector] || [],
    addEventListener: (type, handler) => listen(listeners, type, handler),
    dispatchEvent: (event) => emit(listeners, event.type, event),
  };
  const writes = [];
  const context = {
    document,
    window: { addEventListener: (type, handler) => listen(windowListeners, type, handler) },
    Element,
    HTMLSelectElement,
    Event: class {
      constructor(type) {
        this.type = type;
      }
    },
    parseDisplay,
    sceneModes,
    postModes,
    createDialogController: () => ({ supported: true, open: () => opens++, close: () => closes++ }),
    localStorage: {
      getItem: () => {
        if (blocked) throw Error('blocked');
        return stored;
      },
      setItem: (key, value) => {
        if (blocked) throw Error('blocked');
        writes.push({ key, value });
      },
    },
  };
  runInNewContext(script, context);
  return {
    get state() {
      return { ...document.documentElement.dataset };
    },
    writes,
    get hue() {
      return document.documentElement.style.values.get('--theme-hue');
    },
    get selected() {
      return Object.fromEntries(
        selects.map((select) => [select.dataset.displaySelect, select.value]),
      );
    },
    get dialog() {
      return { opens, closes };
    },
    change(name, value) {
      const target = selects.find((select) => select.dataset.displaySelect === name);
      target.value = value;
      emit(rootListeners, 'change', { target });
    },
    click(attribute) {
      emit(listeners, 'click', { target: new Element({}, [attribute]) });
    },
    layout(value) {
      emit(listeners, 'click', {
        target: layouts.find((button) => button.dataset.layoutChoice === value),
      });
    },
    color(value) {
      hue.value = String(value);
      emit(rootListeners, 'hue:input');
    },
    navigate() {
      emit(listeners, 'astro:before-swap');
      document.documentElement = html();
      runInNewContext(
        displayBootstrap('shijian:/Astro/:appearance-v1', displayDefaults, fonts),
        context,
      );
      emit(listeners, 'astro:after-swap');
      emit(listeners, 'astro:page-load');
    },
    storage(value, key = 'shijian:/Astro/:appearance-v1') {
      emit(windowListeners, 'storage', { key, newValue: value });
    },
    get handlers() {
      return listeners.get('click').length;
    },
  };
}
test('real appearance controller shares feed buttons and selectors, applies fonts and retains a session with blocked storage', () => {
  const app = harness({ blocked: true });
  app.change('sidebar', 'right');
  app.change('font', 'book');
  app.change('wallpaper', 'transparent');
  app.layout('masonry');
  app.color(359);
  for (let visit = 0; visit < 3; visit++) app.navigate();
  assert.deepEqual(app.state, {
    sidebar: 'right',
    layout: 'masonry',
    wallpaper: 'transparent',
    scene: 'coast',
    solid: 'false',
    font: 'book',
  });
  assert.deepEqual(app.selected, {
    sidebar: 'right',
    layout: 'masonry',
    wallpaper: 'transparent',
    font: 'book',
  });
  assert.equal(app.hue, '359');
  assert.equal(app.handlers, 1);
  assert.equal(app.writes.length, 0);
});
test('appearance reset restores configured defaults and other-tab updates pass through the same validator', () => {
  const app = harness({ stored: '{"scene":"mist","solid":true}' });
  assert.equal(app.state.scene, 'mist');
  app.change('layout', 'list');
  app.change('font', 'book');
  assert.equal(app.writes.at(-1).key, 'shijian:/Astro/:appearance-v1');
  app.storage('{"sidebar":"none","layout":"masonry","font":"invalid","hue":900}');
  assert.equal(app.state.sidebar, 'none');
  assert.equal(app.state.layout, 'masonry');
  assert.equal(app.state.font, 'system');
  assert.equal(app.hue, '359');
  app.storage('{"sidebar":"left"}', 'other-application');
  assert.equal(app.state.sidebar, 'none');
  app.click('data-display-reset');
  assert.equal(app.state.sidebar, 'both');
  assert.equal(app.state.layout, 'grid');
  assert.equal(app.state.scene, 'coast');
  assert.equal(app.hue, '205');
});
test('appearance controls use the dialog controller and close on client navigation', () => {
  const app = harness();
  app.click('data-appearance-open');
  assert.equal(app.dialog.opens, 1);
  app.click('data-appearance-close');
  assert.equal(app.dialog.closes, 1);
  app.click('data-appearance-open');
  app.navigate();
  assert.equal(app.dialog.closes, 2);
});
