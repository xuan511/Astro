import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { withBase } from '../src/lib/paths.ts';
import * as playerState from '../src/lib/player-state.ts';

// Exercise the shipped controller against a small media/DOM boundary, without a browser dependency.
const source = stripTypeScriptTypes(
  await readFile(new URL('../src/scripts/player.ts', import.meta.url), 'utf8'),
).replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm, '');
const settle = () => new Promise((resolve) => setImmediate(resolve));

class ElementStub {
  dataset = {};
  classList = { toggle() {} };
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
}

function mount({ preference, failFirstLoad = false } = {}) {
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
  root.querySelector = (selector) => {
    if (selector === 'audio') return audio;
    if (selector === '[data-playlist]')
      return {
        textContent: JSON.stringify([
          { id: 'available', title: 'Example', artist: 'Example', src: 'music/example.wav' },
        ]),
      };
    return null;
  };
  const listeners = new Map();
  const document = {
    body: { dataset: { base: '/blog/' } },
    getElementById: () => root,
    querySelectorAll: (selector) => (selector === '[data-player-feedback]' ? [feedback] : []),
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
  };
  let saved = preference ? JSON.stringify(preference) : null;
  runInContext(
    source,
    createContext({
      ...playerState,
      withBase: (path) => withBase(path, '/blog/'),
      document,
      navigator: {},
      window: { addEventListener() {} },
      crypto: { randomUUID: () => 'same-audio-instance' },
      localStorage: {
        getItem: () => saved,
        setItem: (_key, value) => (saved = value),
      },
      Element: ElementStub,
      HTMLElement: ElementStub,
      HTMLInputElement: class extends ElementStub {},
      DOMException,
    }),
  );
  return {
    audio,
    feedback,
    async toggle() {
      for (const handler of listeners.get('click') || [])
        handler({ target: new ElementStub('[data-player-toggle]') });
      await settle();
    },
    saved: () => JSON.parse(saved),
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
