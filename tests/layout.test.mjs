import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import {
  parseDisplay,
  displayDefaults,
  displayBootstrap,
  masonryPositions,
} from '../src/lib/layout-preferences.ts';

const fonts = [
  { id: 'system', family: 'system-ui' },
  { id: 'book', family: 'MyBook, serif' },
];
test('display preference validation recovers malformed storage and migrates old scene preferences', () => {
  for (const raw of [
    null,
    'null',
    '[]',
    '42',
    '{bad',
    '{"sidebar":"unknown","hue":"20","font":"url(https://example.com)"}',
  ])
    assert.deepEqual(parseDisplay(raw), displayDefaults);
  assert.deepEqual(parseDisplay('{"scene":"mist","solid":true}'), {
    ...displayDefaults,
    scene: 'mist',
    solid: true,
  });
  assert.equal(parseDisplay('{"hue":-99}').hue, 0);
  assert.equal(parseDisplay('{"hue":900}').hue, 359);
  assert.equal(parseDisplay('{"hue":12.7}').hue, 13);
  assert.equal(parseDisplay('{"hue":165}').hue, 205);
  assert.equal(parseDisplay('{"paletteVersion":2,"hue":165}').hue, 165);
  assert.equal(parseDisplay('{"hue":280}').hue, 280);
  assert.equal(
    parseDisplay(
      '{"font":"book"}',
      displayDefaults,
      fonts.map((font) => font.id),
    ).font,
    'book',
  );
});
test('every sidebar, post layout and wallpaper combination survives the same before-paint validator', () => {
  for (const sidebar of ['left', 'right', 'both', 'none'])
    for (const layout of ['list', 'grid', 'masonry'])
      for (const wallpaper of ['banner', 'fullscreen', 'transparent', 'solid']) {
        const value = { ...displayDefaults, sidebar, layout, wallpaper, font: 'book', hue: 359 };
        const properties = new Map();
        const document = {
          documentElement: {
            dataset: {},
            style: { setProperty: (key, value) => properties.set(key, value) },
          },
        };
        runInNewContext(displayBootstrap('appearance', displayDefaults, fonts), {
          document,
          localStorage: { getItem: () => JSON.stringify(value) },
        });
        assert.deepEqual(
          { ...document.documentElement.dataset },
          { sidebar, layout, wallpaper, scene: 'coast', solid: 'false', font: 'book' },
        );
        assert.equal(properties.get('--theme-hue'), '359');
        assert.equal(properties.get('--site-font'), 'MyBook, serif');
      }
});
test('bootstrap preserves in-memory preferences, tolerates blocked storage and escapes inline delimiters', () => {
  let applied = 0;
  runInNewContext(displayBootstrap('a', displayDefaults, fonts), {
    __shijianAppearance: { key: 'a', apply: () => applied++ },
  });
  assert.equal(applied, 1);
  const source = displayBootstrap('</script>', displayDefaults, [
    { id: 'system', family: 'A</script>' },
  ]);
  assert(!source.includes('</script>'));
  const properties = new Map();
  const document = {
    documentElement: {
      dataset: {},
      style: { setProperty: (key, value) => properties.set(key, value) },
    },
  };
  runInNewContext(source, {
    document,
    localStorage: {
      getItem: () => {
        throw Error('blocked');
      },
    },
  });
  assert.equal(document.documentElement.dataset.sidebar, 'both');
  assert.equal(properties.get('--theme-hue'), '205');
});
test('masonry packs the shortest available column without overlap, including narrow and empty containers', () => {
  const heights = [160, 300, 120, 220, 180, 400, 250];
  for (const width of [0, 240, 390, 600, 950, 1400]) {
    const result = masonryPositions(width, 280, 20, heights);
    assert(result.columns >= 1);
    assert.equal(result.items.length, heights.length);
    result.items.forEach((item, index) => {
      assert(item.x >= 0 && item.x + item.width <= width + 0.001);
      assert(item.y + heights[index] <= result.height + 0.001);
      result.items.slice(0, index).forEach((other, previous) => {
        const overlapX = item.x < other.x + other.width && item.x + item.width > other.x;
        const overlapY = item.y < other.y + heights[previous] && item.y + heights[index] > other.y;
        assert(!(overlapX && overlapY), 'cards must never overlap');
      });
    });
  }
  assert.deepEqual(masonryPositions(600, 280, 20, []), {
    columns: 2,
    columnWidth: 290,
    items: [],
    height: 0,
  });
  assert.deepEqual(
    masonryPositions(600, 280, 20, [100, 200, 50]).items.map((item) => [item.x, item.y]),
    [
      [0, 0],
      [310, 0],
      [0, 120],
    ],
  );
});
