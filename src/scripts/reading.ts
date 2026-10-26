import {
  readingPreferences,
  changeReadingSize,
  type ReadingPreferences,
} from '../lib/reading-preferences';
let stop: (() => void) | undefined;
let preferences: ReadingPreferences = { size: 'normal', wide: false };
const preferenceKey = () => `shijian:${document.body.dataset.base || '/'}:reading-v1`;
function applyPreferences() {
  document.documentElement.dataset.readingSize = preferences.size;
  document.documentElement.dataset.readingWide = String(preferences.wide);
}
function initReading() {
  stop?.();
  const article = document.querySelector<HTMLElement>('[data-reading-article]');
  const body = document.getElementById('article-content');
  const bar = document.getElementById('reading-progress');
  if (!article || !body || !bar) return;
  try {
    preferences = readingPreferences(JSON.parse(localStorage.getItem(preferenceKey()) || '{}'));
  } catch {
    /* Session settings still work. */
  }
  applyPreferences();
  const controller = new AbortController(),
    options = { signal: controller.signal };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let frame = 0;
  const later = (callback: () => void) => {
    const id = setTimeout(() => {
      timers.delete(id);
      callback();
    }, 2400);
    timers.add(id);
  };
  const feedback = article.querySelector<HTMLElement>('[data-reading-feedback]');
  const smaller = article.querySelector<HTMLButtonElement>('[data-reading-smaller]')!;
  const larger = article.querySelector<HTMLButtonElement>('[data-reading-larger]')!;
  const width = article.querySelector<HTMLButtonElement>('[data-reading-width]')!;
  function syncSettings() {
    applyPreferences();
    smaller.disabled = preferences.size === 'small';
    larger.disabled = preferences.size === 'large';
    width.setAttribute('aria-pressed', String(preferences.wide));
    article!.querySelector('[data-reading-size-label]')!.textContent = {
      small: '小字',
      normal: '标准',
      large: '大字',
    }[preferences.size];
  }
  function saveSettings() {
    syncSettings();
    try {
      localStorage.setItem(preferenceKey(), JSON.stringify(preferences));
    } catch {
      /* Browser may disable storage. */
    }
  }
  smaller.addEventListener(
    'click',
    () => {
      preferences = changeReadingSize(preferences, -1);
      saveSettings();
    },
    options,
  );
  larger.addEventListener(
    'click',
    () => {
      preferences = changeReadingSize(preferences, 1);
      saveSettings();
    },
    options,
  );
  width.addEventListener(
    'click',
    () => {
      preferences.wide = !preferences.wide;
      saveSettings();
    },
    options,
  );
  article.querySelector<HTMLButtonElement>('[data-copy-article]')!.addEventListener(
    'click',
    async (event) => {
      const button = event.currentTarget as HTMLButtonElement,
        label = button.querySelector('span')!;
      try {
        await navigator.clipboard.writeText(location.href);
        label.textContent = '链接已复制';
        if (feedback) feedback.textContent = '文章链接已复制';
      } catch {
        label.textContent = '请复制地址栏';
        if (feedback) feedback.textContent = '复制失败，请复制浏览器地址栏链接';
      }
      later(() => {
        label.textContent = '复制链接';
      });
    },
    options,
  );
  syncSettings();
  body.querySelectorAll<HTMLHeadingElement>('h2,h3,h4').forEach((heading) => {
    heading.querySelector('.heading-anchor')?.remove();
    if (!heading.id) return;
    // Keep heading navigation from announcing the title twice with its permalink.
    if (!heading.hasAttribute('aria-label'))
      heading.setAttribute('aria-label', heading.textContent || '');
    const anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = `#${encodeURIComponent(heading.id)}`;
    anchor.textContent = '#';
    anchor.setAttribute('aria-label', `定位到章节：${heading.textContent}`);
    heading.append(anchor);
  });
  const headings = [...body.querySelectorAll<HTMLHeadingElement>('h2,h3')];
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]')];
  const current = article.querySelector<HTMLElement>('[data-current-heading]');
  const update = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      const top = body.getBoundingClientRect().top + scrollY,
        length = body.offsetHeight - innerHeight;
      const percent =
        length <= 0
          ? scrollY + innerHeight >= top + body.offsetHeight
            ? 1
            : 0
          : Math.max(0, Math.min(1, (scrollY - top) / length));
      bar.style.transform = `scaleX(${percent})`;
      let active = headings[0];
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= 110) active = heading;
        else break;
      }
      for (const link of links) {
        if (active && decodeURIComponent(link.hash.slice(1)) === active.id)
          link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
      if (current && active)
        current.textContent = active.textContent?.replace(/#$/, '') || '在这篇记录里';
      frame = 0;
    });
  };
  window.addEventListener('scroll', update, { ...options, passive: true });
  window.addEventListener('resize', update, options);
  const resize = new ResizeObserver(update);
  resize.observe(article);
  resize.observe(body);
  article.querySelector('.mobile-toc')?.addEventListener(
    'click',
    (event) => {
      if ((event.target as Element).closest('a'))
        article.querySelector<HTMLDetailsElement>('.mobile-toc')!.open = false;
    },
    options,
  );
  body.querySelectorAll('pre').forEach((pre, index) => {
    pre.querySelectorAll('.copy-code,.code-language').forEach((node) => node.remove());
    pre.tabIndex = 0;
    pre.setAttribute('aria-label', `代码块 ${index + 1}，可左右滚动`);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code';
    button.textContent = '复制代码';
    button.setAttribute('aria-label', `复制代码，第 ${index + 1} 个代码块`);
    button.addEventListener(
      'click',
      async () => {
        try {
          await navigator.clipboard.writeText(pre.querySelector('code')?.textContent || '');
          button.textContent = '已复制';
          if (feedback) feedback.textContent = `第 ${index + 1} 个代码块已复制`;
        } catch {
          button.textContent = '复制失败，请手动选择';
          if (feedback) feedback.textContent = '代码复制失败，请手动选择代码';
        }
        later(() => {
          if (button.isConnected) button.textContent = '复制代码';
        });
      },
      options,
    );
    const language = document.createElement('span');
    language.className = 'code-language';
    language.textContent = pre.dataset.language || '代码';
    language.setAttribute('aria-hidden', 'true');
    pre.append(language, button);
  });
  body.querySelectorAll('table').forEach((table, index) => {
    if (table.parentElement?.classList.contains('table-scroll')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', `表格 ${index + 1}，可左右滚动`);
    table.before(wrapper);
    wrapper.append(table);
  });
  const viewer = document.querySelector<HTMLDialogElement>('#image-viewer');
  const viewerImage = viewer?.querySelector<HTMLImageElement>('[data-viewer-image]');
  const caption = viewer?.querySelector<HTMLElement>('[data-viewer-caption]');
  article.querySelectorAll<HTMLImageElement>('.prose img,img.article-cover').forEach((image) => {
    if (!image.alt.trim() || image.closest('a,button,[data-no-zoom]')) return;
    const target = image.closest('picture') || image;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `image-zoom${image.classList.contains('article-cover') ? ' cover-zoom' : ''}`;
    button.setAttribute('aria-label', `放大查看：${image.alt}`);
    target.before(button);
    button.append(target);
  });
  article.addEventListener(
    'click',
    (event) => {
      const image = (event.target as Element).closest('.image-zoom')?.querySelector('img');
      if (!image || !viewer || !viewerImage || !caption) return;
      viewerImage.src = image.currentSrc || image.src;
      viewerImage.alt = image.alt;
      caption.textContent = image.alt;
      viewer.showModal();
    },
    options,
  );
  viewer?.addEventListener(
    'click',
    (event) => {
      if (event.target === viewer || (event.target as Element).closest('[data-image-close]'))
        viewer.close();
    },
    options,
  );
  update();
  stop = () => {
    controller.abort();
    resize.disconnect();
    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    viewer?.close();
  };
}
document.addEventListener('astro:after-swap', applyPreferences);
document.addEventListener('astro:page-load', initReading);
document.addEventListener('astro:before-swap', () => stop?.());
initReading();
