import test from 'node:test';
import assert from 'node:assert/strict';
import { validateArchitecture } from '../scripts/check-architecture.mjs';

const entry = 'src/scripts/main.ts';

test('client boundary follows shared modules and reports transitive server leaks with an import chain', () => {
  const result = validateArchitecture({
    [entry]: "import { load } from '../lib/shared'; load();",
    'src/lib/shared.ts': "export { getCollection as load } from 'astro:content';",
  });
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0].message, /服务端模块：astro:content/);
  assert.deepEqual(result.violations[0].chain, [entry, 'src/lib/shared.ts', 'astro:content']);
});

test('type-only imports and re-exports can reference build types without creating runtime dependencies', () => {
  const result = validateArchitecture({
    [entry]: `import type { CollectionEntry } from 'astro:content';
      import { type Track } from '../lib/music';
      export type { SiteConfig } from '../config/site';
      export { type OtherType } from '../data/model';
      type Server = import('astro:content').CollectionEntry<'posts'>;
      import { value } from '../lib/value.js';
      console.log(value);`,
    'src/lib/value.ts': 'export const value = 1;',
  });
  assert.deepEqual(result.violations, []);
  assert.equal(result.modules, 2);
});

test('mixed imports and dynamic imports still enforce the runtime boundary', () => {
  for (const source of [
    "import { type Something, getCollection } from 'astro:content';",
    "const load = () => import('../lib/server');",
  ]) {
    const result = validateArchitecture({
      [entry]: source,
      'src/lib/server.ts': "export { readFile } from 'node:fs/promises';",
    });
    assert.equal(result.violations.length, 1);
    assert.match(result.violations[0].message, /服务端模块/);
  }
});

test('client scripts reject build directories and the content/music collection adapters', () => {
  for (const path of [
    'src/lib/content.ts',
    'src/lib/music.ts',
    'src/config/site.ts',
    'src/data/value.ts',
    'src/pages/value.ts',
    'src/layouts/Value.astro',
    'src/content/value.mdx',
  ]) {
    const result = validateArchitecture({ [entry]: `import '/${path}';`, [path]: 'export {};' });
    assert.equal(result.violations.length, 1, path);
    assert.match(result.violations[0].message, /构建侧路径/);
  }
  for (const name of [
    'fs/promises',
    'astro:assets',
    'astro:config',
    'astro:env/server',
    'astro/zod',
  ]) {
    const result = validateArchitecture({ [entry]: `import '${name}';` });
    assert.equal(result.violations.length, 1, name);
    assert.match(result.violations[0].message, /服务端模块/);
  }
});

test('unresolved, non-literal, unsupported and syntactically invalid imports fail explicitly', () => {
  for (const [source, message, extra] of [
    ["import '../lib/missing';", /无法解析本地导入/],
    ['import(moduleName);', /必须使用固定字符串/],
    ["import '@/lib/shared';", /不支持解析/],
    ["import '../lib/model.json';", /不支持解析此客户端源码类型/, { 'src/lib/model.json': '{}' }],
    ["import '../lib/value.ts?raw';", /不支持解析带查询/],
    ["import '../lib/value';", /源码无法解析/, { 'src/lib/value.ts': 'export const = ;' }],
    ["const files = import.meta.glob('../lib/*.ts');", /不支持 import.meta.glob/],
    ["const fs = require('fs');", /不支持 require/],
  ]) {
    const result = validateArchitecture({ [entry]: source, ...extra });
    assert(
      result.violations.some((violation) => message.test(violation.message)),
      source,
    );
  }
});

test('all script entries are inspected, shared cycles terminate, and browser modules remain allowed', () => {
  const result = validateArchitecture(
    new Map([
      [
        entry,
        "import '../lib/a'; import 'astro:transitions/client'; import 'some-browser-package';",
      ],
      ['src/scripts/another.ts', "import '../lib/a';"],
      ['src/lib/a.ts', "export * from './b';"],
      ['src/lib/b/index.ts', "export * from '../a';"],
      ['src/scripts/types.d.ts', "import type { SiteConfig } from '../config/site';"],
      ['src/lib/unreachable.ts', "import 'node:fs';"],
    ]),
  );
  assert.deepEqual(result.violations, []);
  assert.equal(result.entrypoints, 2);
  assert.equal(result.modules, 4);
  assert.equal(validateArchitecture({}).violations.length, 1);
});

