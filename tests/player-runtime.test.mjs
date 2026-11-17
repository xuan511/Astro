import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { withBase } from '../src/lib/paths.ts';
import * as playerState from '../src/lib/player-state.ts';
import { createDialogController } from '../src/lib/dialog.ts';

// Exercise the shipped controller against a small media/DOM boundary, without a browser dependency.
const source = stripTypeScriptTypes(
  await readFile(new URL('../src/scripts/player.ts', import.meta.url), 'utf8'),
).replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm, '');
const settle = () => new Promise((resolve) => setImmediate(resolve));

class ElementStub {
  dataset = {};
  classes = new Set();
  classList = {
    toggle: (name, active) => (active ? this.classes.add(name) : this.classes.delete(name)),
  };
  attributes = new Map();
  hidden = false;
  inert = false;
  focused = false;
  textContent = '';
  constructor(selector = '') {
    this.selector = selector;
  }
  closest() {
    return this;
  }
  matches(selector) {
    return this.selector === selector;
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  focus() {
    this.focused = true;
  }
}

function mount({
  preference,
  failFirstLoad = false,
  tracks,
  minimized = false,
  storageThrows = false,
} = {}) {
  class InputStub extends ElementStub {
    value = '0';
  }
  class SelectStub extends ElementStub {
    value = 'sequence';
  }
  class AudioStub extends EventTarget {
    dataset = {};
    volume = 0.55;
    currentTime = 0;
    duration = NaN;
    paused = true;
    ended = false;
    error = null;
    src = '';
    loadCalls = 0;
    playCalls = 0;
    load() {
      this.loadCalls++;
      this.currentTime = 0;
      this.error = failFirstLoad && this.loadCalls === 1 ? { code: 4 } : null;
      if (!this.error) {
        this.duration = 60;
        this.dispatchEvent(new Event('loadedmetadata'));
      }
    }
    async play() {
      this.playCalls++;
      if (this.error) throw new DOMException('Unavailable source', 'NotSupportedError');
      this.paused = false;
      this.dispatchEvent(new Event('play'));
    }
    pause() {
      this.paused = true;
      this.dispatchEvent(new Event('pause'));
    }
  }
  const audio = new AudioStub();
  const feedback = new ElementStub();
  const root = new ElementStub();
  const panel = new ElementStub('[data-player-panel]');
  const capsule = new ElementStub('[data-player-capsule]');
  const restore = new ElementStub('[data-player-restore]');
  const minimize = new ElementStub('[data-player-minimize]');
  const modes = [
    new SelectStub('[data-player-mode-select]'),
    new SelectStub('[data-player-mode-select]'),
  ];
  const hint = new ElementStub('[data-mode-hint]');
  const announcement = new ElementStub('[data-player-announcement]');
  const seek = new InputStub('[data-player-seek]');
  const elements = new Map([
    ['[data-player-feedback]', [feedback]],
    ['[data-player-panel]', [panel]],
    ['[data-player-capsule]', [capsule]],
    ['[data-player-restore]', [restore]],
    ['[data-player-mode-select]', modes],
    ['[data-mode-hint]', [hint]],
    ['[data-player-announcement]', [announcement]],
    ['[data-player-seek]', [seek]],
  ]);
  root.querySelector = (selector) => {
    if (selector === 'audio') return audio;
    if (selector === '.capsule-expand') return restore;
    if (selector === '[data-player-minimize]') return minimize;
    if (selector === '[data-playlist]')
      return {
        textContent: JSON.stringify(
          tracks || [
            { id: 'available', title: 'Example', artist: 'Example', src: 'music/example.wav' },
          ],
        ),
      };
    return null;
  };
  const listeners = new Map();
  const document = {
    body: { dataset: { base: '/blog/' } },
    getElementById: () => root,
    querySelectorAll: (selector) => elements.get(selector) || [],
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
  };
  const key = 'shijian:/blog/:player-v3';
  const storage = new Map([
    [key, preference ? JSON.stringify(preference) : null],
    [key + ':minimized', String(minimized)],
  ]);
  runInContext(
    source,
    createContext({
      ...playerState,
      createDialogController,
      AbortController,
      nextIndex: (index, count, mode, ended) =>
        playerState.nextIndex(index, count, mode, ended, () => 0),
      withBase: (path) => withBase(path, '/blog/'),
      document,
      navigator: {},
      window: { addEventListener() {} },
      crypto: { randomUUID: () => 'same-audio-instance' },
      localStorage: {
        getItem: (key) => {
          if (storageThrows) throw new Error('Storage blocked');
          return storage.get(key);
        },
        setItem: (key, value) => {
          if (storageThrows) throw new Error('Storage blocked');
          storage.set(key, value);
        },
      },
      Element: ElementStub,
      HTMLElement: ElementStub,
      HTMLInputElement: InputStub,
      HTMLSelectElement: SelectStub,
      DOMException,
    }),
  );
  async function dispatch(type, target, extra = {}) {
    for (const handler of listeners.get(type) || []) handler({ target, ...extra });
    await settle();
  }
  return {
    audio,
    feedback,
    panel,
    capsule,
    modes,
    hint,
    announcement,
    seek,
    restore,
    minimize,
    dispatch,
    async toggle() {
      for (const handler of listeners.get('click') || [])
        handler({ target: new ElementStub('[data-player-toggle]') });
      await settle();
    },
    async mode(value, picker = 0) {
      modes[picker].value = value;
      await dispatch('change', modes[picker]);
    },
    async end() {
      audio.ended = true;
      audio.paused = true;
      audio.dispatchEvent(new Event('ended'));
      await settle();
      audio.ended = false;
    },
    saved: () => JSON.parse(storage.get(key)),
    minimizedSaved: () => storage.get(key + ':minimized'),
  };
}

test('restored playback waits for user input and only restores the matching track position', async () => {
  for (const [id, expectedPosition] of [
    ['available', 23],
    ['removed', 0],
  ]) {
    const controller = mount({ preference: { id, position: 23 } });
    assert.equal(controller.audio.playCalls, 0);
    assert.equal(controller.audio.loadCalls, 0);
    assert.equal(controller.audio.paused, true);
    await controller.toggle();
    assert.equal(controller.audio.currentTime, expectedPosition);
    assert.equal(controller.audio.paused, false);
    assert.equal(controller.audio.src, '/blog/music/example.wav');
    assert.equal(controller.saved().id, 'available');
  }
});

test('a failed track can reload and play after the user retries, clearing visible feedback', async () => {
  const controller = mount({ failFirstLoad: true });
  await controller.toggle();
  assert.equal(controller.audio.paused, true);
  assert.match(controller.feedback.textContent, /重试/);
  await controller.toggle();
  assert.equal(controller.audio.loadCalls, 2);
  assert.equal(controller.audio.paused, false);
  assert.equal(controller.feedback.textContent, '');
});

test('retrying a later media error preserves the position on the same audio instance', async () => {
  const controller = mount();
  const originalAudio = controller.audio;
  await controller.toggle();
  originalAudio.currentTime = 18;
  originalAudio.error = { code: 2 };
  originalAudio.paused = true;
  originalAudio.dispatchEvent(new Event('error'));
  assert.match(controller.feedback.textContent, /重试/);
  await controller.toggle();
  assert.equal(controller.audio, originalAudio);
  assert.equal(originalAudio.loadCalls, 2);
  assert.equal(originalAudio.currentTime, 18);
  assert.equal(originalAudio.paused, false);
});

const threeTracks = ['first', 'second', 'third'].map((id) => ({
  id,
  title: id,
  artist: 'Example',
  src: `music/${id}.mp3`,
}));
test('either visible mode picker controls actual ended behavior and synchronizes the other picker', async () => {
  const controller = mount({ tracks: threeTracks });
  await controller.mode('shuffle', 1);
  assert.deepEqual(
    controller.modes.map((x) => x.value),
    ['shuffle', 'shuffle'],
  );
  assert.match(controller.hint.textContent, /随机/);
  assert.match(controller.announcement.textContent, /已切换为随机播放/);
  assert.equal(controller.audio.playCalls, 0, 'changing mode must not start music');
  await controller.toggle();
  await controller.end();
  assert.equal(controller.audio.src, '/blog/music/second.mp3');
  await controller.mode('repeat-one');
  const loads = controller.audio.loadCalls;
  await controller.end();
  assert.equal(controller.audio.src, '/blog/music/second.mp3');
  assert.equal(controller.audio.loadCalls, loads);
  assert.equal(controller.audio.currentTime, 0);
  await controller.mode('sequence');
  await controller.end();
  assert.equal(controller.audio.src, '/blog/music/third.mp3');
  await controller.end();
  assert.equal(controller.audio.paused, true);
  assert.equal(controller.feedback.textContent, '歌单已播完。');
  assert.equal(controller.saved().mode, 'sequence');
});

test('minimize and restore keep the same playing audio, remove hidden controls from focus, and survive navigation', async () => {
  const controller = mount();
  await controller.toggle();
  controller.audio.currentTime = 12;
  const original = controller.audio;
  await controller.dispatch('click', controller.minimize);
  assert.equal(controller.panel.hidden, true);
  assert.equal(controller.panel.inert, true);
  assert.equal(controller.capsule.hidden, false);
  assert.equal(controller.restore.focused, true);
  assert.equal(controller.audio, original);
  assert.equal(original.paused, false);
  assert.equal(original.currentTime, 12);
  assert.equal(original.loadCalls, 1);
  assert.equal(controller.minimizedSaved(), 'true');
  await controller.dispatch('astro:page-load', null);
  assert.equal(controller.panel.hidden, true);
  await controller.dispatch('click', controller.restore);
  assert.equal(controller.panel.hidden, false);
  assert.equal(controller.capsule.hidden, true);
  assert.equal(controller.capsule.inert, true);
  assert.equal(controller.minimize.focused, true);
  assert.equal(original.loadCalls, 1);
  const restored = mount({ minimized: true });
  assert.equal(restored.panel.hidden, true);
  assert.equal(restored.audio.playCalls, 0);
});

test('mode and minimizing remain usable when storage is unavailable; invalid modes are rejected', async () => {
  const controller = mount({ storageThrows: true });
  await controller.mode('shuffle');
  await controller.dispatch('click', controller.minimize);
  await controller.dispatch('astro:page-load', null);
  assert.deepEqual(
    controller.modes.map((x) => x.value),
    ['shuffle', 'shuffle'],
  );
  assert.equal(controller.panel.hidden, true);
  await controller.mode('invalid');
  await controller.dispatch('astro:page-load', null);
  assert.deepEqual(
    controller.modes.map((x) => x.value),
    ['shuffle', 'shuffle'],
  );
});

test('dragging previews the seek position until release, while keyboard seeking remains immediate', async () => {
  const controller = mount();
  await controller.toggle();
  await controller.dispatch('pointerdown', controller.seek);
  controller.seek.value = '500';
  await controller.dispatch('input', controller.seek);
  controller.audio.dispatchEvent(new Event('timeupdate'));
  assert.equal(controller.audio.currentTime, 0, 'dragging should not repeatedly restart decoding');
  await controller.dispatch('change', controller.seek);
  await controller.dispatch('pointerup', controller.seek);
  assert.equal(controller.audio.currentTime, 30);
  controller.seek.value = '750';
  await controller.dispatch('input', controller.seek);
  assert.equal(controller.audio.currentTime, 45);
  await controller.dispatch('pointerdown', controller.seek);
  controller.seek.value = '100';
  await controller.dispatch('input', controller.seek);
  await controller.dispatch('pointercancel', controller.seek);
  assert.equal(controller.audio.currentTime, 45);
});
