export const countNames = [
  'site_pv',
  'site_uv',
  'today_pv',
  'today_uv',
  'page_pv',
  'page_uv',
] as const;
export type CountName = (typeof countNames)[number];
export type VisitCounts = Record<CountName, number>;
export type VisitState = { status: 'loading' | 'ready' | 'error'; counts?: VisitCounts };

/** Only the canonical public route is sent. Search terms, fragments and credentials never leave. */
export function canonicalVisit(href: string, origin: string, base: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password)
      return null;
    if (
      url.hostname === 'localhost' ||
      !url.hostname.includes('.') ||
      /^[\d.:]+$/.test(url.hostname)
    )
      return null;
    const prefix = '/' + base.split('/').filter(Boolean).join('/') + '/';
    const root = prefix === '//' ? '/' : prefix;
    if (!url.pathname.startsWith(root) && url.pathname !== root.slice(0, -1)) return null;
    const pathname = url.pathname.replace(/\/+$/, '') + '/';
    return url.origin + pathname;
  } catch {
    return null;
  }
}
export function parseVisitCounts(value: unknown): VisitCounts | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const result = {} as VisitCounts;
  for (const name of countNames) {
    const raw = record['busuanzi_' + name];
    const number = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw;
    if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 0) return null;
    result[name] = number;
  }
  return result;
}

/** Own small adapter for the documented public endpoint; no remote executable script. */
export async function requestVisit(
  endpoint: string,
  url: string,
  signal: AbortSignal,
  timeoutMs: number,
  fetcher: typeof fetch = fetch,
): Promise<VisitCounts> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      body: JSON.stringify({ url, referrer: '' }),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Counter unavailable');
    const counts = parseVisitCounts(await response.json());
    if (!counts) throw new Error('Invalid counter response');
    return counts;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

/** One report per committed navigation. Old responses cannot overwrite another article. */
export function createVisitReporter(
  request: (url: string, signal: AbortSignal) => Promise<VisitCounts>,
  publish: (state: VisitState) => void,
) {
  let lastKey = '';
  let generation = 0;
  let controller: AbortController | undefined;
  return {
    async open(key: string, url: string) {
      if (key === lastKey) return false;
      lastKey = key;
      const token = ++generation;
      controller?.abort();
      controller = new AbortController();
      publish({ status: 'loading' });
      try {
        const counts = await request(url, controller.signal);
        if (token === generation) publish({ status: 'ready', counts });
      } catch {
        if (token === generation) publish({ status: 'error' });
      }
      return true;
    },
    cancel() {
      generation++;
      controller?.abort();
    },
  };
}
