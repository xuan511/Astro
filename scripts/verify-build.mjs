import { readdir, readFile, stat, access, appendFile } from 'node:fs/promises';
import { resolve, relative, join, extname, sep, isAbsolute } from 'node:path';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { deployment } from './deployment.mjs';
import { isIndexablePath } from '../src/lib/indexing.mjs';
import { verifyPresentation } from './verify-presentation.mjs';

const root = resolve(process.env.VERIFY_DIST || 'dist');
const { site, base } = deployment();
async function walk(dir) {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.name === 'legacy') continue;
    const path = join(dir, item.name);
    result.push(...(item.isDirectory() ? await walk(path) : [path]));
  }
  return result;
}
const files = await walk(root),
  pages = files.filter((file) => file.endsWith('.html'));
assert(
  !files.some((file) => relative(root, file).split(sep).join('/') === 'music/paper-light.wav'),
  'Retired demo audio must not be republished in the main music directory',
);
const indexablePages = new Set();
const sitemapPages = new Set();
let links = 0,
  articles = 0,
  sitemapUrls = 0,
  rssItems = 0,
  mathPages = 0,
  highlightedPages = 0,
  jsGzip = 0,
  cssGzip = 0;
async function exists(url) {
  assert.equal(url.origin, new URL(site).origin, `Unexpected origin: ${url}`);
  assert(url.pathname.startsWith(base), `Missing base path: ${url}`);
  const decoded = decodeURIComponent(url.pathname.slice(base.length));
  const path = resolve(root, decoded);
  const inside = relative(root, path);
  assert(
    inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside),
    `Escaping path: ${url}`,
  );
  const target = await stat(path).catch(() => null);
  if (target?.isDirectory()) await access(join(path, 'index.html'));
  else assert(target?.isFile(), `Missing asset/page ${url.pathname}`);
}
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  const path = relative(root, file)
    .replace(/\\/g, '/')
    .replace(/index\.html$/, '');
  const url = new URL(base + path, site);
  const noindex = /<meta\b[^>]*name="robots"[^>]*content="[^"]*\bnoindex\b/.test(html);
  if (!isIndexablePath(url.pathname, base))
    assert(noindex, `Utility page must declare noindex: ${file}`);
  if (!noindex) indexablePages.add(url.href);
  assert.match(html, /<html[^>]+lang="zh-CN"/);
  const directories = [...html.matchAll(/<details\b[^>]*\bdata-site-directory\b[^>]*>/g)];
  assert.equal(directories.length, 1, `Expected one shared site directory: ${file}`);
  assert(!/\bopen(?:\s|>|=)/.test(directories[0][0]), `Site directory must start closed: ${file}`);
  assert(!html.includes('id="mobile-navigation"'), `Duplicate mobile navigation: ${file}`);
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `Expected one h1: ${file}`);
  const players = [...html.matchAll(/<section\b[^>]*\bid="persistent-player"[^>]*>/g)];
  assert.equal(players.length, 1, `Expected one persistent player: ${file}`);
  assert.match(
    players[0][0],
    /\bdata-astro-transition-persist="shijian-player"/,
    `Player persistence missing: ${file}`,
  );
  const audios = [...html.matchAll(/<audio\b[^>]*>/g)];
  const appearance = [...html.matchAll(/<div\b[^>]*\bid="site-appearance"[^>]*>/g)];
  assert.equal(appearance.length, 1, `Expected one appearance controller: ${file}`);
  assert.match(appearance[0][0], /\bdata-astro-transition-persist="shijian-appearance"/);
  assert.equal((html.match(/\bid="appearance-settings"/g) || []).length, 1);
  assert.equal(
    (html.match(/\bclass="site-layout shell"/g) || []).length,
    1,
    `Shared column shell missing: ${file}`,
  );
  assert.equal((html.match(/\bclass="layout-sidebar sidebar-left"/g) || []).length, 1);
  assert.equal((html.match(/\bclass="layout-sidebar sidebar-right"/g) || []).length, 1);
  const displayConfig = html.match(
    /<script\b[^>]*\bdata-display-config\b[^>]*>([\s\S]*?)<\/script>/,
  );
  assert(displayConfig, `Missing validated display configuration: ${file}`);
  const display = JSON.parse(displayConfig[1]);
  assert(['both', 'left', 'right', 'none'].includes(display.defaults.sidebar));
  assert(['grid', 'list', 'masonry'].includes(display.defaults.layout));
  assert(display.fonts.some((font) => font.id === display.defaults.font));
  if (path === '') {
    assert.equal(
      (html.match(/\bdata-post-feed(?:\s|>|=)/g) || []).length,
      1,
      'Home shared post feed missing',
    );
    assert.match(html, /\bdata-home-dashboard\b/);
  }
  const companions = [...html.matchAll(/<aside\b[^>]*\bid="site-companion"[^>]*>/g)];
  assert.equal(companions.length, 1, `Expected one companion: ${file}`);
  assert.match(companions[0][0], /\bdata-astro-transition-persist="shijian-companion"/);
  assert(/\bhidden(?:\s|>|=)/.test(companions[0][0]), `Companion needs a no-JS fallback: ${file}`);
  assert.match(html, /\bdata-companion-show\b/);
  const companionCatalog = html.match(
    /<script\b[^>]*\bdata-companion-catalog\b[^>]*>([\s\S]*?)<\/script>/,
  );
  assert(companionCatalog, `Missing companion catalog: ${file}`);
  const choices = JSON.parse(companionCatalog[1]);
  assert(choices.length > 0);
  assert.equal(new Set(choices.map((item) => item.id)).size, choices.length);
  assert.equal((html.match(/\bdata-companion-choice=/g) || []).length, choices.length);
  for (const companion of choices) await exists(new URL(companion.image, site));
  assert.equal(audios.length, 1, `Expected one audio element: ${file}`);
  assert.match(audios[0][0], /\bid="journal-audio"/);
  assert(
    !/\bautoplay(?:\s|>|=)/.test(audios[0][0]),
    `Initial playback must require user action: ${file}`,
  );
  assert.match(html, /<meta name="description" content="[^"]+"/);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
  assert(canonical, `Missing canonical: ${file}`);
  assert.equal(new URL(canonical[1]).href, url.href, `Incorrect canonical: ${file}`);
  assert(
    html.includes(`<meta property="og:url" content="${url.href}"`),
    `Incorrect OG URL: ${file}`,
  );
  let articlePage = false;
  for (const match of html.matchAll(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    const structured = JSON.parse(match[1]);
    if (structured['@type'] === 'BlogPosting') {
      articlePage = true;
      articles++;
      assert.equal(structured.mainEntityOfPage, url.href, `Incorrect article URL: ${file}`);
      assert(
        Number.isFinite(Date.parse(structured.datePublished)),
        `Invalid publication date: ${file}`,
      );
      assert(
        Number.isFinite(Date.parse(structured.dateModified)),
        `Invalid modification date: ${file}`,
      );
    }
  }
  verifyPresentation(html, { article: articlePage, label: file });
  if (/class="[^\"]*katex/.test(html)) mathPages++;
  if (html.includes('astro-code')) highlightedPages++;
  assert(!html.includes('PRIVATE-DRAFT-NEVER-PUBLISH-SENTINEL'), `Draft exposed: ${file}`);
  for (const trigger of html.matchAll(/<button\b[^>]*\bdata-project-preview-open\b[^>]*>/g)) {
    const id = trigger[0].match(/\baria-controls="([^"]+)"/)?.[1];
    assert(id, `Project preview has no target: ${file}`);
    const dialogs = [...html.matchAll(/<dialog\b[^>]*>/g)].filter(
      ([tag]) => tag.match(/\bid="([^"]+)"/)?.[1] === id,
    );
    assert.equal(dialogs.length, 1, `Project preview target must be unique: ${id} in ${file}`);
    const titleId = dialogs[0][0].match(/\baria-labelledby="([^"]+)"/)?.[1];
    assert(titleId, `Project preview has no accessible title: ${id} in ${file}`);
    assert.equal(
      [...html.matchAll(/\bid="([^"]+)"/g)].filter((match) => match[1] === titleId).length,
      1,
      `Project preview title must exist and be unique: ${titleId} in ${file}`,
    );
    assert(/\bhidden(?:\s|>|=)/.test(trigger[0]), `Preview needs a no-JS fallback: ${file}`);
  }
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const raw = match[1].replace(/&amp;/g, '&');
    if (raw.startsWith('#') || /^(?:data:|mailto:|tel:)/i.test(raw)) continue;
    const target = new URL(raw, url);
    if (target.origin !== new URL(site).origin) continue;
    assert(target.pathname.startsWith(base), `Missing base path ${raw} in ${file}`);
    await exists(target);
    links++;
  }
}
for (const file of files) {
  const ext = extname(file);
  const assetPath = relative(root, file).split(sep).join('/');
  if (['.js', '.css', '.json', '.xml', '.html'].includes(ext))
    assert(
      !(await readFile(file, 'utf8')).includes('PRIVATE-DRAFT-NEVER-PUBLISH-SENTINEL'),
      `Draft leaked: ${file}`,
    );
  if (assetPath.startsWith('_astro/') && ext === '.js')
    jsGzip += gzipSync(await readFile(file)).length;
  if (assetPath.startsWith('_astro/') && ext === '.css') {
    const css = await readFile(file, 'utf8');
    cssGzip += gzipSync(css).length;
    const url = new URL(base + assetPath, site);
    for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (match[1].startsWith('data:')) continue;
      const target = new URL(match[1], url);
      if (target.origin === new URL(site).origin) {
        await exists(target);
        links++;
      }
    }
  }
}
for (const name of [
  '404.html',
  'rss.xml',
  'sitemap-index.xml',
  'sitemap-0.xml',
  'robots.txt',
  '.nojekyll',
  'search.json',
])
  await access(join(root, name));
