import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

const source = stripTypeScriptTypes(
  readFileSync(new URL('../src/lib/dialog.ts', import.meta.url), 'utf8'),
).replace(/^export /gm, '');
function harness({ supported = true } = {}) {
  class Element {
    isConnected = true;
    focused = 0;
    focus() {
      this.focused++;
    }
  }
  const trigger = new Element();
  const input = new Element();
  const listeners = new Map();
  const pending = [];
  const dialog = new Element();
  dialog.open = false;
  dialog.addEventListener = (type, listener, options) => {
    const handlers = listeners.get(type) || new Set();
    listeners.set(type, handlers);
    handlers.add(listener);
    options.signal.addEventListener('abort', () => handlers.delete(listener));
  };
  const emit = (type, event = {}) =>
    listeners.get(type)?.forEach((fn) => fn({ target: dialog, ...event }));
  dialog.showModal = supported
    ? () => {
        dialog.open = true;
      }
    : undefined;
  dialog.close = () => {
    if (!dialog.open) return;
    dialog.open = false;
    pending.push(() => emit('close'));
  };
  dialog.getBoundingClientRect = () => ({ left: 100, right: 600, top: 50, bottom: 700 });
  let otherOpen = false;
  const document = {
    activeElement: trigger,
    querySelector: () => (otherOpen ? {} : dialog.open ? dialog : null),
  };
  const create = runInNewContext(source + '\ncreateDialogController', {
    document,
    HTMLElement: Element,
    AbortController,
  });
  let closed = 0;
  const modal = create(dialog, { initialFocus: () => input, onClose: () => closed++ });
  return {
    modal,
    trigger,
    input,
    dialog,
    emit,
    create: (options) => create(dialog, options),
    setOther: (value) => {
      otherOpen = value;
    },
    flush: () => {
      pending.splice(0).forEach((fn) => fn());
    },
    get closed() {
      return closed;
    },
  };
}

test('unsupported dialogs preserve native-page fallbacks and never throw on open', () => {
  const app = harness({ supported: false });
  assert.equal(app.modal.supported, false);
  assert.equal(app.modal.open(), false);
  assert.equal(app.dialog.open, false);
  app.modal.destroy();
});
test('modal opening is exclusive and focuses the feature-selected control', () => {
  const app = harness();
  app.setOther(true);
  assert.equal(app.modal.open(), false);
  app.setOther(false);
  assert.equal(app.modal.open(), true);
  assert.equal(app.input.focused, 1);
  assert.equal(app.modal.open(), false);
});
test('dialog padding stays open; a genuine backdrop click closes and restores its trigger', () => {
  const app = harness();
  app.modal.open(app.trigger);
  app.emit('click', { clientX: 105, clientY: 55 });
  assert.equal(app.dialog.open, true);
  app.emit('click', { clientX: 99, clientY: 55 });
  app.flush();
  assert.equal(app.dialog.open, false);
  assert.equal(app.trigger.focused, 1);
});
test('native Escape close restores focus; disconnected triggers and new dialogs are protected', () => {
  const app = harness();
  app.modal.open();
  app.dialog.close();
  app.flush();
  assert.equal(app.trigger.focused, 1);
  app.modal.open();
  app.trigger.isConnected = false;
  app.modal.close();
  app.flush();
  assert.equal(app.trigger.focused, 1);
  app.trigger.isConnected = true;
  app.modal.open();
  app.modal.close();
  app.setOther(true);
  app.flush();
  assert.equal(app.trigger.focused, 1);
});
test('navigation disposal closes once without refocusing departed content or leaving handlers', () => {
  const app = harness();
  app.modal.open();
  app.modal.destroy();
  app.flush();
  assert.equal(app.closed, 0);
  assert.equal(app.trigger.focused, 0);
  assert.equal(app.modal.open(), false);
  app.emit('click', { clientX: 10, clientY: 10 });
  assert.equal(app.dialog.open, false);
});
test('a queued close event cannot reset a dialog that has already reopened', () => {
  const app = harness();
  app.modal.open();
  app.modal.close();
  app.modal.open();
  app.flush();
  assert.equal(app.dialog.open, true);
  assert.equal(app.closed, 0);
  app.modal.close();
  app.flush();
  assert.equal(app.closed, 1);
});
