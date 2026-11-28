import {
  canonicalVisit,
  countNames,
  createVisitReporter,
  requestVisit,
  type VisitState,
} from '../lib/analytics';
interface Config {
  enabled: boolean;
  endpoint: string;
  origin: string;
  base: string;
  timeoutMs: number;
}
let revision = 0;
let idle: number | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let pending = '';
const format = new Intl.NumberFormat('zh-CN');
function render(state: VisitState | { status: 'preview' | 'disabled' }) {
  document.querySelectorAll<HTMLElement>('[data-visit-count]').forEach((element) => {
    const name = element.dataset.visitCount as (typeof countNames)[number];
    element.textContent =
      state.status === 'ready' && state.counts && countNames.includes(name)
        ? format.format(state.counts[name])
        : '—';
    element.dataset.visitStatus = state.status;
  });
  const message = {
    loading: '正在读取访问统计',
    ready: '',
    error: '统计暂不可用，稍后访问时再试',
    preview: '本地或预览环境不计数',
    disabled: '访问统计已关闭',
  }[state.status];
  document.querySelectorAll<HTMLElement>('[data-visit-status]').forEach((element) => {
    if (!element.hasAttribute('data-visit-count')) element.textContent = message;
  });
}
const reporter = createVisitReporter((url, signal) => {
  const config = readConfig();
  return requestVisit(config.endpoint, url, signal, config.timeoutMs);
}, render);
function readConfig(): Config {
  return JSON.parse(
    document.querySelector('[data-analytics-config]')?.textContent || '{"enabled":false}',
  );
}
function stopPending() {
  if (idle !== undefined) window.cancelIdleCallback?.(idle);
  clearTimeout(timer);
  idle = undefined;
  timer = undefined;
}
function prepare() {
  const config = readConfig();
  if (!config.enabled || document.querySelector('meta[name="robots"][content*="noindex"]')) {
    stopPending();
    render({ status: 'disabled' });
    return;
  }
  const url = canonicalVisit(location.href, config.origin, config.base);
  if (!url) {
    stopPending();
    render({ status: 'preview' });
    return;
  }
  const key = `${revision}:${url}`;
  if (key === pending) return;
  if (document.hidden) return;
  stopPending();
  pending = key;
  render({ status: 'loading' });
  const send = () => {
    idle = undefined;
    timer = undefined;
    if (document.hidden) {
      pending = '';
      return;
    }
    void reporter.open(key, url);
  };
  if ('requestIdleCallback' in window) idle = window.requestIdleCallback(send, { timeout: 1200 });
  else timer = setTimeout(send, 200);
}
document.addEventListener('astro:before-swap', () => {
  revision++;
  pending = '';
  stopPending();
  reporter.cancel();
});
document.addEventListener('astro:page-load', prepare);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) prepare();
});
prepare();
