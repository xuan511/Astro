import test from 'node:test';
import assert from 'node:assert/strict';
import { createLive2DFrame, shouldMountLive2D } from '../src/lib/live2d-frame.ts';

test('Live2D renders only after opt-in on a visible expanded desktop companion', () => {
  const active = {
    enabled: true,
    hidden: false,
    compact: false,
    quiet: false,
    reducedMotion: false,
    mobile: false,
    away: false,
  };
  assert(shouldMountLive2D(active));
  assert(!shouldMountLive2D({ ...active, enabled: false }));
  for (const key of ['hidden', 'compact', 'quiet', 'reducedMotion', 'mobile', 'away'])
    assert(!shouldMountLive2D({ ...active, [key]: true }), key);
});

test('navigation cannot duplicate a frame; hide while loading removes its entire context', () => {
  const created = [],
    statuses = [];
  const live = createLive2DFrame(
    () => {
      const frame = {
        removed: false,
        remove() {
          this.removed = true;
        },
      };
      created.push(frame);
      return frame;
    },
    (status) => statuses.push(status),
  );
  live.sync(true);
  live.sync(true);
  assert.equal(created.length, 1);
  live.sync(false);
  assert(created[0].removed);
  live.ready(created[0]);
  assert.equal(statuses.at(-1), 'off', 'stale ready message is ignored');
  live.sync(true);
  assert.equal(created.length, 2);
  live.fail(created[0]);
  assert.equal(live.current, created[1], 'stale failure cannot remove the new frame');
  live.ready(created[1]);
  assert.equal(statuses.at(-1), 'ready');
});

test('failure falls back without an automatic retry loop; an explicit off/on retries once', () => {
  let mounts = 0;
  const live = createLive2DFrame(
    () => ({ id: ++mounts, remove() {} }),
    () => {},
  );
  live.sync(true);
  live.fail(live.current);
  live.sync(true);
  live.sync(true);
  assert.equal(mounts, 1);
  assert.equal(live.current, null);
  live.sync(false);
  live.sync(true);
  assert.equal(mounts, 2);
});
