import test from 'node:test';
import assert from 'node:assert/strict';
import { nextIndex, parsePreference, timeLabel } from '../src/lib/player-state.ts';

test('sequence ends at the last track; manual next still allows wrap-around', () => {
  assert.equal(nextIndex(1, 3, 'sequence', true), 2);
  assert.equal(nextIndex(2, 3, 'sequence', true), -1);
  assert.equal(nextIndex(2, 3, 'sequence'), 0);
  assert.equal(nextIndex(0, 0, 'sequence'), -1);
});
test('repeat only repeats on ended; shuffle never immediately repeats with several tracks', () => {
  assert.equal(nextIndex(1, 3, 'repeat-one', true), 1);
  assert.equal(nextIndex(1, 3, 'repeat-one'), 2);
  for (let current = 0; current < 5; current++)
    for (const value of [0, 0.2, 0.5, 0.999]) {
      const chosen = nextIndex(current, 5, 'shuffle', false, () => value);
      assert.notEqual(chosen, current);
      assert(chosen >= 0 && chosen < 5);
    }
  assert.equal(nextIndex(0, 1, 'shuffle'), 0);
});
test('corrupted or out-of-range preferences cannot create invalid audio state', () => {
  assert.equal(parsePreference('{broken').volume, 0.55);
  assert.deepEqual(parsePreference('{"id":"track","position":-20,"volume":8,"mode":"unknown"}'), {
    id: 'track',
    position: 0,
    volume: 1,
    mode: 'sequence',
  });
  assert.equal(timeLabel(95), '1:35');
  assert.equal(timeLabel(NaN), '--:--');
});
test('removed tracks cannot transfer their saved position to the first available track', () => {
  const playlist = [{ id: 'available' }];
  const saved = { id: 'removed', position: 42, volume: 0.3, mode: 'shuffle' };
  assert.deepEqual(parsePreference(JSON.stringify(saved), playlist), {
    ...saved,
    id: '',
    position: 0,
  });
  assert.equal(parsePreference(JSON.stringify({ ...saved, id: '' }), playlist).position, 0);
  assert.equal(
    parsePreference(JSON.stringify({ ...saved, id: 'available' }), playlist).position,
    42,
  );
  assert.equal(parsePreference(JSON.stringify(saved), []).position, 0);
});
