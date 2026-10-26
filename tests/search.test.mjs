import test from 'node:test';
import assert from 'node:assert/strict';
import { searchEntries, snippet, highlightParts, parseSearchIndex } from '../src/lib/search.ts';
test('search highlights Chinese, full-width text and overlapping terms without changing source text', () => {
  const source = '调试 ＣＲＣ32 与 <img onerror=alert(1)>，调试记录';
  const parts = highlightParts(source, '调试 crc 调试记录 <img');
  assert.equal(parts.map((part) => part.text).join(''), source);
  assert.deepEqual(
    parts.filter((part) => part.matched).map((part) => part.text),
    ['调试', 'ＣＲＣ', '<img', '调试记录'],
  );
  assert.deepEqual(highlightParts('没有匹配', 'Linux'), [{ text: '没有匹配', matched: false }]);
  assert.deepEqual(highlightParts('', '代码'), []);
});
const make = (id, title, body, kind = 'tech') => ({
  id,
  title,
  body,
  description: '说明',
  url: '/posts/' + id,
  kind,
  category: '笔记',
  tags: ['Linux'],
  date: '2026-10-23',
  demo: false,
});
const entries = [
  make('one', 'Linux 串口', '解析分片数据'),
  make('two', '一个周末', '听一首歌', 'life'),
  make('three', '设备管理', 'Linux 串口设备'),
];
test('search index validates row types and navigation targets before caching', () => {
  assert.deepEqual(parseSearchIndex(entries), entries);
  assert.deepEqual(parseSearchIndex([]), []);
  for (const invalid of [
    null,
    { entries },
    [null],
    [{ ...entries[0], tags: 'Linux' }],
    [{ ...entries[0], body: null }],
    [{ ...entries[0], kind: 'draft' }],
    [{ ...entries[0], demo: 'false' }],
    ...['javascript:alert(1)', '//example.org/', '/\\example.org/', '/posts/a b/'].map((url) => [
      { ...entries[0], url },
    ]),
  ])
    assert.throws(() => parseSearchIndex(invalid), /搜索索引格式不正确/);
});
test('Chinese body search, AND tokens, scope and title ranking', () => {
  assert.equal(searchEntries(entries, '分片')[0].id, 'one');
  assert.equal(searchEntries(entries, 'LINUX 串口')[0].id, 'one');
  assert.equal(searchEntries(entries, '听', 'tech').length, 0);
  assert.equal(searchEntries(entries, '    ').length, 0);
  assert.equal(searchEntries(entries, '<script>')[0], undefined);
  assert.match(snippet(entries[0], '分片'), /分片/);
});
