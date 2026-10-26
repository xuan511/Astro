import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrateBackup } from '../scripts/import-backup.mjs';

test('browser backup migration retains draft state and exact media without changing source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shijian-import-'));
  const input = join(root, 'backup.json'),
    output = join(root, 'staging');
  const backup = {
    data: {
      schemaVersion: 1,
      site: { name: '拾间' },
      posts: [
        {
          id: 'sample',
          title: '我的草稿',
          body: '![图](local:abc)',
          date: '2026-10-23',
          status: 'draft',
        },
      ],
      tracks: [],
    },
    media: [
      { key: 'local:abc', type: 'image/png', base64: Buffer.from([1, 2, 3]).toString('base64') },
    ],
  };
  try {
    await writeFile(input, JSON.stringify(backup));
    assert.equal((await migrateBackup(input, output)).posts, 1);
    const post = await readFile(join(output, 'posts/import-sample-1.md'), 'utf8');
    assert.match(post, /draft: true/);
    assert.match(post, /\/media\/imported\/1-local-abc.png/);
    assert.deepEqual([...(await readFile(join(output, 'media/1-local-abc.png')))], [1, 2, 3]);
    await assert.rejects(() => migrateBackup(input, output), { code: 'EEXIST' });
    backup.media = [];
    await writeFile(input, JSON.stringify(backup));
    await assert.rejects(() => migrateBackup(input, join(root, 'missing-media')), /缺少本地媒体/);
    await assert.rejects(() => access(join(root, 'missing-media')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
