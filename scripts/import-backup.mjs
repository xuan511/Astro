import { stat, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensions = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/flac': 'flac',
};
const safe = (value) =>
  String(value || 'entry')
    .replace(/[^a-z\d-]/gi, '-')
    .slice(0, 70);
const defaults = new Map([
  ['assets/paper-light.wav', 'music/paper-light.wav'],
  ['assets/hero.svg', 'images/hero.svg'],
  ['assets/feature.svg', 'images/feature.svg'],
]);
const references = (data) =>
  [
    data.site?.avatar,
    ...(data.tracks || []).map((track) => track.src),
    ...(data.posts || []).flatMap((post) =>
      [...String(post.body || '').matchAll(/!\[[^\]]*\]\(([^\s)]+)\)/g)].map((match) => match[1]),
    ),
  ].filter((value) => typeof value === 'string');

export async function migrateBackup(input, output) {
  if ((await stat(input)).size > 200 * 1024 * 1024) throw new Error('备份超过 200 MB。');
  const raw = JSON.parse(await readFile(input, 'utf8'));
  const data = raw.data || raw;
  if (
    data.schemaVersion !== 1 ||
    !data.site ||
    !Array.isArray(data.posts) ||
    data.posts.length > 2000
  )
    throw new Error('不是有效的拾间备份。');
  const media = Array.isArray(raw.media) ? raw.media : [];
  if (media.length > 1000) throw new Error('媒体数量超过限制。');
  const map = new Map(),
    files = [];
  for (let i = 0; i < media.length; i++) {
    const item = media[i];
    if (
      typeof item.key !== 'string' ||
      map.has(item.key) ||
      !/^(?:local:|assets\/)/.test(item.key) ||
      typeof item.base64 !== 'string' ||
      !/^[a-z\d+/]*={0,2}$/i.test(item.base64) ||
      item.base64.length % 4 ||
      item.base64.length > 30 * 1024 * 1024
    )
      throw new Error('媒体条目无效或重复。');
    const name = `${i + 1}-${safe(item.key)}.${extensions[item.type] || 'bin'}`;
    map.set(item.key, `media/imported/${name}`);
    files.push({ name, bytes: Buffer.from(item.base64, 'base64') });
  }
  const required = references(data).filter((value) => /^(?:local:|assets\/)/.test(value));
  if (required.some((key) => !map.has(key) && !defaults.has(key)))
    throw new Error('备份缺少本地媒体，请先在旧浏览器重新导出完整备份。');
  const resolveMedia = (path) => map.get(path) || defaults.get(path) || path;
  const rewrite = (body) =>
    String(body || '').replace(
      /(!\[[^\]]*\]\()([^\s)]+)(\))/g,
      (_, start, path, end) =>
        start + (map.has(path) || defaults.has(path) ? '/' + resolveMedia(path) : path) + end,
    );
  const posts = data.posts.map((post, index) => {
    const valid =
      /^\d{4}-\d{2}-\d{2}$/.test(post.date || '') &&
      Number.isFinite(Date.parse(post.date)) &&
      new Date(post.date).toISOString().slice(0, 10) === post.date;
    if (!valid) throw new Error(`文章 ${post.title || index + 1} 的日期不正确。`);
    const meta = {
      title: String(post.title || '未命名文章'),
      description: String(
        post.excerpt ||
          String(post.body || '')
            .replace(/[#*`>]/g, '')
            .slice(0, 140) ||
          '一篇迁移的记录。',
      ).slice(0, 300),
      publishedAt: post.date,
      kind: ['代码', '技术'].includes(post.category) ? 'tech' : 'life',
      category: String(post.category || '迁移记录'),
      tags: Array.isArray(post.tags) ? post.tags.map(String) : [],
      draft: post.status !== 'published',
      demo: !!post.demo,
      featured: !!post.featured,
    };
    return {
      name: `import-${safe(post.id)}-${index + 1}.md`,
      text: `---\n${Object.entries(meta)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n')}\n---\n\n${rewrite(post.body)}\n`,
    };
  });
  // Validate everything before creating a fresh staging directory; never overwrite source.
  await mkdir(output);
  await mkdir(join(output, 'posts'));
  await mkdir(join(output, 'media'));
  for (const post of posts)
    await writeFile(join(output, 'posts', post.name), post.text, { flag: 'wx' });
  for (const file of files)
    await writeFile(join(output, 'media', file.name), file.bytes, { flag: 'wx' });
  const tracks = (data.tracks || []).map((track, index) => ({
    id: safe(track.id || `track-${index + 1}`),
    title: String(track.title || '未命名音乐'),
    artist: String(track.artist || '我的歌单'),
    src: resolveMedia(track.src),
    demo: false,
  }));
  for (const [name, value] of [
    ['music.json', tracks],
    ['notes.json', data.notes || []],
    ['site-settings.json', { ...data.site, avatar: resolveMedia(data.site.avatar) }],
    ['recycle-bin.json', raw.trash || []],
    ['media-map.json', Object.fromEntries(map)],
  ])
    await writeFile(join(output, name), JSON.stringify(value, null, 2));
  await writeFile(
    join(output, 'README.txt'),
    '本目录是迁移暂存结果，尚未发布。\n把 posts 中的文件合并到 src/content/posts/；把 media 中的文件复制到 public/media/imported/。\n检查 music.json 后合并到 src/data/music.json，notes.json 合并到随记清单。\nsite-settings.json 供人工填写 site.ts；recycle-bin.json 保留旧版回收站。\n保留原始 JSON 备份，不要覆盖它。迁移后先预览、检查，再提交。\n',
  );
  return { posts: posts.length, media: files.length, tracks: tracks.length, output };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const input = process.argv[2];
    if (!input) throw new Error('用法：npm run import:backup -- 完整备份.json 新暂存目录');
    console.log(
      await migrateBackup(resolve(input), resolve(process.argv[3] || 'migration-output')),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
