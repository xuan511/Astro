import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

const script = stripTypeScriptTypes(
  readFileSync(new URL('../src/scripts/site.ts', import.meta.url), 'utf8'),
).replace(/^import ['"]\.\/theme['"];?\s*/m, '');

function harness() {
  const listeners = new Map();
  let directory;
  const document = {
    activeElement: null,
    body: { dataset: { base: '/Astro/' } },
    querySelector: () => directory,
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
  };
  class Element {
    constructor(owner, link = false) {
      this.owner = owner;
      this.link = link;
      this.focusCalls = 0;
    }
    closest(selector) {
      if (selector === '[data-site-directory]') return this.owner;
      if (selector === '.directory-panel a' && this.link) return this;
      return null;
    }
    focus() {
      document.activeElement = this;
      this.focusCalls++;
    }
  }
  function replace() {
    directory = {
      open: false,
      contains: (element) => element?.owner === directory,
      querySelector: () => directory.summary,
    };
    directory.summary = new Element(directory);
    directory.link = new Element(directory, true);
    return directory;
  }
  replace();
  runInNewContext(script, {
    document,
    Element,
    location: { hash: '' },
  });
  return {
    document,
    listeners,
    get directory() {
      return directory;
    },
    outside: new Element(null),
    replace,
    dispatch(type, event = {}) {
      for (const callback of listeners.get(type) || []) callback(event);
    },
  };
}

test('the disclosure keeps native summary toggling and closes on links or outside clicks', () => {
  const h = harness();
  h.directory.open = true;
  h.dispatch('click', { target: h.directory.summary });
  assert.equal(h.directory.open, true);
  h.dispatch('click', { target: h.directory.link });
  assert.equal(h.directory.open, false);
  h.directory.open = true;
  h.dispatch('click', { target: h.outside });
  assert.equal(h.directory.open, false);
});

test('Escape restores focus inside the disclosure; leaving it does not steal focus', () => {
  const h = harness();
  h.directory.open = true;
  h.document.activeElement = h.directory.link;
  h.dispatch('keydown', { key: 'Escape' });
  assert.equal(h.directory.open, false);
  assert.equal(h.document.activeElement, h.directory.summary);
  h.directory.open = true;
  h.document.activeElement = h.outside;
  h.dispatch('focusin', { target: h.outside });
  assert.equal(h.directory.open, false);
  assert.equal(h.document.activeElement, h.outside);
});

test('client navigation closes the old disclosure and the same handlers find its replacement', () => {
  const h = harness();
  h.directory.open = true;
  h.dispatch('astro:before-preparation');
  assert.equal(h.directory.open, false);
  h.replace().open = true;
  h.dispatch('astro:before-swap');
  assert.equal(h.directory.open, false);
  h.directory.open = true;
  h.dispatch('click', { target: h.directory.link });
  assert.equal(h.directory.open, false);
  for (const callbacks of h.listeners.values()) assert.equal(callbacks.length, 1);
});
