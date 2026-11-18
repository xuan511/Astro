import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { parseAppearance, appearanceBootstrap } from '../src/lib/appearance-preferences.ts';

test('bootstrap preserves a current-session appearance without rereading blocked storage', () => {
  let applied = 0;
  runInNewContext(appearanceBootstrap('appearance'), {
    __shijianAppearance: { key: 'appearance', apply: () => applied++ },
    localStorage: {
      getItem: () => {
        throw Error('must not read');
      },
    },
  });
  assert.equal(applied, 1);
});
test('bootstrap safely embeds a deployment-scoped key into an inline script', () => {
  const key = 'shijian:</script>:appearance';
  let received;
  const source = appearanceBootstrap(key);
  assert(!source.includes('</script>'));
  runInNewContext(source, {
    document: { documentElement: { dataset: {} } },
    localStorage: {
      getItem: (name) => {
        received = name;
        return null;
      },
    },
  });
  assert.equal(received, key);
});

test('appearance preferences keep only supported scenes and boolean surface choices', () => {
  for (const raw of [
    null,
    '{bad',
    'null',
    '[]',
    '42',
    '{"scene":"https://tracker.test/a.png","solid":"true"}',
  ])
    assert.deepEqual(parseAppearance(raw), { scene: 'coast', solid: false });
  for (const scene of ['coast', 'mist', 'paper'])
    assert.deepEqual(parseAppearance(JSON.stringify({ scene, solid: true, extra: 'ignored' })), {
      scene,
      solid: true,
    });
});

test('before-paint bootstrap and runtime parser agree, including blocked storage', () => {
  for (const value of [
    null,
    '{bad',
    'null',
    '{"scene":"mist","solid":true}',
    '{"scene":"paper","solid":false}',
    '{"scene":"unknown"}',
  ]) {
    const document = { documentElement: { dataset: {} } };
    runInNewContext(appearanceBootstrap('appearance'), {
      document,
      localStorage: { getItem: () => value },
    });
    const expected = parseAppearance(value);
    assert.equal(document.documentElement.dataset.scene, expected.scene);
    assert.equal(document.documentElement.dataset.solid, String(expected.solid));
  }
  const document = { documentElement: { dataset: {} } };
  runInNewContext(appearanceBootstrap('appearance'), {
    document,
    localStorage: {
      getItem: () => {
        throw Error('blocked');
      },
    },
  });
  assert.equal(document.documentElement.dataset.scene, 'coast');
});
