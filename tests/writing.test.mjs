import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPost } from '../scripts/new-post.mjs';

test('new writing starts as a draft and refuses path traversal or overwriting', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shijian-writing-'));
  try {
    const path = await createPost('一个真实问题', { slug: 'one-real-question', mdx: true, root });
    assert.match(await readFile(path, 'utf8'), /draft: true/);
    assert(path.endsWith('.mdx'));
    await assert.rejects(() => createPost('覆盖', { slug: 'one-real-question', mdx: true, root }), {
      code: 'EEXIST',
    });
    await assert.rejects(() => createPost('逃逸', { slug: '../outside', root }), /slug/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
