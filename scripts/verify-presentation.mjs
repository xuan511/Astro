import assert from 'node:assert/strict';

const voidTags = new Set(
  'area base br col embed hr img input link meta param source track wbr'.split(' '),
);
const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
const decodeAttribute = (value) =>
  value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (match, entity) => {
    if (entity[0] !== '#') return entities[entity.toLowerCase()];
    const number =
      entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : match;
  });

// Inspect Astro's already-compiled HTML. Raw scripts/styles and comments are not DOM elements.
function elements(html, label) {
  const nodes = [],
    stack = [];
  const tags =
    /<!--[\s\S]*?-->|<![^>]*>|<\/?([a-z][\w:-]*)(?:\s+(?:[^<>"']|"[^"]*"|'[^']*')*)?\s*\/?>/gi;
  let match,
    end = 0;
  while ((match = tags.exec(html))) {
    assert(!html.slice(end, match.index).includes('<'), `Unsupported compiled HTML tag: ${label}`);
    end = tags.lastIndex;
    const raw = match[0],
      tag = match[1]?.toLowerCase();
    if (!tag) continue;
    if (raw.startsWith('</')) {
      const index = stack.findLastIndex((node) => node.tag === tag);
      if (index >= 0) stack.length = index;
      continue;
    }
    const attributes = new Map();
    const body = raw.replace(/^<[\w:-]+/, '').replace(/\/?>$/, '');
    for (const attribute of body.matchAll(
      /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
    )) {
      attributes.set(
        attribute[1].toLowerCase(),
        decodeAttribute(attribute[2] ?? attribute[3] ?? attribute[4] ?? ''),
      );
    }
    const node = { tag, attributes, parent: stack.at(-1) };
    nodes.push(node);
    if (tag === 'script' || tag === 'style') {
      const closing = new RegExp(`</${tag}\\s*>`, 'gi');
      closing.lastIndex = tags.lastIndex;
      assert(closing.exec(html), `Unclosed raw-text element: ${label}`);
      tags.lastIndex = closing.lastIndex;
      end = tags.lastIndex;
    } else if (!voidTags.has(tag) && !/\/\s*>$/.test(raw)) stack.push(node);
  }
  assert(!html.slice(end).includes('<'), `Unsupported compiled HTML tag: ${label}`);
  return nodes;
}
const hasClass = (node, name) => (node.attributes.get('class') || '').split(/\s+/).includes(name);
function inside(node, ancestor) {
  for (let current = node; current; current = current.parent) if (current === ancestor) return true;
  return false;
}

/** Validate rendered presentation contracts, independent of CSS values or content counts. */
export function verifyPresentation(html, { article = false, label = 'page' } = {}) {
  const nodes = elements(html, label);
  const only = (matches, description) => {
    assert.equal(matches.length, 1, `${description} must be unique: ${label}`);
    return matches[0];
  };
  let tocLinks = 0;
  if (article) {
    const reading = only(
      nodes.filter((node) => node.attributes.has('data-reading-article')),
      'Reading article',
    );
    assert.equal(reading.tag, 'article', `Reading root must remain an article: ${label}`);
    const byId = (id) =>
      only(
        nodes.filter((node) => node.attributes.get('id') === id),
        `#${id}`,
      );
    const content = byId('article-content'),
      title = byId('article-title');
    byId('reading-progress');
    assert.equal(title.tag, 'h1', `Article title must remain h1: ${label}`);
    assert(
      inside(content, reading) && inside(title, reading),
      `Reading content/title must belong to the article: ${label}`,
    );
    for (const hook of [
      'data-reading-smaller',
      'data-reading-larger',
      'data-reading-width',
      'data-copy-article',
      'data-reading-size-label',
      'data-reading-feedback',
    ]) {
      const control = only(
        nodes.filter((node) => node.attributes.has(hook)),
        hook,
      );
      assert(inside(control, reading), `${hook} must belong to the article: ${label}`);
      if (hook !== 'data-reading-size-label' && hook !== 'data-reading-feedback')
        assert.equal(control.tag, 'button', `${hook} must remain a button: ${label}`);
    }
    const desktop = nodes.filter((node) => node.tag === 'nav' && hasClass(node, 'toc'));
    const mobile = nodes.filter(
      (node) =>
        node.tag === 'nav' &&
        nodes.some((parent) => hasClass(parent, 'mobile-toc') && inside(node, parent)),
    );
    assert(desktop.length <= 1 && mobile.length <= 1, `TOC surfaces must be unique: ${label}`);
    const sequence = (nav) => {
      if (!nav) return [];
      return nodes
        .filter((node) => node.tag === 'a' && inside(node, nav))
        .map((link) => {
          assert(
            link.attributes.has('data-toc-link'),
            `TOC anchor is missing its reading hook: ${label}`,
          );
          const href = link.attributes.get('href') || '';
          assert(
            href.startsWith('#') && href.length > 1,
            `TOC must link to a section fragment: ${label}`,
          );
          let id;
          try {
            id = decodeURIComponent(href.slice(1));
          } catch {
            assert.fail(`Invalid TOC fragment encoding: ${label}`);
          }
          const target = byId(id);
          assert(
            ['h2', 'h3'].includes(target.tag) && inside(target, content),
            `TOC target must be an article h2/h3: #${id} in ${label}`,
          );
          return id;
        });
    };
    const desktopIds = sequence(desktop[0]),
      mobileIds = sequence(mobile[0]);
    assert.deepEqual(mobileIds, desktopIds, `Mobile and desktop TOC order must match: ${label}`);
    if (desktopIds.length)
      assert.equal(desktop.length + mobile.length, 2, `Both TOC surfaces must exist: ${label}`);
    const unowned = nodes.filter(
      (node) =>
        node.attributes.has('data-toc-link') &&
        ![...desktop, ...mobile].some((nav) => inside(node, nav)),
    );
    assert.equal(unowned.length, 0, `TOC links must belong to a TOC surface: ${label}`);
    tocLinks = desktopIds.length;
  }
  const cards = nodes.filter((node) => node.tag === 'article' && hasClass(node, 'post-card'));
  for (const card of cards) {
    const title = only(
      nodes.filter((node) => hasClass(node, 'post-card-title') && inside(node, card)),
      'Post card title',
    );
    const inIndex = nodes.some((node) => hasClass(node, 'post-index') && inside(card, node));
    assert(
      inIndex ? title.tag === 'h2' : ['h2', 'h3'].includes(title.tag),
      `Post card heading level is incorrect${inIndex ? ' in PostIndex (expected h2)' : ''}: ${label}`,
    );
    const featured = hasClass(card, 'featured'),
      cover = hasClass(card, 'has-cover');
    const art = nodes.filter((node) => hasClass(node, 'featured-art') && inside(node, card));
    assert(!cover || featured, `Only featured cards may declare a cover: ${label}`);
    assert.equal(
      art.length,
      cover ? 1 : 0,
      `Featured cover state must match its rendered art: ${label}`,
    );
    if (cover)
      assert(
        nodes.some((node) => node.tag === 'img' && inside(node, art[0])),
        `Featured art must contain its actual image: ${label}`,
      );
  }
  return { article: Boolean(article), postCards: cards.length, tocLinks };
}
