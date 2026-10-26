import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { withBase, readingMinutes } from '../src/lib/paths.ts';
import { deployment, deploymentEnvironment } from '../scripts/deployment.mjs';
import contentAssets from '../scripts/rehype-content.mjs';

test('public links, assets, external URLs and Chinese taxonomy work beneath a base path', () => {
  assert.equal(withBase('music/', '/journal/'), '/journal/music/');
  assert.equal(withBase('/images/photo.webp', '/journal/'), '/journal/images/photo.webp');
  assert.equal(withBase('', '/'), '/');
  assert.equal(
    withBase('https://cdn.example.org/music.mp3', '/blog/'),
    'https://cdn.example.org/music.mp3',
  );
  assert.equal(withBase('#section', '/blog/'), '#section');
  assert.equal(readingMinutes('字'.repeat(901)), 3);
});
test('deployment distinguishes user Pages, project Pages and custom domains', () => {
  assert.deepEqual(deployment({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'ethan/blog' }), {
    site: 'https://ethan.github.io',
    base: '/blog/',
  });
  assert.equal(
    deployment({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'ethan/ethan.github.io' }).base,
    '/',
  );
  assert.deepEqual(deployment({ SITE_URL: 'https://example.org', BASE_PATH: '/' }), {
    site: 'https://example.org',
    base: '/',
  });
  assert.throws(() => deployment({ SITE_URL: 'https://example.org/blog/' }), /SITE_URL/);
  assert.throws(() => deployment({ BASE_PATH: '/../escape' }), /BASE_PATH/);
  assert.throws(() => deployment({ BASE_PATH: '/%2e%2e/escape' }), /BASE_PATH/);
  assert.throws(() => deployment({ BASE_PATH: '/blog%2fother/' }), /BASE_PATH/);
  assert.throws(() => deployment({ BASE_PATH: '/blog%ZZ/' }), /BASE_PATH/);
  assert.throws(() => deployment({ SITE_URL: 'https://name:password@example.org' }), /SITE_URL/);
  assert.throws(
    () => deployment({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'incomplete' }),
    /GITHUB_REPOSITORY/,
  );
  assert.equal(deployment({ BASE_PATH: '/my..blog/' }).base, '/my..blog/');
});
test('repeated root slashes stay on the configured origin', () => {
  for (const rawBase of ['/', '//', '///']) {
    const { site, base } = deployment({
      SITE_URL: 'https://journal.example.com',
      BASE_PATH: rawBase,
    });
    assert.equal(base, '/');
    assert.equal(new URL(base + 'sitemap-index.xml', site).href, `${site}/sitemap-index.xml`);
    assert.equal(withBase('music/paper-light.wav', base), '/music/paper-light.wav');
  }
  assert.equal(deployment({ BASE_PATH: '//blog///' }).base, '/blog/');
});
test('local deployment .env is read and shell overrides take priority', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shijian-env-'));
  try {
    const file = join(directory, '.env');
    await writeFile(file, 'SITE_URL="https://example.org"\nBASE_PATH=/notes/\n');
    assert.deepEqual(deployment(deploymentEnvironment({}, file)), {
      site: 'https://example.org',
      base: '/notes/',
    });
    assert.deepEqual(deployment(deploymentEnvironment({ BASE_PATH: '/' }, file)), {
      site: 'https://example.org',
      base: '/',
    });
    assert.deepEqual(deploymentEnvironment({ BASE_PATH: '/ok/' }, join(directory, 'missing')), {
      BASE_PATH: '/ok/',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('Actions emits normalized repository paths and explicit custom-domain overrides', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shijian-actions-'));
  try {
    for (const custom of [false, true]) {
      const output = join(directory, custom ? 'custom.env' : 'project.env');
      const result = spawnSync(process.execPath, ['scripts/github-env.mjs'], {
        env: {
          GITHUB_ACTIONS: 'true',
          GITHUB_REPOSITORY: 'xuan511/blog',
          GITHUB_ENV: output,
          ...(custom ? { REQUESTED_SITE: ' https://example.org ', REQUESTED_BASE: ' / ' } : {}),
        },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        await readFile(output, 'utf8'),
        custom
          ? 'SITE_URL=https://example.org\nBASE_PATH=/\n'
          : 'SITE_URL=https://xuan511.github.io\nBASE_PATH=/blog/\n',
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('Markdown images are lazy and external links have safe target attributes', () => {
  const tree = {
    children: [
      { type: 'element', tagName: 'img', properties: { src: './photo.png' } },
      { type: 'element', tagName: 'a', properties: { href: 'https://example.org' } },
    ],
  };
  contentAssets()(tree);
  assert.equal(tree.children[0].properties.loading, 'lazy');
  assert.equal(tree.children[0].properties.src, './photo.png');
  assert.deepEqual(tree.children[1].properties.rel, ['noopener', 'noreferrer']);
});
