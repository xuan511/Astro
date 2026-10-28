import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';
import {
  searchEntries,
  snippet,
  highlightParts,
  parseSearchIndex,
  searchScopes,
} from '../src/lib/search.ts';

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
function searchHarness(fetch, { compact = true, search = '', pathname = '/posts/reading/' } = {}) {
  class Element {
    listeners = new Map();
    attributes = new Map();
    dataset = {};
    children = [];
    hidden = false;
    value = '';
    textContent = '';
    constructor(tagName = '') {
      this.tagName = tagName;
    }
    addEventListener(type, listener, options) {
      const listeners = this.listeners.get(type) || new Set();
      this.listeners.set(type, listeners);
      listeners.add(listener);
      options?.signal?.addEventListener('abort', () => listeners.delete(listener));
    }
    emit(type, event = {}) {
      this.listeners
        .get(type)
        ?.forEach((listener) => listener({ target: this, preventDefault() {}, ...event }));
    }
    querySelector() {
      return new Element();
    }
    querySelectorAll(selector) {
      return this.children.flatMap((child) =>
        child instanceof Element
          ? [
              ...(selector === 'a' && child.tagName === 'a' ? [child] : []),
              ...child.querySelectorAll(selector),
            ]
          : [],
      );
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
    focus() {
      document.activeElement = this;
    }
  }
  const nodes = Object.fromEntries(
    [
      'input',
      'kind',
      'results',
      'status',
      'more',
      'retry',
      'all',
      'suggestions',
      'clear',
      'scopes',
      'kind-fallback',
      'conditions',
      'remove-query',
      'remove-kind',
      'query-label',
      'kind-label',
    ].map((key) => [key, new Element()]),
  );
  nodes.kind.value = 'all';
  const scopes = Object.fromEntries(
    Object.keys(searchScopes).map((kind) => {
      const button = new Element('button');
      button.dataset.searchScope = kind;
      return [kind, button];
    }),
  );
  const root = new Element();
  const suggestion = new Element('button');
  suggestion.dataset.searchSuggestion = 'Linux';
  root.dataset.compact = String(compact);
  root.querySelector = (selector) =>
    nodes[selector.match(/data-search-(.*)\]/)?.[1]] || new Element();
  root.querySelectorAll = (selector) =>
    selector === '[data-search-scope]'
      ? Object.values(scopes)
      : selector === '[data-search-suggestion]'
        ? [suggestion]
        : [];
  const document = new Element();
  document.querySelectorAll = (selector) => (selector === '[data-search-root]' ? [root] : []);
  document.querySelector = () => null;
  document.createElement = (tagName) => new Element(tagName);
  document.createTextNode = (text) => ({ textContent: text });
  const timers = new Map();
  let timerId = 0;
  const queries = [];
  const historyCalls = [];
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
    searchScopes,
    Error,
    AbortController,
    URLSearchParams,
    location: { search, pathname },
    history: {
      replaceState(_state, _title, url) {
        if (compact) assert.fail('Quick search must not change the current article URL');
        historyCalls.push(url);
      },
    },
    navigator: { userAgent: 'test' },
    Element,
    setTimeout: (callback) => (timers.set(++timerId, callback), timerId),
    clearTimeout: (id) => timers.delete(id),
  });
  return {
    nodes,
    scopes,
    suggestion,
    root,
    queries,
    historyCalls,
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

const project = {
  ...entry,
  id: 'linux-device-manager',
  title: '设备管理工具',
  kind: 'project',
  url: '/projects/linux-device-manager/',
};
test('scope buttons and removable conditions keep filtering, pressed states and focus in sync', async () => {
  const app = searchHarness(async () => ({ ok: true, json: async () => [entry, project] }));
  assert.equal(app.nodes['kind-fallback'].hidden, true);
  assert.equal(app.nodes.scopes.hidden, false);
  app.input('Linux');
  app.expireTimers();
  await setImmediate();
  assert.equal(app.nodes.results.children.length, 2);
  app.scopes.project.emit('click');
  await setImmediate();
  assert.equal(app.nodes.kind.value, 'project');
  assert.equal(app.scopes.project.attributes.get('aria-pressed'), 'true');
  assert.equal(app.scopes.all.attributes.get('aria-pressed'), 'false');
  assert.equal(app.nodes.results.children.length, 1);
  assert.equal(app.nodes.all.href, '/search/?q=Linux&kind=project');
  assert.equal(app.nodes['query-label'].textContent, '关键词：Linux');
  assert.equal(app.nodes['kind-label'].textContent, '范围：项目');

  app.nodes['remove-query'].emit('click');
  assert.equal(app.nodes.input.value, '');
  assert.equal(app.nodes.kind.value, 'project', 'removing the query preserves the scope');
  assert.equal(app.nodes['remove-query'].hidden, true);
  assert.equal(app.nodes['remove-kind'].hidden, false);
  assert.equal(app.document.activeElement, app.nodes.input);
  assert.equal(app.nodes.status.textContent, '输入关键词，在项目中查找。');

  app.input('Linux');
  app.expireTimers();
  await setImmediate();
  app.nodes['remove-kind'].emit('click');
  await setImmediate();
  assert.equal(app.nodes.input.value, 'Linux', 'removing the scope preserves the query');
  assert.equal(app.nodes.kind.value, 'all');
  assert.equal(app.nodes.results.children.length, 2);
  assert.equal(app.document.activeElement, app.scopes.all);

  app.scopes.project.emit('click');
  app.nodes.clear.emit('click');
  await setImmediate();
  assert.equal(app.nodes.input.value, '');
  assert.equal(app.nodes.kind.value, 'all');
  assert.equal(app.nodes.conditions.hidden, true);
  assert.equal(app.nodes.results.children.length, 0);
  assert.equal(app.scopes.all.attributes.get('aria-pressed'), 'true');
  assert.equal(app.document.activeElement, app.nodes.input);
  app.scopes.project.emit('click');
  app.suggestion.emit('click');
  await setImmediate();
  assert.equal(app.nodes.kind.value, 'project', 'a suggested keyword preserves the chosen scope');
  assert.equal(app.nodes.input.value, 'Linux');
  assert.equal(app.nodes.results.children.length, 1);
});

test('standalone search restores URL filters and updates the URL when each condition is removed', async () => {
  const app = searchHarness(async () => ({ ok: true, json: async () => [entry, project] }), {
    compact: false,
    pathname: '/blog/search/',
    search: '?q=Linux&kind=project',
  });
  await setImmediate();
  assert.equal(app.nodes.input.value, 'Linux');
  assert.equal(app.scopes.project.attributes.get('aria-pressed'), 'true');
  assert.equal(app.nodes.results.children.length, 1);
  assert.equal(app.historyCalls.at(-1), '/blog/search/?q=Linux&kind=project');
  app.nodes['remove-kind'].emit('click');
  await setImmediate();
  assert.equal(app.historyCalls.at(-1), '/blog/search/?q=Linux');
  app.nodes['remove-query'].emit('click');
  assert.equal(app.historyCalls.at(-1), '/blog/search/');
  assert.equal(app.nodes.conditions.hidden, true);
});

test('keyboard result selection still works with the enhanced filter controls', async () => {
  const app = searchHarness(async () => ({ ok: true, json: async () => [entry] }));
  app.input('Linux');
  app.expireTimers();
  await setImmediate();
  const [link] = app.nodes.results.querySelectorAll('a');
  let prevented = false;
  app.root.emit('keydown', {
    target: app.nodes.input,
    key: 'ArrowDown',
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(app.document.activeElement, link);
  app.root.emit('keydown', { target: link, key: 'ArrowUp' });
  assert.equal(app.document.activeElement, app.nodes.input);
});