test('Astro component scripts enter the same dependency graph while frontmatter remains build-side', () => {
  const file = 'src/layouts/Base.astro';
  const result = validateArchitecture({
    [file]: `---
import { site } from '../config/site';
const example = '<script>not an actual script</script>';
---
<script>
  import '../scripts/site';
</script>`,
    'src/scripts/site.ts': "import '../lib/shared';",
    'src/lib/shared.ts': "export { readFile } from 'node:fs';",
  });
  assert.equal(result.violations.length, 1);
  assert.deepEqual(result.violations[0].chain, [
    `${file}#script:1`,
    'src/scripts/site.ts',
    'src/lib/shared.ts',
    'node:fs',
  ]);
});

test('inline Astro imports cannot bypass build directories and report real component line numbers', () => {
  const file = 'src/components/Card.astro';
  const result = validateArchitecture({
    [file]: `---
import data from '../data/music.json';
---
<div>内容</div>
<script>
  import '../data/music.json';
</script>`,
    'src/data/music.json': '[]',
  });
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].file, file);
  assert.equal(result.violations[0].line, 6);
  assert.match(result.violations[0].message, /构建侧路径/);
  const types = validateArchitecture({
    [file]: `<script>
import type { SiteConfig } from '../config/site';
import { type Track } from '../lib/music';
</script>`,
  });
  assert.deepEqual(types.violations, []);
});

test('JSON, comments, style content and self-closing bootstrap tags cannot swallow the next script', () => {
  const file = 'src/components/Card.astro';
  const result = validateArchitecture({
    [file]: String.raw`---
const sample = '<script src="not-a-real-source" />';
---
<!-- <script src="not-a-real-source" /> -->
{/* <script src="not-a-real-source" /> */}
<div data-example="<script>not a real tag</script>"></div>
<style>.sample::after { content: '<script>not a script</script>'; }</style>
<script type="application/json">{"data": "this is not JavaScript: import bad"}</script>
<script type="application/ld+json" set:html={JSON.stringify(data).replace(/</g, '\u003c')} />
<script is:inline set:html={bootstrap({ nested: { pattern: /}/g, text: '/>' } })} />
<script>
  import '../lib/browser';
</script>`,
    'src/lib/browser.ts': "import type { SiteConfig } from '../config/site'; export {};",
  });
  assert.deepEqual(result.violations, []);
  assert.equal(result.entrypoints, 1);
  assert.equal(result.modules, 2);
});

test('static Astro script src is traversed and expression or external src fails explicitly', () => {
  const file = 'src/components/Card.astro';
  for (const src of ['../lib/browser.ts', '/src/lib/browser.ts']) {
    const result = validateArchitecture({
      [file]: `<script src="${src}" />`,
      'src/lib/browser.ts': "import 'astro:content';",
    });
    assert.equal(result.violations.length, 1);
    assert.match(result.violations[0].message, /服务端模块/);
  }
  for (const [source, message] of [
    ['<script src={source} />', /src 必须是非空静态字符串/],
    ['<script src="https://example.org/script.js" />', /不支持解析外部 script src/],
    ['<script src="../lib/missing.ts" />', /无法解析本地导入/],
    ['<script type={scriptType}>console.log(1);</script>', /type 必须是静态值/],
    ['<script {...attributes}>console.log(1);</script>', /不支持分析 script 的展开属性/],
  ]) {
    const result = validateArchitecture({ [file]: source });
    assert(
      result.violations.some((violation) => message.test(violation.message)),
      source,
    );
  }
});

test('malformed Astro scripts and inline dynamic imports report explicit failures at source lines', () => {
  const file = 'src/components/Card.astro';
  for (const [source, message] of [
    ['---\nconst x = 1;', /frontmatter 未闭合/],
    ['<script>console.log(1);', /缺少结束标签/],
    ['<script src={source />', /未闭合的表达式/],
    ['<script>const = ;</script>', /源码无法解析/],
  ]) {
    const result = validateArchitecture({ [file]: source });
    assert(
      result.violations.some((violation) => message.test(violation.message)),
      source,
    );
  }
  const result = validateArchitecture({
    [file]: '<div>text</div>\n<script>\n  import("node:fs");\n</script>',
  });
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0].file, file);
  assert.equal(result.violations[0].line, 3);
  assert.match(result.violations[0].message, /服务端模块/);
});
