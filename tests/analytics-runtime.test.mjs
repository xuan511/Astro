import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { canonicalVisit, countNames, createVisitReporter } from '../src/lib/analytics.ts';
const source = stripTypeScriptTypes(
  readFileSync(new URL('../src/scripts/analytics.ts', import.meta.url), 'utf8'),
).replace(/^import[\s\S]*?from ['"][^'"]+['"];?\s*/gm, '');
const settle = () => new Promise((resolve) => setImmediate(resolve));
function harness({ local = false, hidden = false, noindex = false } = {}) {
  const handlers = new Map(),
    idle = new Map(),
    calls = [];
  let sequence = 0,
    excluded = noindex;
  const config = {
    enabled: true,
    origin: 'https://xuan511.github.io',
    base: '/Astro/',
    endpoint: 'https://cdn.busuanzi.cc/api.php',
    timeoutMs: 10000,
  };
  const elements = countNames.map((name) => ({
    dataset: { visitCount: name },
    textContent: '—',
    hasAttribute: (key) => key === 'data-visit-count',
  }));
  const status = { textContent: '', hasAttribute: () => false };
  const document = {
    hidden,
    querySelector: (selector) =>
      selector === '[data-analytics-config]'
        ? { textContent: JSON.stringify(config) }
        : excluded
          ? {}
          : null,
    querySelectorAll: (selector) =>
      selector === '[data-visit-count]' ? elements : [status, ...elements],
    addEventListener(type, handler) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(handler);
    },
  };
  const location = {
    href: local ? 'http://localhost:4173/Astro/' : 'https://xuan511.github.io/Astro/',
  };
  runInNewContext(source, {
    document,
    location,
    Intl,
    canonicalVisit,
    countNames,
    createVisitReporter,
    setTimeout,
    clearTimeout,
    window: {
      requestIdleCallback: (callback) => {
        idle.set(++sequence, callback);
        return sequence;
      },
      cancelIdleCallback: (id) => idle.delete(id),
    },
    requestVisit: async (endpoint, url, signal, timeout) => {
      calls.push({ endpoint, url, signal, timeout });
      return Object.fromEntries(countNames.map((name) => [name, calls.length]));
    },
  });
  const emit = (type) => handlers.get(type)?.forEach((handler) => handler());
  return {
    calls,
    get pending() {
      return idle.size;
    },
    get status() {
      return status.textContent;
    },
    get values() {
      return elements.map((element) => element.textContent);
    },
    emit,
    async flush() {
      for (const [id, callback] of [...idle]) {
        idle.delete(id);
        callback();
      }
      await settle();
    },
    navigate(path) {
      emit('astro:before-swap');
      location.href = 'https://xuan511.github.io/Astro/' + path;
      emit('astro:page-load');
    },
    visible() {
      document.hidden = false;
      emit('visibilitychange');
    },
    exclude() {
      excluded = true;
    },
  };
}
test('initial hydration and repeated page-load/visibility events queue exactly one report without canceling it', async () => {
  const app = harness();
  assert.equal(app.pending, 1);
  app.emit('astro:page-load');
  assert.equal(app.pending, 1);
  await app.flush();
  assert.equal(app.calls.length, 1);
  assert(app.values.every((value) => value === '1'));
  app.emit('astro:page-load');
  app.visible();
  await app.flush();
  assert.equal(app.calls.length, 1);
  app.navigate('posts/a/?secret=hidden#heading');
  await app.flush();
  assert.equal(app.calls.length, 2);
  assert.equal(app.calls[1].url, 'https://xuan511.github.io/Astro/posts/a/');
  app.navigate('');
  await app.flush();
  assert.equal(app.calls.length, 3);
});
test('local previews, hidden documents and noindex pages do not pollute public statistics', async () => {
  const local = harness({ local: true });
  await local.flush();
  assert.equal(local.calls.length, 0);
  assert(local.status.includes('预览'));
  const hidden = harness({ hidden: true });
  await hidden.flush();
  assert.equal(hidden.calls.length, 0);
  hidden.visible();
  await hidden.flush();
  assert.equal(hidden.calls.length, 1);
  const utility = harness({ noindex: true });
  await utility.flush();
  assert.equal(utility.calls.length, 0);
  const queued = harness();
  queued.navigate('posts/b/');
  await queued.flush();
  assert.equal(queued.calls.length, 1);
  assert(queued.calls[0].url.endsWith('/posts/b/'));
  queued.exclude();
  queued.navigate('search/');
  await queued.flush();
  assert.equal(queued.calls.length, 1);
  assert(queued.values.every((value) => value === '—'));
});
