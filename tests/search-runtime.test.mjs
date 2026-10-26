import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import { searchEntries, snippet, highlightParts, parseSearchIndex } from '../src/lib/search.ts';

// Execute the real client script with only its DOM and scheduling boundaries replaced.
const script = stripTypeScriptTypes(
  readFileSync(new URL('../src/scripts/search.ts', import.meta.url), 'utf8'),
).replace(/^import[\s\S]*?;\r?\n/gm, '');
const entry = {
  id: 'linux',
  title: 'Linux 调试',
  description: '调试记录',
  body: 'Linux 设备调试',
  url: '/posts/linux/',
  kind: 'tech',
  category: '笔记',
  tags: ['Linux'],
  date: '2026-10-23',
  demo: false,
};
function deferred() {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
}
function searchHarness(fetch) {
  class Element {
    listeners = new Map();
    attributes = new Map();
    dataset = {};
    children = [];
    hidden = false;
    value = '';
    textContent = '';
    addEventListener(type, listener, options) {
      const listeners = this.listeners.get(type) || new Set();
      this.listeners.set(type, listeners);
      listeners.add(listener);
      options?.signal?.addEventListener('abort', () => listeners.delete(listener));
    }
    emit(type) {
      this.listeners.get(type)?.forEach((listener) => listener({ target: this }));
    }
    querySelector() {
      return new Element();
    }
    querySelectorAll() {
      return [];
    }
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
    replaceChildren() {
      this.children = [];
    }
    append(...children) {
      this.children.push(...children);
    }
    focus() {}
  }
  const nodes = Object.fromEntries(
    ['input', 'kind', 'results', 'status', 'more', 'retry', 'all', 'suggestions', 'clear'].map(
      (key) => [key, new Element()],
    ),
  );
  nodes.kind.value = 'all';
  const root = new Element();
  root.dataset.compact = 'true';
  root.querySelector = (selector) =>
    nodes[selector.match(/data-search-(.*)\]/)?.[1]] || new Element();
  const document = new Element();
  document.querySelectorAll = (selector) => (selector === '[data-search-root]' ? [root] : []);
  document.querySelector = () => null;
  document.createElement = () => new Element();
  document.createTextNode = (text) => ({ textContent: text });
  const timers = new Map();
  let timerId = 0;
  const queries = [];
  runInNewContext(script, {
    document,
    fetch,
    withBase: (path) => '/' + path,
    searchEntries: (rows, query, kind) => {
      queries.push(query);
      return searchEntries(rows, query, kind);
    },
    snippet,
    highlightParts,
    parseSearchIndex,
    Error,
    AbortController,
    URLSearchParams,
    location: { search: '', pathname: '/posts/reading/' },
    history: {
      replaceState() {
        assert.fail('Quick search must not change the current article URL');
      },
    },
    navigator: { userAgent: 'test' },
    Element,
    setTimeout: (callback) => (timers.set(++timerId, callback), timerId),
    clearTimeout: (id) => timers.delete(id),
  });
  return {
    nodes,
    queries,
    document,
    input(value) {
      nodes.input.value = value;
      nodes.input.emit('input');
    },
    expireTimers() {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach((callback) => callback());
    },
  };
}

test('typing invalidates a pending query before the next debounce runs', async () => {
  const request = deferred();
  const app = searchHarness(() => request.promise);
  app.input('Linux');
  app.expireTimers();
  app.input('音乐');
  request.resolve({ ok: true, json: async () => [entry] });
  await setImmediate();
  assert.deepEqual(app.queries, []);
  assert.equal(app.nodes.results.children.length, 0);
  assert.equal(app.nodes.status.textContent, '正在翻找…');
  app.expireTimers();
  await setImmediate();
  assert.deepEqual(app.queries, ['音乐']);
  assert.match(app.nodes.status.textContent, /没有找到相关内容/);
});

test('invalid index data is not cached and retry refetches a usable index', async () => {
  let requests = 0;
  const app = searchHarness(async () => ({
    ok: true,
    json: async () => (++requests === 1 ? { invalid: true } : [entry]),
  }));
  app.input('Linux');
  app.expireTimers();
  await setImmediate();
  assert.equal(app.nodes.retry.hidden, false);
  assert.match(app.nodes.status.textContent, /搜索索引格式不正确/);
  app.nodes.retry.emit('click');
  await setImmediate();
  assert.equal(requests, 2);
  assert.equal(app.nodes.retry.hidden, true);
  assert.equal(app.nodes.results.children.length, 1);
  assert.equal(app.nodes.status.textContent, '找到 1 条记录');
  app.input('新词');
  assert.equal(app.nodes.results.children.length, 0, 'old links disappear at the keystroke');
  assert.equal(app.nodes.all.hidden, true);
});

test('Chinese composition cancels stale work and searches only the committed text', async () => {
  const request = deferred();
  const app = searchHarness(() => request.promise);
  app.input('Linux');
  app.expireTimers();
  app.nodes.input.emit('compositionstart');
  app.input('diao');
  request.resolve({ ok: true, json: async () => [entry] });
  await setImmediate();
  app.expireTimers();
  assert.deepEqual(app.queries, []);
  app.nodes.input.value = '调试';
  app.nodes.input.emit('compositionend');
  await setImmediate();
  assert.deepEqual(app.queries, ['调试']);
  assert.equal(app.nodes.results.children.length, 1);
});

test('leaving the page cancels timers and prevents a pending request from rendering', async () => {
  const request = deferred();
  const app = searchHarness(() => request.promise);
  app.input('Linux');
  app.expireTimers();
  app.input('调试');
  app.document.emit('astro:before-swap');
  request.resolve({ ok: true, json: async () => [entry] });
  await setImmediate();
  app.expireTimers();
  assert.deepEqual(app.queries, []);
  assert.equal(app.nodes.results.children.length, 0);
});
