import { createDialogController } from '../lib/dialog';
import { advanceTap, reactionFor, type TapMemory } from '../lib/companion-reactions';
import { createCompanionMotion } from './companion-motion';
import { createLive2DFrame, shouldMountLive2D } from '../lib/live2d-frame';
import {
  parseCompanions,
  parseCompanionPreference,
  placeCompanion,
  normalizePosition,
  type Point,
} from '../lib/companion-state';

const element = document.querySelector<HTMLElement>('[data-companion-root]');
const catalog = parseCompanions(
  element?.querySelector('[data-companion-catalog]')?.textContent || '[]',
);
if (element && catalog.length) {
  const root = element;
  const key = `shijian:${document.body.dataset.base || '/'}:companion-v1`;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(key);
  } catch {
    /* Optional persistence. */
  }
  const state = parseCompanionPreference(stored, catalog, matchMedia('(max-width: 40rem)').matches);
  const full = root.querySelector<HTMLElement>('[data-companion-full]')!;
  const pocket = root.querySelector<HTMLButtonElement>('[data-companion-expand]')!;
  const avatar = root.querySelector<HTMLButtonElement>('[data-companion-greet]')!;
  const bubble = root.querySelector<HTMLElement>('[data-companion-bubble]')!;
  const dialog = root.querySelector<HTMLDialogElement>('dialog')!;
  const quiet = root.querySelector<HTMLInputElement>('[data-companion-quiet]')!;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 40rem)');
  const liveToggle = root.querySelector<HTMLInputElement>('[data-companion-live2d]')!;
  const liveStatus = root.querySelector<HTMLElement>('[data-live2d-status]')!;
  const liveKey = `${key}:live2d`;
  let liveEnabled = false;
  try {
    liveEnabled = localStorage.getItem(liveKey) === 'on';
  } catch {
    /* Optional preference. */
  }
  let loadTimer = 0;
  const live = createLive2DFrame(
    () => {
      const iframe = document.createElement('iframe');
      iframe.src = root.dataset.live2dFrame!;
      iframe.title = '亚托莉 Live2D 看板娘';
      iframe.tabIndex = -1;
      iframe.setAttribute('aria-hidden', 'true');
      iframe.referrerPolicy = 'no-referrer';
      root.querySelector('[data-live2d-host]')!.append(iframe);
      loadTimer = window.setTimeout(() => live.fail(iframe), 22000);
      return iframe;
    },
    (status) => {
      root.dataset.live2d = status;
      if (status !== 'loading') clearTimeout(loadTimer);
      liveStatus.textContent =
        status === 'loading'
          ? '亚托莉正在准备中，首次加载约 3.5 MB…'
          : status === 'ready'
            ? 'Live2D 已就绪。移动鼠标、戳一戳或摸摸头试试。'
            : status === 'error'
              ? '模型暂时无法加载，已使用轻量形象。关闭后重新开启可重试。'
              : liveEnabled
                ? 'Live2D 已暂停。展开角色，并关闭安静陪伴后，在宽屏页面中启用。'
                : '开启后加载动态模型，约 3.5 MB。手机与安静陪伴时使用轻量形象。';
    },
  );
  const sendModel = (type: string, data: Record<string, number> = {}) => {
    if (root.dataset.live2d === 'ready')
      live.current?.contentWindow?.postMessage(
        { source: 'qing-atri-control', type, ...data },
        location.origin,
      );
  };
  window.addEventListener('message', (event) => {
    const iframe = live.current;
    if (
      !iframe ||
      event.source !== iframe.contentWindow ||
      event.origin !== location.origin ||
      event.data?.source !== 'qing-atri'
    )
      return;
    if (event.data.type === 'ready') {
      live.ready(iframe);
      schedulePosition();
    } else if (event.data.type === 'error') live.fail(iframe);
  });
  const motion = createCompanionMotion(
    root,
    root.querySelector<HTMLElement>('[data-companion-figure]')!,
    root.querySelector<HTMLElement>('[data-companion-effects]')!,
  );
  const picker = createDialogController(dialog, {
    initialFocus: () => dialog.querySelector<HTMLInputElement>('[data-companion-quiet]'),
  });
  let messageTimer = 0;
  let holdTimer = 0;
  let frame = 0;
  let current: Point = { x: 16, y: 16 };
  let drag: { id: number; start: Point; origin: Point; moved: boolean; held: boolean } | null =
    null;
  let suppressClick = false;
  let lineIndex = 0;
  let reactionStep = 0;
  let taps: TapMemory | null = null;

  const viewport = () => ({ width: document.documentElement.clientWidth, height: innerHeight });
  const size = () => ({ width: root.offsetWidth, height: root.offsetHeight });
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* Session still works. */
    }
  }
  function dismissMessage() {
    clearTimeout(messageTimer);
    clearTimeout(holdTimer);
    motion.stop();
    bubble.hidden = true;
    bubble.textContent = '';
  }
  function position(desired?: Point) {
    frame = 0;
    if (root.hidden) return;
    const bounds = size();
    const view = viewport();
    const player = document
      .querySelector<HTMLElement>(
        '.player-root:not([hidden]) [data-player-panel]:not([hidden]), .player-root:not([hidden]) [data-player-capsule]:not([hidden])',
      )
      ?.getBoundingClientRect();
    const target =
      desired ||
      (state.position
        ? {
            x: state.position.x * (view.width - bounds.width),
            y: state.position.y * (view.height - bounds.height),
          }
        : { x: 16, y: view.height - bounds.height - 16 });
    current = placeCompanion(
      target,
      bounds,
      view,
      player && {
        x: player.left,
        y: player.top,
        width: player.width,
        height: player.height,
      },
    );
    root.style.left = `${current.x}px`;
    root.style.top = `${current.y}px`;
    root.dataset.right = String(current.x > view.width / 2);
    root.dataset.bubbleBelow = String(current.y < 112);
  }
  function schedulePosition() {
    if (!frame && !drag) frame = requestAnimationFrame(() => position());
  }
  function resetPosition() {
    state.position = null;
    save();
    position();
  }
  function render() {
    const item = catalog.find((entry) => entry.id === state.id)!;
    root.hidden = state.hidden;
    root.dataset.quiet = String(state.quiet);
    root.dataset.compact = String(state.compact);
    full.hidden = state.compact;
    full.inert = state.compact;
    pocket.hidden = !state.compact;
    avatar.setAttribute('aria-label', `和${item.name}互动`);
    root.querySelector('[data-companion-pet]')?.setAttribute('aria-label', `摸摸${item.name}的头`);
    pocket.setAttribute('aria-label', `展开小伙伴：${item.name}`);
    root.querySelectorAll<HTMLImageElement>('[data-companion-image]').forEach((img) => {
      if (img.getAttribute('src') !== item.image) img.src = item.image;
      img.alt = img.closest('[data-companion-expand]') ? '' : item.name;
    });
    quiet.checked = state.quiet;
    liveToggle.checked = liveEnabled;
    live.sync(
      shouldMountLive2D({
        enabled: liveEnabled,
        hidden: state.hidden,
        compact: state.compact,
        quiet: state.quiet,
        reducedMotion: reducedMotion.matches,
        mobile: mobile.matches,
        away: document.hidden,
      }),
    );
    position();
    document.querySelectorAll<HTMLButtonElement>('[data-companion-show]').forEach((button) => {
      button.hidden = false;
    });
  }
  function greet(kind: 'tap' | 'pet' = 'tap', countTap = true) {
    dismissMessage();
    const item = catalog.find((entry) => entry.id === state.id)!;
    taps = kind === 'tap' && countTap ? advanceTap(taps, performance.now()) : null;
    const plan = reactionFor(item.id, reactionStep++, kind, taps?.count || 1);
    bubble.textContent = plan.line || item.lines[lineIndex++ % item.lines.length];
    bubble.hidden = false;
    motion.play(plan, !state.quiet && !reducedMotion.matches && !document.hidden);
    sendModel(kind);
    messageTimer = window.setTimeout(dismissMessage, 4500);
  }
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.hasAttribute('data-companion-show')) {
      state.hidden = false;
      state.compact = false;
      save();
      render();
      picker.open(button);
      return;
    }
    if (!root.contains(button)) return;
    if (button === avatar) {
      if (!suppressClick || event.detail === 0) greet();
      suppressClick = false;
    } else if (button.hasAttribute('data-companion-pet')) greet('pet');
    else if (button.hasAttribute('data-companion-picker')) picker.open(button);
    else if (button.hasAttribute('data-companion-close')) picker.close();
    else if (button.hasAttribute('data-companion-compact')) {
      dismissMessage();
      state.compact = true;
      save();
      render();
      pocket.focus({ preventScroll: true });
    } else if (button === pocket) {
      state.compact = false;
      save();
      render();
      avatar.focus({ preventScroll: true });
    } else if (button.hasAttribute('data-companion-reset')) resetPosition();
    else if (button.hasAttribute('data-companion-hide')) {
      dismissMessage();
      picker.close(false);
      state.hidden = true;
      save();
      render();
      document
        .querySelector<HTMLButtonElement>('[data-companion-show]')
        ?.focus({ preventScroll: true });
    }
  });
  quiet.addEventListener('change', () => {
    state.quiet = quiet.checked;
    if (state.quiet) motion.stop();
    save();
    render();
  });
  liveToggle.addEventListener('change', () => {
    liveEnabled = liveToggle.checked;
    try {
      localStorage.setItem(liveKey, liveEnabled ? 'on' : 'off');
    } catch {
      /* Optional persistence. */
    }
    render();
  });
  avatar.addEventListener('pointermove', (event) => {
    if (root.dataset.live2d !== 'ready' || drag?.moved) return;
    const bounds = avatar.getBoundingClientRect();
    sendModel('look', {
      x: ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      y: 1 - ((event.clientY - bounds.top) / bounds.height) * 2,
    });
  });
  avatar.addEventListener('pointerleave', () => sendModel('reset'));
  avatar.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    drag = {
      id: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: current,
      moved: false,
      held: false,
    };
    avatar.setPointerCapture(event.pointerId);
    holdTimer = window.setTimeout(() => {
      if (drag && !drag.moved) {
        drag.held = true;
        greet('pet');
      }
    }, 550);
  });
  avatar.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.start.x,
      dy = event.clientY - drag.start.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    taps = null;
    dismissMessage();
    root.classList.add('is-dragging');
    position({ x: drag.origin.x + dx, y: drag.origin.y + dy });
  });
  function endDrag() {
    if (!drag) return;
    clearTimeout(holdTimer);
    suppressClick = drag.moved || drag.held;
    if (drag.moved) {
      state.position = normalizePosition(current, size(), viewport());
      save();
    }
    drag = null;
    root.classList.remove('is-dragging');
    schedulePosition();
  }
  avatar.addEventListener('pointerup', endDrag);
  avatar.addEventListener('pointercancel', endDrag);
  avatar.addEventListener('lostpointercapture', endDrag);
  avatar.addEventListener('contextmenu', (event) => event.preventDefault());
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) motion.stop();
    render();
  });
  mobile.addEventListener('change', render);
  avatar.addEventListener('keydown', (event) => {
    if (event.key === 'Home') {
      event.preventDefault();
      resetPosition();
      return;
    }
    const steps: Record<string, Point> = {
      ArrowLeft: { x: -20, y: 0 },
      ArrowRight: { x: 20, y: 0 },
      ArrowUp: { x: 0, y: -20 },
      ArrowDown: { x: 0, y: 20 },
    };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    dismissMessage();
    position({ x: current.x + step.x, y: current.y + step.y });
    state.position = normalizePosition(current, size(), viewport());
    save();
  });
  const observer = new ResizeObserver(schedulePosition);
  observer.observe(root);
  document
    .querySelectorAll<HTMLElement>('[data-player-panel], [data-player-capsule]')
    .forEach((panel) => observer.observe(panel));
  addEventListener('resize', schedulePosition, { passive: true });
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('is-away', document.hidden);
    if (document.hidden) dismissMessage();
    render();
  });
  document.addEventListener('astro:before-swap', () => {
    taps = null;
    dismissMessage();
    endDrag();
    picker.close(false);
  });
  document.addEventListener('astro:page-load', render);
  render();
}
