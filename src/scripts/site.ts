import './theme';
function closeDirectory(restoreFocus = false) {
  const menu = document.querySelector<HTMLDetailsElement>('[data-site-directory]');
  const focusedInside = menu?.contains(document.activeElement);
  if (menu) menu.open = false;
  if (restoreFocus && focusedInside)
    menu?.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
}
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('.directory-panel a')) closeDirectory();
  if (!event.target.closest('[data-site-directory]')) closeDirectory();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDirectory(true);
});
document.addEventListener('focusin', (event) => {
  if (event.target instanceof Element && !event.target.closest('[data-site-directory]'))
    closeDirectory();
});
document.addEventListener('astro:before-preparation', () => closeDirectory());
document.addEventListener('astro:before-swap', () => closeDirectory());
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
