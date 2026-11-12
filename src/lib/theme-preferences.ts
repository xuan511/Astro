export type ThemePreference = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

// Keep this decision self-contained: the same function is embedded in the
// synchronous head bootstrap and imported by the persistent browser controller.
export function themeState(
  value: unknown,
  fallback: unknown,
  systemDark: boolean,
): { preference: ThemePreference; theme: Theme } {
  const valid = (candidate: unknown): candidate is ThemePreference =>
    candidate === 'light' || candidate === 'dark' || candidate === 'system';
  const preference = valid(value) ? value : valid(fallback) ? fallback : 'light';
  return {
    preference,
    theme: preference === 'dark' || (preference === 'system' && systemDark) ? 'dark' : 'light',
  };
}

export function themeBootstrap(key: string, defaultTheme: ThemePreference) {
  const config = JSON.stringify({ key, defaultTheme }).replace(/</g, '\\u003c');
  return `(() => {
    const decide = ${themeState.toString()};
    const config = ${config};
    const session = globalThis.__shijianTheme;
    if (session?.key === config.key) { session.apply(); return; }
    let saved;
    try { saved = localStorage.getItem(config.key); } catch {}
    const dark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = decide(saved, config.defaultTheme, dark).theme;
  })();`;
}
