import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  parseCompanions,
  parseCompanionPreference,
  placeCompanion,
  normalizePosition,
} from '../src/lib/companion-state.ts';

const entries = JSON.parse(
  await readFile(new URL('../src/data/companions.json', import.meta.url), 'utf8'),
);
const catalog = parseCompanions(
  JSON.stringify(entries.map((entry) => ({ ...entry, image: '/Astro/' + entry.image }))),
);

test('all seven requested companions have local artwork and original encouragement', () => {
  assert.deepEqual(
    catalog.map((item) => item.id),
    ['atri', 'tsumugi', 'shiki', 'kud', 'hitori', 'nijika', 'kita'],
  );
  assert(catalog.every((item) => item.lines.length >= 2));
});
test('malformed, duplicated and remote-image catalog entries cannot reach the widget', () => {
  assert.deepEqual(parseCompanions('{bad'), []);
  assert.deepEqual(parseCompanions('{}'), []);
  const first = catalog[0];
  assert.deepEqual(
    parseCompanions(
      JSON.stringify([
        null,
        first,
        first,
        { ...first, id: 'remote', image: '//tracker.test/avatar.png' },
        { ...first, id: 'empty', lines: [] },
        { ...first, id: 'invalid', lines: [42] },
      ]),
    ),
    [first],
  );
});
test('preferences survive valid saves, recover removed characters and respect mobile defaults', () => {
  const saved = {
    id: 'kud',
    compact: false,
    hidden: true,
    quiet: true,
    position: { x: 0.4, y: 0.6 },
  };
  assert.deepEqual(parseCompanionPreference(JSON.stringify(saved), catalog, true), saved);
  assert.equal(parseCompanionPreference('{bad', catalog, true).compact, true);
  assert.equal(parseCompanionPreference('null', catalog).hidden, false);
  assert.equal(
    parseCompanionPreference('{"id":"removed","compact":"false"}', catalog, true).id,
    'atri',
  );
  assert.equal(parseCompanionPreference('{"compact":"false"}', catalog, true).compact, true);
  assert.deepEqual(parseCompanionPreference('{"position":{"x":-10,"y":8}}', catalog).position, {
    x: 0,
    y: 1,
  });
  assert.equal(parseCompanionPreference('{"position":{"x":"oops","y":1}}', catalog).position, null);
});
test('dragged positions remain reachable after viewport changes', () => {
  assert.deepEqual(
    placeCompanion({ x: -50, y: 9999 }, { width: 128, height: 200 }, { width: 390, height: 844 }),
    { x: 12, y: 632 },
  );
  assert.deepEqual(
    normalizePosition({ x: 100, y: 200 }, { width: 100, height: 100 }, { width: 500, height: 900 }),
    { x: 0.25, y: 0.25 },
  );
  assert.deepEqual(
    normalizePosition({ x: -20, y: 100 }, { width: 128, height: 200 }, { width: 100, height: 100 }),
    { x: 0, y: 1 },
  );
});
test('expanded phone player moves companions above it while collapsed player leaves space', () => {
  const view = { width: 390, height: 844 },
    size = { width: 128, height: 200 };
  const desired = { x: 16, y: 628 };
  assert.deepEqual(
    placeCompanion(desired, size, view, { x: 16, y: 620, width: 358, height: 210 }),
    { x: 16, y: 408 },
  );
  assert.deepEqual(
    placeCompanion(desired, size, view, { x: 212, y: 760, width: 164, height: 72 }),
    desired,
  );
  const side = placeCompanion({ x: 100, y: 12 }, size, view, {
    x: 160,
    y: 0,
    width: 220,
    height: 800,
  });
  assert.equal(side.x, 20);
});
