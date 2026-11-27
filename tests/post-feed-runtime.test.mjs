import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { masonryPositions } from '../src/lib/layout-preferences.ts';
const source = stripTypeScriptTypes(
  readFileSync(new URL('../src/scripts/post-feed.ts', import.meta.url), 'utf8'),
).replace(/^import[\s\S]*?from ['"][^'"]+['"];?\s*/gm, '');
function harness(mode = 'grid') {
  const handlers = new Map(),
    frames = new Map(),
    observers = [];
  let sequence = 0;
  class HTMLElement {
    dataset = {};
    children = [];
    clientWidth = 600;
    offsetHeight = 200;
    style = {
      removeProperty(name) {
        delete this[name];
      },
    };
  }
  const feed = new HTMLElement();
  feed.dataset = { columnWidth: '280', cardGap: '20' };
  feed.children = [new HTMLElement(), new HTMLElement(), new HTMLElement()];
  let hasFeed = true;
  const document = {
    documentElement: { dataset: { layout: mode } },
    querySelectorAll: () => (hasFeed ? [feed] : []),
    addEventListener(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      handlers.get(type)?.delete(handler);
    },
  };
  class ResizeObserver {
    targets = [];
    stopped = false;
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe(target) {
      this.targets.push(target);
    }
    disconnect() {
      this.stopped = true;
    }
  }
  runInNewContext(source, {
    document,
    HTMLElement,
    ResizeObserver,
    masonryPositions,
    requestAnimationFrame: (callback) => {
      frames.set(++sequence, callback);
      return sequence;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    window: { addEventListener() {}, removeEventListener() {} },
  });
  const emit = (type) => handlers.get(type)?.forEach((handler) => handler());
  return {
    feed,
    observers,
    get frames() {
      return frames.size;
    },
    mode(value) {
      document.documentElement.dataset.layout = value;
      emit('shijian:display-change');
    },
    flush() {
      for (const [id, callback] of [...frames]) {
        frames.delete(id);
        callback();
      }
    },
    leave() {
      emit('astro:before-swap');
      hasFeed = false;
      emit('astro:page-load');
    },
  };
}
test('default CSS grid and list create no ResizeObserver and schedule no layout frames', () => {
  const app = harness();
  assert.equal(app.observers.length, 0);
  assert.equal(app.frames, 0);
  app.mode('list');
  app.mode('grid');
  assert.equal(app.observers.length, 0);
  assert.equal(app.frames, 0);
});
test('masonry observes only while selected, resets inline geometry, and releases everything on navigation', () => {
  const app = harness();
  app.mode('masonry');
  assert.equal(app.observers.length, 1);
  assert.equal(app.observers[0].targets.length, 4);
  app.flush();
  assert.equal(app.feed.dataset.masonryReady, 'true');
  assert.equal(app.feed.children[0].style.width, '290px');
  app.mode('list');
  assert.equal(app.observers[0].stopped, true);
  assert.equal(app.feed.dataset.masonryReady, undefined);
  assert.equal(app.feed.children[0].style.width, undefined);
  app.mode('masonry');
  assert.equal(app.observers.length, 2);
  app.leave();
  assert.equal(app.observers[1].stopped, true);
  assert.equal(app.frames, 0);
  assert.equal(app.observers.length, 2);
});
