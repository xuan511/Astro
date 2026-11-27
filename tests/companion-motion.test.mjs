import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { advanceTap, reactionFor } from '../src/lib/companion-reactions.ts';

const source = stripTypeScriptTypes(
  await readFile(new URL('../src/scripts/companion-motion.ts', import.meta.url), 'utf8'),
)
  .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];\s*/gm, '')
  .replace('export function createCompanionMotion', 'function createCompanionMotion');
const settle = () => new Promise((resolve) => setImmediate(resolve));

function mount(supported = true) {
  const batches = [];
  class FakeAnimation {
    canceled = false;
    finished = new Promise((resolve, reject) => {
      this.finish = resolve;
      this.reject = reject;
    });
    cancel() {
      this.canceled = true;
      this.reject(new Error('canceled'));
    }
  }
  class Element {
    dataset = {};
    children = [];
    classList = { add: () => {}, remove: () => {} };
    ownerDocument = { createElement: () => new Element() };
    append(child) {
      this.children.push(child);
    }
    replaceChildren() {
      this.children = [];
    }
    animate(frames, options) {
      const result = new FakeAnimation();
      batches.push({ frames, options, result });
      return result;
    }
  }
  const root = new Element(),
    figure = new Element(),
    effects = new Element();
  if (!supported) figure.animate = undefined;
  const context = createContext({ root, figure, effects });
  runInContext(source + '\nvar motion = createCompanionMotion(root,figure,effects);', context);
  return { root, figure, effects, batches, motion: context.motion };
}

test('ATRI has varied, finite responses and a personal petting line', () => {
  const ids = ['atri'];
  for (const id of ids) {
    const names = Array.from({ length: 5 }, (_, i) => reactionFor(id, i).name);
    assert(new Set(names).size >= 4);
    const pet = reactionFor(id, 0, 'pet');
    assert.equal(pet.name, 'pet');
    assert(pet.line?.length > 0);
    for (let i = 0; i < 15; i++) {
      const plan = reactionFor(id, i, 'tap', i + 1);
      assert(plan.duration <= 1200 && plan.duration > 0);
      assert(plan.particles <= 12 && plan.frames.length >= 2);
      assert(plan.frames.every((frame) => typeof frame.transform === 'string'));
    }
  }
  assert.deepEqual(reactionFor('hitori', 0), reactionFor('atri', 0));
  assert.equal(reactionFor('constructor', NaN).name, 'bounce');
});
test('triple-click surprise respects its time window and resets after a pause or clock rollback', () => {
  let tap = null;
  for (const now of [0, 200, 450]) tap = advanceTap(tap, now);
  assert.equal(tap.count, 3);
  assert.equal(reactionFor('atri', 2, 'tap', tap.count).name, 'celebrate');
  assert.equal(advanceTap(tap, 1400).count, 1);
  assert.equal(advanceTap(tap, 100).count, 1);
  assert.equal(reactionFor('atri', 3, 'tap', 4).name, 'sway');
});
test('new clicks replace the previous animation batch, and stale completion cannot clear new effects', async () => {
  const app = mount();
  app.motion.play(reactionFor('atri', 0), true);
  const first = app.batches.slice();
  app.motion.play(reactionFor('atri', 1), true);
  await settle();
  assert(first.every((x) => x.result.canceled));
  assert.equal(app.root.dataset.reaction, 'cheer');
  assert.equal(app.effects.children.length, 6);
  const second = app.batches.slice(first.length);
  assert(second.every((x) => Number.isFinite(x.options.duration) && !x.options.iterations));
  for (const animation of second) animation.result.finish();
  await settle();
  assert.equal(app.effects.children.length, 0);
  assert.equal(app.root.dataset.reaction, undefined);
});
test('quiet/reduced-motion fallback creates no effects, and interruption cancels everything', async () => {
  const app = mount();
  assert.equal(app.motion.play(reactionFor('atri', 0, 'pet'), false), false);
  assert.equal(app.batches.length, 0);
  app.motion.play(reactionFor('atri', 0, 'tap', 3), true);
  assert.equal(app.effects.children.length, 12);
  app.motion.stop();
  await settle();
  assert(app.batches.every((x) => x.result.canceled));
  assert.equal(app.effects.children.length, 0);
  assert.equal(app.root.dataset.reaction, undefined);
  assert.equal(mount(false).motion.play(reactionFor('atri', 0), true), false);
});
