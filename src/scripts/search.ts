import {
  searchEntries,
  snippet,
  highlightParts,
  parseSearchIndex,
  type SearchEntry,
} from '../lib/search';
import { withBase } from '../lib/paths';

// All search surfaces share one lazy request, including during client navigation.
let indexRequest: Promise<SearchEntry[]> | undefined;
function loadIndex() {
  return (indexRequest ||= fetch(withBase('search.json'))
    .then(async (response) => {
      if (!response.ok) throw new Error('搜索索引暂时无法载入');
      return parseSearchIndex(await response.json());
    })
    .catch((error) => {
      indexRequest = undefined;
      throw error;
    }));
}
function highlight(element: HTMLElement, text: string, query: string) {
  for (const part of highlightParts(text, query)) {
    if (part.matched) {
      const mark = document.createElement('mark');
      mark.textContent = part.text;
      element.append(mark);
    } else element.append(document.createTextNode(part.text));
  }
}
let dispose: (() => void) | undefined;
function initSearch() {
  dispose?.();
  const cleanup: (() => void)[] = [];
  document.querySelectorAll<HTMLElement>('[data-search-root]').forEach((root) => {
    const input = root.querySelector<HTMLInputElement>('[data-search-input]')!;
    const kind = root.querySelector<HTMLSelectElement>('[data-search-kind]')!;
    const results = root.querySelector<HTMLElement>('[data-search-results]')!;
    const status = root.querySelector<HTMLElement>('[data-search-status]')!;
    const more = root.querySelector<HTMLButtonElement>('[data-search-more]')!;
    const retry = root.querySelector<HTMLButtonElement>('[data-search-retry]')!;
    const all = root.querySelector<HTMLAnchorElement>('[data-search-all]');
    const suggestions = root.querySelector<HTMLElement>('[data-search-suggestions]');
    const compact = root.dataset.compact === 'true';
    const controller = new AbortController();
    const options = { signal: controller.signal };
    let timer: ReturnType<typeof setTimeout>;
    let page = 1,
      sequence = 0,
      composing = false;
    if (!compact) {
      const params = new URLSearchParams(location.search);
      input.value = params.get('q')?.slice(0, 120) || '';
      kind.value = ['all', 'tech', 'life', 'project'].includes(params.get('kind') || '')
        ? params.get('kind')!
        : 'all';
    }
    async function run() {
      const seq = ++sequence,
        query = input.value.trim();
      retry.hidden = true;
      more.hidden = true;
      if (all) all.hidden = true;
      if (suggestions) suggestions.hidden = Boolean(query);
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (kind.value !== 'all') params.set('kind', kind.value);
      // A quick search must never replace the article's URL or scroll history.
      if (!compact)
        history.replaceState(
          history.state,
          '',
          `${location.pathname}${params.size ? '?' + params : ''}`,
        );
      if (!query) {
        results.replaceChildren();
        status.textContent = '输入关键词，搜索公开文章与项目。';
        results.setAttribute('aria-busy', 'false');
        return;
      }
      results.setAttribute('aria-busy', 'true');
      status.textContent = '正在翻找…';
      try {
        const entries = await loadIndex();
        if (seq !== sequence || controller.signal.aborted) return;
        const found = searchEntries(entries, query, kind.value);
        results.replaceChildren();
        for (const row of found.slice(0, compact ? 6 : page * 20)) {
          const article = document.createElement('article');
          article.className = 'search-result';
          const link = document.createElement('a');
          link.href = row.url;
          const meta = document.createElement('p');
          meta.className = 'post-meta';
          const section = row.kind === 'project' ? '项目' : row.kind === 'life' ? '生活' : '技术';
          meta.textContent = `${section}${row.category === section ? '' : ' · ' + row.category}${row.demo ? ' · 示例' : ''}`;
          const heading = document.createElement('h2');
          highlight(heading, row.title, query);
          const text = document.createElement('p');
          text.className = 'excerpt';
          highlight(text, snippet(row, query), query);
          link.append(meta, heading, text);
          article.append(link);
          results.append(article);
        }
        status.textContent = found.length
          ? `找到 ${found.length} 条记录`
          : '没有找到相关内容。换个关键词试试？';
        more.hidden = compact || found.length <= page * 20;
        if (all && found.length) {
          all.hidden = false;
          all.href = `${withBase('search/')}?${params}`;
        }
      } catch (error) {
        if (seq !== sequence || controller.signal.aborted) return;
        results.replaceChildren();
        status.textContent = `${error instanceof Error ? error.message : '搜索未完成'}。请重试，或从归档继续阅读。`;
        retry.hidden = false;
      } finally {
        if (seq === sequence) results.setAttribute('aria-busy', 'false');
      }
    }
    const changed = () => {
      clearTimeout(timer);
      page = 1;
      void run();
    };
    const invalidate = (statusText: string) => {
      // Invalidate at the keystroke, before the debounce starts. A pending index
      // request must not render results for text that is no longer in the input.
      sequence++;
      results.replaceChildren();
      results.setAttribute('aria-busy', 'false');
      more.hidden = true;
      retry.hidden = true;
      if (all) all.hidden = true;
      if (suggestions) suggestions.hidden = Boolean(input.value.trim());
      status.textContent = statusText;
    };
    input.addEventListener(
      'input',
      () => {
        if (composing) return;
        clearTimeout(timer);
        page = 1;
        invalidate(input.value.trim() ? '正在翻找…' : '输入关键词，搜索公开文章与项目。');
        timer = setTimeout(run, 180);
      },
      options,
    );
    input.addEventListener(
      'compositionstart',
      () => {
        composing = true;
        clearTimeout(timer);
        invalidate('正在输入…');
      },
      options,
    );
    input.addEventListener(
      'compositionend',
      () => {
        composing = false;
        changed();
      },
      options,
    );
    root.querySelector('form')!.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        if (!composing) changed();
      },
      options,
    );
    kind.addEventListener('change', changed, options);
    root.querySelector('[data-search-clear]')!.addEventListener(
      'click',
      () => {
        input.value = '';
        changed();
        input.focus();
      },
      options,
    );
    root.querySelectorAll<HTMLButtonElement>('[data-search-suggestion]').forEach((button) =>
      button.addEventListener(
        'click',
        () => {
          input.value = button.dataset.searchSuggestion!;
          kind.value = 'all';
          changed();
          input.focus();
        },
        options,
      ),
    );
    more.addEventListener(
      'click',
      () => {
        const next = page++ * 20;
        void run().then(() => results.querySelectorAll<HTMLAnchorElement>('a')[next]?.focus());
      },
      options,
    );
    retry.addEventListener('click', changed, options);
    root.addEventListener(
      'keydown',
      (event) => {
        if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
        const links = [...results.querySelectorAll<HTMLAnchorElement>('a')];
        if (event.target === input && event.key === 'ArrowDown' && links[0]) {
          event.preventDefault();
          links[0].focus();
        }
        const at = links.indexOf(event.target as HTMLAnchorElement);
        if (at < 0) return;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          links[Math.min(at + 1, links.length - 1)]?.focus();
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (at === 0) input.focus();
          else links[at - 1]?.focus();
        }
      },
      options,
    );
    cleanup.push(() => {
      sequence++;
      clearTimeout(timer);
      controller.abort();
    });
    if (input.value) void run();
  });
  dispose = () => cleanup.forEach((stop) => stop());
}
function quickDialog() {
  return document.querySelector<HTMLDialogElement>('#quick-search');
}
function openSearch() {
  const dialog = quickDialog();
  if (!dialog || document.querySelector('dialog[open]')) return;
  dialog.showModal();
  dialog.querySelector<HTMLInputElement>('[data-search-input]')?.focus({ preventScroll: true });
}
// Intercept before ClientRouter starts a navigation for the fallback search link.
document.addEventListener(
  'click',
  (event) => {
    if (!(event.target instanceof Element)) return;
    const dialog = quickDialog();
    const plain =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (event.target.closest('[data-search-open]') && plain) {
      event.preventDefault();
      openSearch();
    }
    if (
      event.target.closest('[data-search-close]') ||
      event.target === dialog ||
      (plain && event.target.closest('#quick-search a'))
    )
      dialog?.close();
  },
  { capture: true },
);
document.addEventListener('keydown', (event) => {
  if (event.isComposing || event.altKey) return;
  const editable =
    event.target instanceof Element &&
    event.target.closest('input,textarea,select,[contenteditable]');
  const shortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
  const slash = !editable && !event.ctrlKey && !event.metaKey && event.key === '/';
  if ((!shortcut && !slash) || document.querySelector('dialog[open]:not(#quick-search)')) return;
  event.preventDefault();
  if (quickDialog()?.open && shortcut) quickDialog()?.close();
  else openSearch();
});
function init() {
  initSearch();
  document.querySelectorAll('[data-search-shortcut]').forEach((label) => {
    label.textContent = /Macintosh|iPhone|iPad/.test(navigator.userAgent) ? '⌘ K' : 'Ctrl K';
  });
}
document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', () => {
  dispose?.();
  quickDialog()?.close();
});
init();
