import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  selectPublishedPosts,
  groupPostsByTaxonomy,
  postsWithNeighbors,
  groupPostsByYear,
} from '../src/lib/post-query.ts';
import { calendarDate, formatDate } from '../src/lib/dates.ts';

const post = (
  id,
  publishedAt,
  { kind = 'tech', category = '代码', tags = [], draft = false } = {},
) => ({
  id,
  data: { publishedAt: new Date(publishedAt), kind, category, tags, draft },
});
const ids = (posts) => posts.map(({ id }) => id);

test('publication order is stable for same-day entries and leaves the input unchanged', () => {
  const input = Object.freeze([
    post('z-note', '2026-10-20'),
    post('earlier', '2026-10-01'),
    post('a-note', '2026-10-20'),
    post('draft', '2026-11-01', { draft: true }),
  ]);
  assert.deepEqual(ids(selectPublishedPosts(input)), ['a-note', 'z-note', 'earlier']);
  assert.deepEqual(ids(selectPublishedPosts([...input].reverse())), [
    'a-note',
    'z-note',
    'earlier',
  ]);
  assert.deepEqual(ids(input), ['z-note', 'earlier', 'a-note', 'draft']);
});

test('kind queries retain the existing draft policy without scheduling future dates', () => {
  const input = [
    post('future', '2099-01-01', { kind: 'life' }),
    post('tech', '2026-10-20'),
    post('life', '2026-10-19', { kind: 'life' }),
    post('private', '2099-01-02', { kind: 'life', draft: true }),
  ];
  assert.deepEqual(ids(selectPublishedPosts(input, 'tech')), ['tech']);
  assert.deepEqual(ids(selectPublishedPosts(input, 'life')), ['future', 'life']);
  assert.deepEqual(selectPublishedPosts([], 'tech'), []);
});

test('taxonomy groups count each article once and share publication order and draft isolation', () => {
  const published = selectPublishedPosts([
    post('old', '2026-10-18', { tags: ['调试'] }),
    post('new', '2026-10-20', { tags: ['调试', '调试', 'Linux'] }),
    post('life', '2026-10-19', { kind: 'life', category: '生活', tags: ['日常'] }),
    post('private', '2026-10-21', { category: '私密', tags: ['草稿'], draft: true }),
  ]);
  assert.deepEqual(
    groupPostsByTaxonomy(published, 'tags').map(({ name, posts }) => ({ name, ids: ids(posts) })),
    [
      { name: '调试', ids: ['new', 'old'] },
      { name: 'Linux', ids: ['new'] },
      { name: '日常', ids: ['life'] },
    ],
  );
  assert.deepEqual(
    groupPostsByTaxonomy(published, 'category').map(({ name, posts }) => ({
      name,
      ids: ids(posts),
    })),
    [
      { name: '代码', ids: ['new', 'old'] },
      { name: '生活', ids: ['life'] },
    ],
  );
  assert.deepEqual(groupPostsByTaxonomy([], 'tags'), []);
});

test('adjacent navigation retains cross-kind chronology with correct first, last and single boundaries', () => {
  const published = selectPublishedPosts([
    post('old', '2026-10-18'),
    post('middle', '2026-10-19', { kind: 'life' }),
    post('new', '2026-10-20'),
    post('private', '2026-10-21', { draft: true }),
  ]);
  assert.deepEqual(
    postsWithNeighbors(published).map(({ post, previous, next }) => [
      post.id,
      previous?.id,
      next?.id,
    ]),
    [
      ['new', 'middle', undefined],
      ['middle', 'old', 'new'],
      ['old', undefined, 'middle'],
    ],
  );
  assert.deepEqual(postsWithNeighbors([published[0]]), [
    { post: published[0], previous: undefined, next: undefined },
  ]);
  assert.deepEqual(postsWithNeighbors([]), []);
});

test('archive years and month/day use the same Shanghai calendar as article dates', () => {
  const published = selectPublishedPosts([
    post('last-year', '2025-12-31T15:59:59Z'),
    post('new-year', '2025-12-31T16:00:00Z'),
    post('new-month', '2026-10-31T16:00:00Z'),
    post('private', '2027-01-01T00:00:00Z', { draft: true }),
  ]);
  assert.deepEqual(
    groupPostsByYear(published).map(({ year, entries }) => ({
      year,
      entries: entries.map(({ post, date }) => [post.id, date.month, date.day]),
    })),
    [
      {
        year: 2026,
        entries: [
          ['new-month', '11', '01'],
          ['new-year', '01', '01'],
        ],
      },
      { year: 2025, entries: [['last-year', '12', '31']] },
    ],
  );
  assert.deepEqual(calendarDate(new Date('2025-12-31T16:00:00Z')), {
    year: 2026,
    month: '01',
    day: '01',
  });
  assert.equal(formatDate(new Date('2025-12-31T16:00:00Z')), '2026年1月1日');
  assert.deepEqual(groupPostsByYear([]), []);
});

test('publication calendar is independent of the build host timezone', () => {
  const moduleUrl = new URL('../src/lib/dates.ts', import.meta.url).href;
  for (const timezone of ['UTC', 'Asia/Shanghai', 'America/Los_Angeles']) {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { calendarDate, formatDate } from ${JSON.stringify(moduleUrl)};
        const date = new Date('2025-12-31T16:00:00Z');
        console.log(JSON.stringify({ ...calendarDate(date), label: formatDate(date) }));`,
      ],
      { encoding: 'utf8', env: { ...process.env, TZ: timezone } },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      year: 2026,
      month: '01',
      day: '01',
      label: '2026年1月1日',
    });
  }
});
