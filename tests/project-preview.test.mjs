import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

// Execute the shipped controller; native focus trapping and rendering remain browser checks.
const script = stripTypeScriptTypes(
  readFileSync(new URL('../src/scripts/project-preview.ts', import.meta.url), 'utf8'),
).replace(/^export\s*\{\s*\};?\s*/m, '');

function harness({ supported = true } = {}) {
  class Element {
    listeners = new Map();
    attributes = new Map();
    hidden = true;
    isConnected = true;
    focusCalls = 0;
    addEventListener(type, listener, options) {
      const listeners = this.listeners.get(type) || new Set();
      this.listeners.set(type, listeners);
      listeners.add(listener);
      options?.signal?.addEventListener('abort', () => listeners.delete(listener));
    }
    emit(type, properties = {}) {
      this.listeners.get(type)?.forEach((listener) => listener({ target: this, ...properties }));
    }
    getAttribute(name) {
      return this.attributes.get(name);
    }
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
    focus() {
      this.focusCalls++;
    }
  }
  function card(id) {
    const button = new Element();
    button.setAttribute('aria-controls', id);
    button.setAttribute('aria-expanded', 'false');
    const close = new Element();
    const dialog = new Element();
    dialog.id = id;
    dialog.open = false;
    dialog.openCalls = 0;
    dialog.parentElement = { querySelector: () => button };
    dialog.querySelector = () => close;
    dialog.getBoundingClientRect = () => ({ left: 500, right: 1000, top: 0, bottom: 800 });
    dialog.showModal = supported
      ? () => {
          dialog.open = true;
          dialog.openCalls++;
        }
      : undefined;
    dialog.close = () => {
      if (!dialog.open) return;
      dialog.open = false;
      dialog.emit('close');
    };
    return { button, close, dialog };
  }
  let cards = [card('first'), card('second')];
  let anotherDialogOpen = false;
  const document = new Element();
  document.querySelectorAll = () => cards.map(({ dialog }) => dialog);
  document.querySelector = () =>
    anotherDialogOpen ? {} : cards.find(({ dialog }) => dialog.open)?.dialog || null;
  runInNewContext(script, { document, AbortController });
  return {
    get cards() {
      return cards;
    },
    document,
    setOtherDialog(open) {
      anotherDialogOpen = open;
    },
    replaceCards() {
      for (const { button } of cards) button.isConnected = false;
      cards = [card('next-page')];
    },
  };
}

test('project preview stays unavailable when the native dialog enhancement is unsupported', () => {
  const app = harness({ supported: false });
  for (const { button, dialog } of app.cards) {
    assert.equal(button.hidden, true);
    button.emit('click');
    assert.equal(dialog.open, false);
  }
});

test('previews respect other modals and closing restores the project trigger', () => {
  const app = harness();
  const [first, second] = app.cards;
  assert.equal(first.button.hidden, false);
  app.setOtherDialog(true);
  first.button.emit('click');
  assert.equal(first.dialog.open, false);
  app.setOtherDialog(false);
  first.button.emit('click');
  assert.equal(first.dialog.open, true);
  assert.equal(first.button.getAttribute('aria-expanded'), 'true');
  second.button.emit('click');
  assert.equal(second.dialog.open, false);
  first.close.emit('click');
  assert.equal(first.dialog.open, false);
  assert.equal(first.button.getAttribute('aria-expanded'), 'false');
  assert.equal(first.button.focusCalls, 1);
  second.button.emit('click');
  assert.equal(second.dialog.open, true);
});

test('only clicks outside the drawer bounds close the preview', () => {
  const { button, dialog } = harness().cards[0];
  button.emit('click');
  dialog.emit('click', { clientX: 600, clientY: 100 });
  assert.equal(dialog.open, true);
  dialog.emit('click', { clientX: 200, clientY: 100 });
  assert.equal(dialog.open, false);
  assert.equal(button.focusCalls, 1);
});

test('client navigation closes old previews, removes handlers, and initializes new cards once', () => {
  const app = harness();
  const old = app.cards[0];
  app.document.emit('astro:page-load');
  app.document.emit('astro:page-load');
  old.button.emit('click');
  assert.equal(old.dialog.openCalls, 1, 'reinitialization must not duplicate handlers');
  app.document.emit('astro:before-swap');
  assert.equal(old.dialog.open, false);
  assert.equal(old.button.hidden, true);
  assert.equal(old.button.getAttribute('aria-expanded'), 'false');
  assert.equal(old.button.focusCalls, 0, 'cleanup must not run the custom focus restoration');
  old.button.emit('click');
  assert.equal(old.dialog.openCalls, 1);
  app.replaceCards();
  app.document.emit('astro:page-load');
  const current = app.cards[0];
  assert.equal(current.button.hidden, false);
  current.button.emit('click');
  assert.equal(current.dialog.openCalls, 1);
  current.close.emit('click');
  assert.equal(current.button.focusCalls, 1);
});
