import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPresentation } from '../scripts/verify-presentation.mjs';

const article = `
<script>const example = '<div id="article-content"></div>';</script>
<!-- <h1 id="article-title">not rendered</h1> -->
<div id="reading-progress"></div>
<article data-reading-article>
  <h1 id="article-title">一篇真实结构的文章</h1>
  <div class="reading-controls">
    <button data-reading-smaller>A−</button>
    <button data-reading-larger>A＋</button>
    <button data-reading-width>宽屏阅读</button>
    <button data-copy-article>复制链接</button>
    <output data-reading-size-label>标准</output>
    <span data-reading-feedback></span>
  </div>
  <details class="mobile-toc"><summary>目录</summary><nav>
    <a href="#start" data-toc-link>开始</a>
    <a href="#%E7%BB%86%E8%8A%82" data-toc-link>细节</a>
  </nav></details>
  <div id="article-content">
    <h2 id="start">开始</h2><p>正文</p>
    <h3 id="细节">细节</h3>
  </div>
</article>
<aside class="article-sidebar"><nav class="toc">
  <a href="#start" data-toc-link>开始</a>
  <a href="#细节" data-toc-link>细节</a>
</nav></aside>`;
const inspectArticle = (html) =>
  verifyPresentation(html, { article: true, label: 'fixture article' });

test('rendered articles retain reading contracts and matching encoded/unencoded section links; TOC is optional', () => {
  assert.deepEqual(inspectArticle(article), { article: true, postCards: 0, tocLinks: 2 });
  const withoutToc = article
    .replace(/<details[\s\S]*?<\/details>/, '')
    .replace(/<aside[\s\S]*?<\/aside>/, '');
  assert.equal(inspectArticle(withoutToc).tocLinks, 0);
});

test('losing or duplicating a reading root, stable ID, or control hook fails the actual artifact check', () => {
  for (const id of ['article-title', 'article-content', 'reading-progress']) {
    assert.throws(() => inspectArticle(article.replaceAll(`id="${id}"`, '')), /must be unique/);
    assert.throws(() => inspectArticle(article + `<div id="${id}"></div>`), /must be unique/);
  }
  for (const hook of [
    'data-reading-article',
    'data-reading-smaller',
    'data-reading-larger',
    'data-reading-width',
    'data-copy-article',
    'data-reading-size-label',
    'data-reading-feedback',
  ]) {
    assert.throws(() => inspectArticle(article.replace(hook, 'data-removed')), /must be unique/);
    assert.throws(() => inspectArticle(article + `<span ${hook}></span>`), /must be unique/);
  }
  assert.throws(
    () =>
      inspectArticle(
        article
          .replaceAll('<h1 id="article-title">', '<h2 id="article-title">')
          .replaceAll('</h1>', '</h2>'),
      ),
    /must remain h1/,
  );
});

test('TOC fragments must reach a unique h2/h3 inside the article, including Chinese IDs', () => {
  assert.throws(
    () => inspectArticle(article.replace('id="细节"', 'id="moved"')),
    /#细节 must be unique/,
  );
  assert.throws(
    () => inspectArticle(article + '<h3 id="细节">重复目标</h3>'),
    /#细节 must be unique/,
  );
  assert.throws(
    () => inspectArticle(article.replace('<h3 id="细节">细节</h3>', '<h4 id="细节">跳级</h4>')),
    /must be an article h2\/h3/,
  );
  assert.throws(
    () =>
      inspectArticle(article.replace('<h3 id="细节">细节</h3>', '') + '<h3 id="细节">正文外</h3>'),
    /must be an article h2\/h3/,
  );
  assert.throws(
    () => inspectArticle(article.replace('href="#start"', 'href="#bad%ZZ"')),
    /Invalid TOC fragment encoding/,
  );
});

test('mobile and desktop TOC order and reading hooks cannot silently drift apart', () => {
  const changedOrder = article.replace(
    '<a href="#start" data-toc-link>开始</a>\n    <a href="#%E7%BB%86%E8%8A%82" data-toc-link>细节</a>',
    '<a href="#%E7%BB%86%E8%8A%82" data-toc-link>细节</a><a href="#start" data-toc-link>开始</a>',
  );
  assert.throws(() => inspectArticle(changedOrder), /TOC order must match/);
  assert.throws(
    () => inspectArticle(article.replace('data-toc-link', '')),
    /missing its reading hook/,
  );
  assert.throws(
    () => inspectArticle(article.replace(/<aside[\s\S]*?<\/aside>/, '')),
    /TOC order must match/,
  );
});

test('PostIndex uses h2 card titles, home accepts h3, and featured images match their declared cover state', () => {
  const card = '<article class="post-card"><h2 class="post-card-title">文章</h2></article>';
  assert.equal(verifyPresentation(`<div class="post-index">${card}</div>`).postCards, 1);
  const h3Card = card.replaceAll('h2', 'h3');
  assert.equal(verifyPresentation(`<section>${h3Card}</section>`).postCards, 1);
  assert.throws(
    () => verifyPresentation(`<div class="post-index">${h3Card}</div>`),
    /PostIndex \(expected h2\)/,
  );
  assert.throws(() => verifyPresentation(card.replaceAll('h2', 'h4')), /heading level/);
  const featured = card.replace('post-card"', 'post-card featured"');
  assert.equal(verifyPresentation(featured).postCards, 1, 'a real cover is optional');
  const withCover = featured
    .replace('featured"', 'featured has-cover"')
    .replace(
      '</article>',
      '<div class="featured-art"><picture><img src="/images/actual.webp"></picture></div></article>',
    );
  assert.equal(verifyPresentation(withCover).postCards, 1);
  assert.throws(
    () => verifyPresentation(featured.replace('featured"', 'featured has-cover"')),
    /cover state/,
  );
  assert.throws(() => verifyPresentation(withCover.replace(' has-cover', '')), /cover state/);
  assert.throws(
    () => verifyPresentation(withCover.replace('<img src="/images/actual.webp">', '')),
    /actual image/,
  );
});
