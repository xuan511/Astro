import test from 'node:test';
import assert from 'node:assert/strict';
import { isIndexablePath } from '../src/lib/indexing.mjs';

test('indexing excludes utility/recovery routes beneath every deployment base', () => {
  for (const base of ['/', '/Astro/', '/notes/archive/']) {
    for (const path of [
      'search/',
      'search',
      'writing/',
      '404/',
      '404.html',
      'legacy/',
      'legacy/recover/',
      'projects/embedded-console/',
    ])
      assert.equal(isIndexablePath(base + path, base), false, base + path);
    for (const path of ['', 'about/', 'posts/search/', 'tags/writing/', 'projects/legacy-console/'])
      assert.equal(isIndexablePath(base + path, base), true, base + path);
  }
  assert.equal(isIndexablePath('/Astronaut/search/', '/Astro/'), false);
  assert.equal(isIndexablePath('/about/', '/Astro/'), false);
});
