import { themeState } from '../lib/theme-preferences';

const key = `shijian:${document.body.dataset.base || '/'}:theme-v3`;
const defaultTheme = document.body.dataset.defaultTheme || 'light';
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let saved: unknown;
try {
  saved = localStorage.getItem(key);
} catch {
  /* The in-memory choice remains available when storage is blocked. */
}
let preference = themeState(saved, defaultTheme, systemTheme.matches).preference;

function applyTheme() {
  const { theme } = themeState(preference, defaultTheme, systemTheme.matches);
  document.documentElement.dataset.theme = theme;
  document
    .querySelectorAll('[data-theme-toggle]')
    .forEach((button) =>
      button.setAttribute('aria-label', theme === 'dark' ? '切换浅色模式' : '切换深色模式'),
    );
  document
    .querySelectorAll<HTMLElement>('[data-theme-choice]')
    .forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preference)),
    );
}

// Inline head scripts can run again during client navigation. Let them reuse
// this controller's in-memory choice instead of rereading stale/blocked storage.
const session = globalThis as typeof globalThis & {
  __shijianTheme?: { key: string; apply: () => void };
};
session.__shijianTheme = { key, apply: applyTheme };

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const choice = event.target.closest('[data-display-reset]')
    ? defaultTheme
    : event.target.closest<HTMLElement>('[data-theme-choice]')?.dataset.themeChoice;
  if (choice === 'light' || choice === 'dark' || choice === 'system') preference = choice;
  else if (event.target.closest('[data-theme-toggle]'))
    preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  else return;
  try {
    localStorage.setItem(key, preference);
  } catch {
    /* Storage is optional; do not replace this session's choice on navigation. */
  }
  applyTheme();
});

systemTheme.addEventListener('change', () => {
  if (preference === 'system') applyTheme();
});
// Apply before paint after a document swap; refresh labels on the new controls.
document.addEventListener('astro:after-swap', applyTheme);
document.addEventListener('astro:page-load', applyTheme);
applyTheme();
