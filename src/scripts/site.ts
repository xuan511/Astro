export {};
const themeKey = () => `shijian:${document.body.dataset.base || '/'}:theme-v3`;
function applyTheme() {
  let preferred = document.body.dataset.defaultTheme || 'light';
  try {
    preferred = localStorage.getItem(themeKey()) || preferred;
  } catch {
    /* Reading remains available without storage. */
  }
  const dark =
    preferred === 'dark' ||
    (preferred === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document
    .querySelectorAll('[data-theme-toggle]')
    .forEach((button) => button.setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式'));
}
function closeMenu(restoreFocus = false) {
  const menu = document.getElementById('mobile-navigation');
  const focusedInside = menu?.contains(document.activeElement);
  if (menu) menu.hidden = true;
  document.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded', 'false');
  document.querySelector('[data-menu-toggle]')?.setAttribute('aria-label', '展开导航');
  if (restoreFocus && focusedInside)
    document.querySelector<HTMLButtonElement>('[data-menu-toggle]')?.focus();
}
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-theme-toggle]')) {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(themeKey(), theme);
    } catch {
      /* Session theme still works. */
    }
    document.documentElement.dataset.theme = theme;
    document
      .querySelectorAll('[data-theme-toggle]')
      .forEach((button) =>
        button.setAttribute('aria-label', theme === 'dark' ? '切换浅色模式' : '切换深色模式'),
      );
  }
  const toggle = event.target.closest('[data-menu-toggle]');
  if (toggle) {
    const menu = document.getElementById('mobile-navigation');
    if (menu) {
      menu.hidden = !menu.hidden;
      toggle.setAttribute('aria-expanded', String(!menu.hidden));
      toggle.setAttribute('aria-label', menu.hidden ? '展开导航' : '收起导航');
    }
  }
  if (event.target.closest('.mobile-nav a')) closeMenu();
  if (!event.target.closest('#mobile-navigation,[data-menu-toggle]')) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu(true);
});
matchMedia('(min-width: 641px)').addEventListener('change', (event) => {
  if (event.matches) closeMenu();
});
document.addEventListener('astro:after-swap', applyTheme);
document.addEventListener('astro:page-load', applyTheme);
applyTheme();

// Keep links from v1/v2 working after the migration to real static pages.
if (location.hash.startsWith('#/')) {
  const old = location.hash.slice(2);
  const mapping: Record<string, string> = {
    '': '',
    notes: 'notes/',
    archive: 'archive/',
    about: 'about/',
    studio: 'legacy/#/studio',
  };
  const path = old.startsWith('post/') ? `posts/${old.slice(5)}/` : mapping[old];
  if (path !== undefined) location.replace(`${document.body.dataset.base}${path}`);
}
