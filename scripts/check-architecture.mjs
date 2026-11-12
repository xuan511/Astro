import { readdir, readFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { resolve, relative, posix, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.cjs', '.cts']);
const browserVirtualModules = new Set(['astro:transitions/client', 'astro:prefetch']);
const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
const isDeclaration = (path) => /\.d\.[cm]?ts$/.test(path);
const isSource = (path) => sourceExtensions.has(extname(path)) && !isDeclaration(path);
const allowedClientPath = (path) =>
  (path.startsWith('src/scripts/') || path.startsWith('src/lib/')) &&
  !/^src\/lib\/(?:content|music)\.[cm]?[jt]s$/.test(path);

function runtimeImport(node) {
  if (!node.importClause) return true;
  const clause = node.importClause;
  if (clause.isTypeOnly) return false;
  if (clause.name || !clause.namedBindings || ts.isNamespaceImport(clause.namedBindings))
    return true;
  const names = clause.namedBindings.elements;
  return names.length === 0 || names.some((name) => !name.isTypeOnly);
}

function runtimeExport(node) {
  if (node.isTypeOnly) return false;
  if (!node.exportClause || !ts.isNamedExports(node.exportClause)) return true;
  const names = node.exportClause.elements;
  return names.length === 0 || names.some((name) => !name.isTypeOnly);
}

function localTarget(importer, specifier, files) {
  const path = posix.normalize(
    specifier.startsWith('/')
      ? specifier.slice(1)
      : specifier.startsWith('src/')
        ? specifier
        : posix.join(posix.dirname(importer), specifier),
  );
  const suffix = extname(path);
  const candidates = [path];
  if (!suffix) {
    for (const extension of sourceExtensions) candidates.push(path + extension);
    for (const extension of sourceExtensions) candidates.push(`${path}/index${extension}`);
  } else {
    const replacement = { '.js': ['.ts', '.tsx'], '.mjs': ['.mts'], '.cjs': ['.cts'] }[suffix];
    for (const extension of replacement || [])
      candidates.push(path.slice(0, -suffix.length) + extension);
  }
  return candidates.find((candidate) => files.has(candidate));
}

const sourceLine = (source, offset) => source.slice(0, offset).split('\n').length;
function syntaxIssue(message, offset) {
  throw Object.assign(new Error(message), { offset });
}

function quotedEnd(source, start) {
  const quote = source[start];
  for (let cursor = start + 1; cursor < source.length; cursor++) {
    if (source[cursor] === '\\') cursor++;
    else if (source[cursor] === quote) return cursor + 1;
    else if (quote === '`' && source.startsWith('${', cursor)) {
      cursor = expressionEnd(source, cursor + 1) - 1;
    }
  }
  syntaxIssue('Astro 标签属性中存在未闭合的字符串。', start);
}

function expressionEnd(source, start) {
  let depth = 0;
  let previous = '';
  for (let cursor = start; cursor < source.length; cursor++) {
    const character = source[cursor];
    if (['"', "'", '`'].includes(character)) {
      cursor = quotedEnd(source, cursor) - 1;
      previous = 'value';
      continue;
    }
    if (source.startsWith('//', cursor)) {
      const end = source.indexOf('\n', cursor + 2);
      cursor = end < 0 ? source.length : end;
      continue;
    }
    if (source.startsWith('/*', cursor)) {
      const end = source.indexOf('*/', cursor + 2);
      if (end < 0) syntaxIssue('Astro 标签属性中存在未闭合的注释。', cursor);
      cursor = end + 1;
      continue;
    }
    if (character === '/' && previous.length === 1 && '([{=:,!&|?;>'.includes(previous)) {
      let inClass = false;
      let end = cursor + 1;
      for (; end < source.length; end++) {
        if (source[end] === '\\') end++;
        else if (source[end] === '[') inClass = true;
        else if (source[end] === ']') inClass = false;
        else if (source[end] === '/' && !inClass) break;
      }
      if (end === source.length) syntaxIssue('Astro 标签属性中存在未闭合的正则。', cursor);
      cursor = end;
      previous = 'value';
      continue;
    }
    if (character === '{') depth++;
    if (character === '}' && --depth === 0) return cursor + 1;
    // Only closing braces change depth; other punctuation remains significant for regex literals.
    if (character !== '}' && !/\s/.test(character)) previous = character;
  }
  syntaxIssue('Astro 标签属性中存在未闭合的表达式。', start);
}

function openingTag(source, start) {
  const match = /^<\/?([a-z][\w:.-]*)/i.exec(source.slice(start));
  if (!match) return null;
  const attributes = [];
  let cursor = start + match[0].length;
  while (cursor < source.length) {
    while (/\s/.test(source[cursor])) cursor++;
    if (source.startsWith('/>', cursor)) {
      return { name: match[1].toLowerCase(), end: cursor + 2, selfClosing: true, attributes };
    }
    if (source[cursor] === '>') {
      return { name: match[1].toLowerCase(), end: cursor + 1, selfClosing: false, attributes };
    }
    if (source[cursor] === '{') {
      const end = expressionEnd(source, cursor);
      attributes.push({ name: null, kind: 'expression', start: cursor });
      cursor = end;
      continue;
    }
    const name = /^[^\s=<>/{}]+/.exec(source.slice(cursor))?.[0];
    if (!name) syntaxIssue('无法解析 Astro 标签属性。', cursor);
    const attribute = { name: name.toLowerCase(), start: cursor, kind: 'boolean', value: '' };
    cursor += name.length;
    while (/\s/.test(source[cursor])) cursor++;
    if (source[cursor] === '=') {
      cursor++;
      while (/\s/.test(source[cursor])) cursor++;
      if (['"', "'"].includes(source[cursor])) {
        const end = quotedEnd(source, cursor);
        attribute.kind = 'literal';
        attribute.value = source.slice(cursor + 1, end - 1);
        cursor = end;
      } else if (source[cursor] === '{') {
        attribute.kind = 'expression';
        cursor = expressionEnd(source, cursor);
      } else {
        const beginning = cursor;
        while (
          cursor < source.length &&
          !/[\s>]/.test(source[cursor]) &&
          !source.startsWith('/>', cursor)
        )
          cursor++;
        if (cursor === beginning) syntaxIssue('Astro 标签属性缺少值。', cursor);
        attribute.kind = 'literal';
        attribute.value = source.slice(beginning, cursor);
      }
    }
    attributes.push(attribute);
  }
  syntaxIssue('Astro 标签未闭合。', start);
}

function astroScripts(file, source) {
  const units = [];
  const errors = [];
  let cursor = 0;
  let index = 0;
  try {
    const frontmatter = /^\uFEFF?---[ \t]*(?:\r?\n|$)/.exec(source);
    if (frontmatter) {
      const fence = /^---[ \t]*(?:\r?\n|$)/gm;
      fence.lastIndex = frontmatter[0].length;
      const end = fence.exec(source);
      if (!end) syntaxIssue('Astro frontmatter 未闭合。', 0);
      cursor = fence.lastIndex;
    }
    while (cursor < source.length) {
      if (source.startsWith('<!--', cursor) || source.startsWith('{/*', cursor)) {
        const jsxComment = source.startsWith('{/*', cursor);
        const marker = jsxComment ? '*/' : '-->';
        const end = source.indexOf(marker, cursor + 3);
        if (end < 0) syntaxIssue('Astro 模板注释未闭合。', cursor);
        cursor = end + marker.length;
        if (jsxComment) {
          while (/\s/.test(source[cursor])) cursor++;
          if (source[cursor] !== '}') syntaxIssue('Astro 模板注释缺少结束花括号。', cursor);
          cursor++;
        }
        continue;
      }
      if (source[cursor] !== '<') {
        cursor++;
        continue;
      }
      const start = cursor;
      const tag = openingTag(source, start);
      if (!tag) {
        cursor++;
        continue;
      }
      cursor = tag.end;
      if (source.startsWith('</', start) || !['script', 'style'].includes(tag.name)) continue;
      let end = tag.end;
      let after = tag.end;
      if (!tag.selfClosing) {
        const closing = new RegExp(`</${tag.name}\\s*>`, 'gi');
        closing.lastIndex = tag.end;
        const match = closing.exec(source);
        if (!match) syntaxIssue(`Astro ${tag.name} 标签缺少结束标签。`, start);
        end = match.index;
        after = closing.lastIndex;
      }
      cursor = after;
      if (tag.name !== 'script') continue;
      index++;
      const type = tag.attributes.find((attribute) => attribute.name === 'type');
      if (
        type?.kind === 'literal' &&
        ['application/json', 'application/ld+json'].includes(type.value.trim().toLowerCase())
      )
        continue;
      const src = tag.attributes.find((attribute) => attribute.name === 'src');
      // Generated self-closing bootstrap tags have no source body to inspect.
      if (tag.selfClosing && !src) continue;
      if (type && type.kind !== 'literal')
        syntaxIssue('script type 必须是静态值，才能判定运行时入口。', type.start);
      const spread = tag.attributes.find((attribute) => attribute.name === null);
      if (spread)
        syntaxIssue('不支持分析 script 的展开属性；请显式提供 type 和 src。', spread.start);
      if (src && (src.kind !== 'literal' || !src.value))
        syntaxIssue('script src 必须是非空静态字符串，不能使用表达式。', src.start);
      if (!tag.selfClosing && tag.attributes.some((attribute) => attribute.name === 'set:html'))
        syntaxIssue('无法分析 script set:html 生成的正文；请使用明确的源码入口。', start);
      units.push({
        id: `${file}#script:${index}`,
        file,
        source: source.slice(tag.end, end),
        lineOffset: sourceLine(source, tag.end) - 1,
        src: src?.value,
        srcLine: src && sourceLine(source, src.start),
      });
    }
  } catch (error) {
    errors.push({
      file,
      line: sourceLine(source, error.offset || 0),
      message: error.message,
      chain: [file],
    });
  }
  return { units, errors };
}

/**
 * Validate dependencies from src/scripts and native script tags in Astro source files.
 * Bare npm packages are left to the bundler; this is a local source boundary check.
 */
export function validateArchitecture(input) {
  const files = new Map(
    [...(input instanceof Map ? input : Object.entries(input))].map(([path, source]) => [
      posix.normalize(path.replaceAll('\\', '/')),
      source,
    ]),
  );
  const entries = [...files.keys()]
    .filter((path) => path.startsWith('src/scripts/') && !isDeclaration(path))
    .sort();
  const visited = new Set();
  const violations = [];
  const inline = new Map();
  for (const [file, source] of files) {
    if (!file.startsWith('src/') || extname(file) !== '.astro') continue;
    if (typeof source !== 'string') {
      violations.push({ file, line: 1, message: '缺少可解析的 Astro 源码文本。', chain: [file] });
      continue;
    }
    const { units, errors } = astroScripts(file, source);
    violations.push(...errors);
    for (const unit of units) {
      inline.set(unit.id, unit);
      entries.push(unit.id);
    }
  }
  entries.sort();
  function report(file, line, message, chain) {
    violations.push({ file, line, message, chain });
  }
  function visit(file, chain) {
    if (visited.has(file)) return;
    visited.add(file);
    const unit = inline.get(file);
    const origin = unit?.file || file;
    const offset = unit?.lineOffset || 0;
    if (!unit && !isSource(file)) {
      report(file, 1, '不支持解析此客户端源码类型。', chain);
      return;
    }
    const source = unit?.source ?? files.get(file);
    if (typeof source !== 'string') {
      report(file, 1, '缺少可解析的客户端源码文本。', chain);
      return;
    }
    const extension = unit ? '.ts' : extname(file);
    const kind =
      extension === '.tsx'
        ? ts.ScriptKind.TSX
        : extension === '.jsx'
          ? ts.ScriptKind.JSX
          : ['.js', '.mjs', '.cjs'].includes(extension)
            ? ts.ScriptKind.JS
            : ts.ScriptKind.TS;
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    for (const diagnostic of parsed.parseDiagnostics) {
      const line = parsed.getLineAndCharacterOfPosition(diagnostic.start || 0).line + 1 + offset;
      report(
        origin,
        line,
        `源码无法解析：${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`,
        chain,
      );
    }
    if (parsed.parseDiagnostics.length) return;

    function dependency(specifier, node, sourceLine, scriptSrc = false) {
      const line =
        sourceLine ?? parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1 + offset;
      if (
        specifier.startsWith('node:') ||
        builtins.has(specifier) ||
        specifier === 'astro' ||
        specifier.startsWith('astro/') ||
        (specifier.startsWith('astro:') && !browserVirtualModules.has(specifier))
      ) {
        report(origin, line, `客户端不允许导入服务端模块：${specifier}`, [...chain, specifier]);
        return;
      }
      if (browserVirtualModules.has(specifier)) return;
      if (scriptSrc && /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(specifier)) {
        report(origin, line, `不支持解析外部 script src：${specifier}`, [...chain, specifier]);
        return;
      }
      const local =
        scriptSrc ||
        specifier.startsWith('.') ||
        specifier.startsWith('/') ||
        specifier.startsWith('src/');
      if (!local) {
        if (/^(?:@\/|~\/|#|[a-z][a-z\d+.-]*:)/i.test(specifier)) {
          report(origin, line, `不支持解析此导入（别名或远程模块）：${specifier}`, [
            ...chain,
            specifier,
          ]);
        }
        return;
      }
      if (/[?#\\]/.test(specifier)) {
        report(origin, line, `不支持解析带查询、片段或反斜杠的本地导入：${specifier}`, [
          ...chain,
          specifier,
        ]);
        return;
      }
      const target = localTarget(
        origin,
        scriptSrc &&
          !specifier.startsWith('.') &&
          !specifier.startsWith('/') &&
          !specifier.startsWith('src/')
          ? `./${specifier}`
          : specifier,
        files,
      );
      if (!target) {
        report(origin, line, `无法解析本地导入：${specifier}`, [...chain, specifier]);
      } else if (!allowedClientPath(target)) {
        report(
          origin,
          line,
          `客户端只能依赖 src/scripts 与纯 src/lib，不能导入构建侧路径：${target}`,
          [...chain, target],
        );
      } else {
        visit(target, [...chain, target]);
      }
    }
    function scan(node) {
      if (ts.isImportDeclaration(node) && runtimeImport(node)) {
        dependency(node.moduleSpecifier.text, node);
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && runtimeExport(node)) {
        dependency(node.moduleSpecifier.text, node);
      } else if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly) {
        const line = parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1 + offset;
        report(origin, line, '客户端不支持 import = require；请使用可分析的 ESM 导入。', chain);
      } else if (ts.isCallExpression(node)) {
        const line = parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1 + offset;
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const argument = node.arguments[0];
          if (
            argument &&
            (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
          ) {
            dependency(argument.text, node);
          } else {
            report(origin, line, '动态 import 必须使用固定字符串，才能检查客户端依赖。', chain);
          }
        } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
          report(origin, line, '客户端不支持 require；请使用可分析的 ESM 导入。', chain);
        } else if (
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isMetaProperty(node.expression.expression) &&
          ['glob', 'globEager'].includes(node.expression.name.text)
        ) {
          report(origin, line, '客户端不支持 import.meta.glob；请使用明确的 ESM 导入。', chain);
        }
      }
      ts.forEachChild(node, scan);
    }
    if (unit?.src) dependency(unit.src, null, unit.srcLine, true);
    scan(parsed);
  }
  for (const entry of entries) visit(entry, [entry]);
  if (!entries.length) report('src/scripts', 1, '没有找到客户端入口，无法执行架构检查。', []);
  return { entrypoints: entries.length, modules: visited.size, violations };
}

async function collectSources(directory, root, files = new Map()) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) await collectSources(path, root, files);
    else if (item.isFile()) {
      files.set(
        relative(root, path).replaceAll('\\', '/'),
        isSource(path) || extname(path) === '.astro' ? await readFile(path, 'utf8') : '',
      );
    }
  }
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw new Error('用法：npm run check:architecture（无额外参数）。');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = validateArchitecture(await collectSources(resolve(root, 'src'), root));
  for (const { file, line, message, chain } of result.violations) {
    console.error(`${file}:${line} ${message}\n  ${chain.join(' → ')}`);
  }
  console.log(
    `客户端架构检查：${result.entrypoints} 个入口，${result.modules} 个本地模块，${result.violations.length} 个问题。`,
  );
  if (result.violations.length) process.exitCode = 1;
}
