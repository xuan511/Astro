import assert from 'node:assert/strict';
import test from 'node:test';
import { readingPreferences, changeReadingSize } from '../src/lib/reading-preferences.ts';
test('reading preferences recover from malformed storage and enforce size bounds', () => {
  for (const value of [null, [], 'large', { size: 'huge', wide: 'yes' }]) {
    assert.deepEqual(readingPreferences(value), { size: 'normal', wide: false });
  }
  assert.deepEqual(readingPreferences({ size: 'large', wide: true }), {
    size: 'large',
    wide: true,
  });
  assert.deepEqual(changeReadingSize({ size: 'small', wide: true }, -1), {
    size: 'small',
    wide: true,
  });
  assert.deepEqual(changeReadingSize({ size: 'large', wide: false }, 1), {
    size: 'large',
    wide: false,
  });
  assert.equal(changeReadingSize({ size: 'normal', wide: false }, 1).size, 'large');
});
