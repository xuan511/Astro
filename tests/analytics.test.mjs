import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalVisit,
  parseVisitCounts,
  requestVisit,
  createVisitReporter,
  countNames,
} from '../src/lib/analytics.ts';
const sample = (value = 12) =>
  Object.fromEntries(countNames.map((name) => ['busuanzi_' + name, value]));
const counts = parseVisitCounts(sample());
test('counted URLs merge query/hash variants and reject other sites, previews and private URL fields', () => {
  const origin = 'https://xuan511.github.io';
  assert.equal(
    canonicalVisit(origin + '/Astro/posts/hello/?q=secret#title', origin, '/Astro/'),
    origin + '/Astro/posts/hello/',
  );
  assert.equal(canonicalVisit(origin + '/Astro', origin, '/Astro/'), origin + '/Astro/');
  assert.equal(canonicalVisit(origin + '/', origin, '/'), origin + '/');
  for (const value of [
    origin + '/Astrology/',
    'https://other.test/Astro/',
    'http://xuan511.github.io/Astro/',
    'https://name:password@xuan511.github.io/Astro/',
    'not-a-url',
  ])
    assert.equal(canonicalVisit(value, origin, '/Astro/'), null);
  for (const origin of ['http://localhost:4173', 'https://localhost', 'https://127.0.0.1'])
    assert.equal(canonicalVisit(origin + '/', origin, '/'), null);
});
test('only complete nonnegative safe integer provider counts can appear in the interface', () => {
  assert.deepEqual(
    parseVisitCounts(sample('1234')),
    Object.fromEntries(countNames.map((name) => [name, 1234])),
  );
  for (const bad of [-1, 1.5, Infinity, NaN, true, '<script>', '1,234', null])
    assert.equal(parseVisitCounts({ ...sample(), busuanzi_page_pv: bad }), null);
  for (const value of [null, [], { error: 'blocked' }, {}])
    assert.equal(parseVisitCounts(value), null);
  assert.equal(parseVisitCounts(sample(Number.MAX_SAFE_INTEGER + 1)), null);
});
test('the request sends only a canonical route, omits credentials/referrer and does not run third-party JS', async () => {
  let received;
  const result = await requestVisit(
    'https://cdn.busuanzi.cc/api.php',
    'https://xuan511.github.io/Astro/',
    new AbortController().signal,
    1000,
    async (endpoint, options) => {
      received = { endpoint, options };
      return { ok: true, json: async () => ({ ...sample(), hosts_count: 'ignored' }) };
    },
  );
  assert.deepEqual(result, counts);
  assert.equal(received.endpoint, 'https://cdn.busuanzi.cc/api.php');
  assert.equal(received.options.method, 'POST');
  assert.equal(received.options.credentials, 'omit');
  assert.equal(received.options.referrerPolicy, 'no-referrer');
  assert.equal(received.options.headers, undefined);
  assert.deepEqual(JSON.parse(received.options.body), {
    url: 'https://xuan511.github.io/Astro/',
    referrer: '',
  });
});
test('counter timeout, cancellation, HTTP failure and malformed responses fail without fake counts or retries', async () => {
  const hangs = async (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      if (signal.aborted) reject(new Error('aborted'));
    });
  await assert.rejects(
    requestVisit(
      'https://counter.test',
      'https://site.test/',
      new AbortController().signal,
      5,
      hangs,
    ),
  );
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    requestVisit('https://counter.test', 'https://site.test/', aborted.signal, 1000, hangs),
  );
  await assert.rejects(
    requestVisit(
      'https://counter.test',
      'https://site.test/',
      new AbortController().signal,
      1000,
      async () => ({ ok: false }),
    ),
    /unavailable/,
  );
  await assert.rejects(
    requestVisit(
      'https://counter.test',
      'https://site.test/',
      new AbortController().signal,
      1000,
      async () => ({ ok: true, json: async () => ({ error: 'invalid site' }) }),
    ),
    /Invalid/,
  );
});
test('one report per navigation still allows a later revisit, while stale article responses are ignored', async () => {
  const pending = [],
    states = [];
  const reporter = createVisitReporter(
    (url, signal) =>
      new Promise((resolve, reject) => pending.push({ url, signal, resolve, reject })),
    (state) => states.push(state),
  );
  const first = reporter.open('1:a', 'https://site.test/a/');
  assert.equal(await reporter.open('1:a', 'https://site.test/a/'), false);
  assert.equal(pending.length, 1);
  const second = reporter.open('2:b', 'https://site.test/b/');
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve(counts);
  await second;
  pending[0].resolve(parseVisitCounts(sample(999)));
  await first;
  assert.deepEqual(states.at(-1), { status: 'ready', counts });
  const revisit = reporter.open('3:a', 'https://site.test/a/');
  assert.equal(pending.length, 3);
  pending[2].resolve(counts);
  await revisit;
  const failing = reporter.open('4:c', 'https://site.test/c/');
  pending[3].reject(new Error('offline'));
  await failing;
  assert.deepEqual(states.at(-1), { status: 'error' });
  assert.equal(await reporter.open('4:c', 'https://site.test/c/'), false);
  assert.equal(pending.length, 4);
  const cancel = reporter.open('5:d', 'https://site.test/d/');
  reporter.cancel();
  pending[4].resolve(counts);
  await cancel;
  assert.equal(states.at(-1).status, 'loading');
});