const search = JSON.parse(await readFile(join(root, 'search.json'), 'utf8'));
assert(search.every((row) => !row.id.includes('draft-template')));
for (const row of search) await exists(new URL(row.url, site));
assert.equal(
  articles,
  search.filter((row) => row.kind !== 'project').length,
  'Article/search mismatch',
);
// Validate the content that is actually published; examples may be removed.
for (const name of ['sitemap-index.xml', 'sitemap-0.xml']) {
  const xml = await readFile(join(root, name), 'utf8');
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = new URL(match[1].replace(/&amp;/g, '&'));
    if (name === 'sitemap-0.xml') {
      assert(isIndexablePath(url.pathname, base), `Utility page must not enter sitemap: ${url}`);
      assert(indexablePages.has(url.href), `Sitemap target is missing or declares noindex: ${url}`);
      sitemapPages.add(url.href);
    }
    await exists(url);
    sitemapUrls++;
  }
}
const rss = await readFile(join(root, 'rss.xml'), 'utf8');
assert.deepEqual(sitemapPages, indexablePages, 'Sitemap must match the indexable HTML pages');
const feedLinks = [...rss.matchAll(/<link>([^<]+)<\/link>/g)].map((match) =>
  match[1].replace(/&amp;/g, '&'),
);
assert.equal(feedLinks[0], new URL(base, site).href, 'RSS channel must point to this blog');
for (const href of feedLinks) await exists(new URL(href));
rssItems = (rss.match(/<item>/g) || []).length;
assert.equal(rssItems, articles, 'Article/RSS mismatch');
const robots = await readFile(join(root, 'robots.txt'), 'utf8');
assert(robots.includes(`Sitemap: ${new URL(base + 'sitemap-index.xml', site).href}`));
const notFound = await readFile(join(root, '404.html'), 'utf8');
assert.match(notFound, /<meta name="robots" content="noindex,follow"/);
const tracks = JSON.parse(await readFile('src/data/music.json', 'utf8'));
for (const track of tracks)
  for (const path of [track.src, track.cover].filter(Boolean)) {
    if (!/^https?:\/\//.test(path)) await exists(new URL(base + path, site));
  }
assert(jsGzip < 60_000, `Main JS budget exceeded: ${jsGzip}`);
assert(cssGzip < 45_000, `Main CSS budget exceeded: ${cssGzip}`);
const report = {
  base,
  pages: pages.length,
  localLinksChecked: links,
  searchEntries: search.length,
  articles,
  sitemapUrlsChecked: sitemapUrls,
  rssItems,
  mathPages,
  highlightedPages,
  allMainJavaScriptGzip: jsGzip,
  allMainStylesGzip: cssGzip,
  draftIsolation: 'passed',
  canonicalRssSitemap: 'passed',
};
console.log(JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## Pages 构建检查',
      '',
      `目标：${site}${base}`,
      '',
      '| 检查 | 结果 |',
      '| --- | --- |',
      `| 静态页面 | ${pages.length} |`,
      `| 页面、资源与字体引用 | ${links} |`,
      `| 公开文章 / RSS | ${articles} / ${rssItems} |`,
      `| JS / CSS gzip 估算 | ${jsGzip} B / ${cssGzip} B |`,
      '| Canonical、Sitemap、草稿隔离 | 通过 |',
      '',
      '构建检查不等于正式部署成功，也不代表 Lighthouse 实测分数。',
      '',
    ].join('\n'),
  );
}
