import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { themeState, themeBootstrap } from '../src/lib/theme-preferences.ts';

const script = stripTypeScriptTypes(
  readFileSync(new URL('../src/scripts/theme.ts', import.meta.url), 'utf8'),
).replace(/^import\s*\{\s*themeState\s*\}\s*from\s*['"][^'"]+['"];?\s*/m, '');

function harness({
  stored = null,
  defaultTheme = 'light',
  systemDark = false,
  blocked = false,
  writeBlocked = false,
} = {}) {
  class Element {
    attributes = new Map();
    closest(selector) {
      return selector === '[data-theme-toggle]' ? this : null;
    }
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
  }
  let button = new Element();
  const listeners = new Map();
  const mediaListeners = new Set();
  const media = {
    matches: systemDark,
    addEventListener(type, listener) {
      assert.equal(type, 'change');
      mediaListeners.add(listener);
    },
  };
  const document = {
    body: { dataset: { base: '/Astro/', defaultTheme } },
    documentElement: { dataset: { theme: 'light' } },
    querySelectorAll: () => [button],
    addEventListener(type, listener) {
      const handlers = listeners.get(type) || new Set();
      handlers.add(listener);
      listeners.set(type, handlers);
    },
  };
  const writes = [];
  const context = {
    document,
    Element,
    themeState,
    matchMedia(query) {
      assert.equal(query, '(prefers-color-scheme: dark)');
      return media;
    },
    localStorage: {
      getItem(key) {
        assert.equal(key, 'shijian:/Astro/:theme-v3');
        if (blocked) throw new Error('storage blocked');
        return stored;
      },
      setItem(key, value) {
        if (blocked || writeBlocked) throw new Error('storage blocked');
        writes.push({ key, value });
      },
    },
  };
  const bootstrap = () =>
    runInNewContext(themeBootstrap('shijian:/Astro/:theme-v3', defaultTheme), context);
  bootstrap();
  const initial = document.documentElement.dataset.theme;
  runInNewContext(script, context);
  const emit = (type, event) => listeners.get(type)?.forEach((listener) => listener(event));
  return {
    initial,
    writes,
    get theme() {
      return document.documentElement.dataset.theme;
    },
    get label() {
      return button.attributes.get('aria-label');
    },
    get changeListeners() {
      return mediaListeners.size;
    },
    get clickListeners() {
      return listeners.get('click').size;
    },
    toggle() {
      emit('click', { target: button });
    },
    navigate() {
      // A swapped HTML tree and freshly rendered controls must use session state.
      document.documentElement = { dataset: { theme: 'light' } };
      button = new Element();
      emit('astro:after-swap');
      bootstrap();
      emit('astro:page-load');
    },
    osTheme(dark) {
      media.matches = dark;
      mediaListeners.forEach((listener) => listener({ matches: dark }));
    },
  };
}

test('theme values are validated and the synchronous bootstrap uses the runtime decision', () => {
  for (const stored of [null, 'invalid', 'system', 'dark', 'light']) {
    for (const systemDark of [false, true]) {
      const expected = themeState(stored, 'system', systemDark).theme;
      const app = harness({ stored, defaultTheme: 'system', systemDark });
      assert.equal(app.initial, expected);
      assert.equal(app.theme, expected);
      app.navigate();
      assert.equal(app.theme, expected);
    }
  }
  assert.equal(themeState('invalid', 'invalid', true).theme, 'light');
});

test('a user theme choice survives client navigation when storage reads and writes fail', () => {
  const app = harness({ blocked: true });
  assert.equal(app.theme, 'light');
  app.toggle();
  assert.equal(app.theme, 'dark');
  for (let visit = 0; visit < 3; visit++) {
    app.navigate();
    assert.equal(app.theme, 'dark');
    assert.equal(app.label, '切换浅色模式');
  }
  assert.equal(app.changeListeners, 1);
  assert.equal(app.clickListeners, 1);
  app.toggle();
  assert.equal(app.theme, 'light', 'one click toggles once after repeated navigation');
});

test('system preference follows OS changes until the user chooses a fixed theme', () => {
  const app = harness({ stored: 'system' });
  app.osTheme(true);
  assert.equal(app.theme, 'dark');
  app.navigate();
  assert.equal(app.theme, 'dark');
  app.osTheme(false);
  assert.equal(app.theme, 'light');
  app.toggle();
  assert.equal(app.theme, 'dark');
  app.osTheme(true);
  app.osTheme(false);
  assert.equal(app.theme, 'dark');
  assert.deepEqual(app.writes, [{ key: 'shijian:/Astro/:theme-v3', value: 'dark' }]);
});

test('a repeated inline bootstrap cannot overwrite a choice after a failed storage write', () => {
  const app = harness({ stored: 'light', writeBlocked: true });
  app.toggle();
  app.navigate();
  assert.equal(app.theme, 'dark');
  app.navigate();
  assert.equal(app.theme, 'dark');
  assert.equal(app.writes.length, 0);
});

test('a blocked-storage system default still resolves before paint and reacts to the OS', () => {
  const app = harness({ blocked: true, defaultTheme: 'system', systemDark: true });
  assert.equal(app.initial, 'dark');
  assert.equal(app.theme, 'dark');
  app.osTheme(false);
  assert.equal(app.theme, 'light');
  app.toggle();
  app.osTheme(true);
  app.osTheme(false);
  app.navigate();
  assert.equal(app.theme, 'dark');
});
