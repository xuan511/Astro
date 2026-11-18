import { withBase } from '../lib/paths';
import {
  type Track,
  type PlayMode,
  parsePreference,
  nextIndex,
  playModes,
  modeLabels,
  modeDescriptions,
  timeLabel,
  coverPath,
} from '../lib/player-state';
import { createDialogController } from '../lib/dialog';

const root = document.getElementById('persistent-player');
const audio = root?.querySelector<HTMLAudioElement>('audio');
const playlist: Track[] = JSON.parse(root?.querySelector('[data-playlist]')?.textContent || '[]');
const key = `shijian:${document.body.dataset.base || '/'}:player-v3`;
let stored: string | null = null;
try {
  stored = localStorage.getItem(key);
} catch {
  /* Optional persistence. */
}
const preference = parsePreference(stored, playlist);
const minimizedKey = `${key}:minimized`;
let minimizedPreference: boolean | undefined;
try {
  const saved = localStorage.getItem(minimizedKey);
  if (saved === 'true' || saved === 'false') minimizedPreference = saved === 'true';
} catch {
  /* The current session still supports minimizing. */
}

if (root && audio && playlist.length) {
  // This element and its controller persist across every Astro document swap.
  audio.dataset.instance = crypto.randomUUID?.() || String(Date.now());
  audio.volume = preference.volume;
  let index = Math.max(
    0,
    playlist.findIndex((track) => track.id === preference.id),
  );
  let mode: PlayMode = preference.mode;
  let loadedId = '';
  let pending = false;
  let generation = 0;
  let expanded = false;
  const pageMinimized = () =>
    minimizedPreference ?? Boolean(document.querySelector('[data-reading-article]'));
  let minimized = pageMinimized();
  let seekPreview: number | null = null;
  let feedback = '';
  let dragging: HTMLInputElement | null = null;
  let lastStored = 0;
  let resume = preference.position;
  const history: number[] = [];
  const dialog = root.querySelector<HTMLDialogElement>('dialog');
  const queue = createDialogController(dialog, {
    initialFocus: () => dialog?.querySelector<HTMLButtonElement>('[data-queue-close]'),
  });
  const each = <T extends Element = HTMLElement>(selector: string, fn: (el: T) => void) =>
    document.querySelectorAll<T>(selector).forEach(fn);
  const current = () => playlist[index]!;

  function announce(text: string) {
    each('[data-player-announcement]', (el) => {
      el.textContent = text;
    });
  }
  function setMinimized(value: boolean, restoreFocus = true) {
    minimizedPreference = value;
    minimized = value;
    render();
    try {
      localStorage.setItem(minimizedKey, String(value));
    } catch {
      /* Optional UI preference. */
    }
    if (restoreFocus)
      root!
        .querySelector<HTMLButtonElement>(value ? '.capsule-expand' : '[data-player-minimize]')
        ?.focus({ preventScroll: true });
    announce(value ? '播放器已收起，播放状态保持不变。' : '播放器已展开。');
  }

  function remember() {
    const position = loadedId ? audio!.currentTime : resume;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          id: current().id,
          position: audio!.ended ? 0 : position,
          volume: audio!.volume,
          mode,
        }),
      );
    } catch {
      /* Playback works when storage is full or disabled. */
    }
  }
  function status(text: string) {
    feedback = text;
    if (text) announce(text);
    each('[data-player-feedback]', (el) => {
      el.textContent = feedback;
    });
  }
  function findProgressControls() {
    return {
      current: document.querySelectorAll<HTMLElement>('[data-player-current]'),
      duration: document.querySelectorAll<HTMLElement>('[data-player-duration]'),
      seek: document.querySelectorAll<HTMLInputElement>('[data-player-seek]'),
    };
  }
  let progressControls = findProgressControls();

  function progress() {
    const duration = audio!.duration;
    const position = seekPreview ?? (loadedId ? audio!.currentTime : resume);
    const elapsed = timeLabel(position);
    const total = timeLabel(duration);
    progressControls.current.forEach((el) => {
      if (el.textContent !== elapsed) el.textContent = elapsed;
    });
    progressControls.duration.forEach((el) => {
      if (el.textContent !== total) el.textContent = total;
    });
    const disabled = !Number.isFinite(duration) || duration <= 0;
    const valueText = `${elapsed} / ${total}`;
    progressControls.seek.forEach((input) => {
      if (input.disabled !== disabled) input.disabled = disabled;
      if (input !== dragging)
        input.value = duration > 0 ? String((position / duration) * 1000) : '0';
      if (input.getAttribute('aria-valuetext') !== valueText)
        input.setAttribute('aria-valuetext', valueText);
    });
    if (Date.now() - lastStored > 5000 && loadedId) {
      remember();
      lastStored = Date.now();
    }
  }
  function render() {
    const track = current();
    const playing = !audio!.paused && !pending;
    root!.classList.toggle('is-playing', playing);
    root!.classList.toggle('is-expanded', expanded);
    root!.classList.toggle('is-minimized', minimized);
    each<HTMLElement>('[data-player-panel]', (el) => {
      el.hidden = minimized;
      el.inert = minimized;
    });
    each<HTMLElement>('[data-player-capsule]', (el) => {
      el.hidden = !minimized;
      el.inert = !minimized;
    });
    each<HTMLElement>('[data-capsule-alert]', (el) => {
      el.hidden = !feedback;
    });
    each('[data-capsule-description]', (el) => {
      el.textContent = `${track.title}，${playing ? '正在播放' : '已暂停'}${feedback ? `。${feedback}` : ''}`;
    });
    each('[data-player-restore]', (el) => {
      el.setAttribute(
        'aria-label',
        `${track.title}，展开播放器${feedback ? '，查看播放提示' : ''}`,
      );
      el.setAttribute('title', `${track.title} · 展开播放器${feedback ? '，查看播放提示' : ''}`);
    });
    each('[data-player-title]', (el) => {
      el.textContent = track.title;
    });
    each('[data-player-artist]', (el) => {
      el.textContent = track.artist;
    });
    each<HTMLImageElement>('[data-player-cover]', (el) => {
      const size = el.dataset.playerCover === 'thumbnail' ? 'thumbnail' : 'full';
      const src = withBase(coverPath(track, size));
      if (el.getAttribute('src') !== src) el.src = src;
    });
    each('[data-player-toggle]', (el) => {
      el.setAttribute('aria-label', pending ? '取消加载' : playing ? '暂停' : '播放');
      el.setAttribute('aria-busy', String(pending));
    });
    each<HTMLElement>('[data-play-icon]', (el) => {
      el.hidden = playing;
    });
    each<HTMLElement>('[data-pause-icon]', (el) => {
      el.hidden = !playing;
    });
    each<HTMLInputElement>('[data-player-volume]', (el) => {
      el.value = String(audio!.volume);
    });
    each<HTMLSelectElement>('[data-player-mode-select]', (el) => {
      el.value = mode;
    });
    each<HTMLElement>('[data-mode-icon]', (el) => {
      el.hidden = el.dataset.modeIcon !== mode;
    });
    each('[data-mode-hint]', (el) => {
      el.textContent = modeDescriptions[mode];
    });
    each('[data-mini-expand]', (el) => {
      el.setAttribute('aria-expanded', String(expanded));
      el.setAttribute(
        'aria-label',
        `${track.title} ${track.artist}，${expanded ? '收起' : '展开'}播放进度`,
      );
    });
    each<HTMLElement>('[data-play-track]', (el) => {
      const selected = el.dataset.playTrack === track.id;
      el.classList.toggle('current-track', selected);
      el.setAttribute('aria-pressed', String(selected && playing));
      el.setAttribute(
        'aria-label',
        `${selected && playing ? '暂停' : '播放'} ${playlist.find((song) => song.id === el.dataset.playTrack)?.title || ''}`,
      );
    });
    each<HTMLElement>('[data-track-state]', (el) => {
      el.textContent =
        el.dataset.trackState === track.id
          ? pending
            ? '加载中'
            : playing
              ? '播放中'
              : '已选择'
          : '播放';
    });
    each('[data-player-feedback]', (el) => {
      el.textContent = feedback;
    });
    progress();
  }
  async function play(selected = index, fromHistory = false) {
    if (selected < 0 || selected >= playlist.length) return;
    const token = ++generation;
    seekPreview = null;
    dragging = null;
    if (selected !== index) {
      if (!fromHistory) history.push(index);
      resume = 0;
    }
    index = selected;
    pending = true;
    status('');
    const retrying = loadedId === current().id && Boolean(audio!.error);
    if (loadedId !== current().id || retrying) {
      // A failed resource must be selected again before play() can recover.
      if (retrying && audio!.currentTime > 0) resume = audio!.currentTime;
      audio!.pause();
      audio!.src = withBase(current().src);
      loadedId = current().id;
      audio!.load();
    } else if (audio!.ended) audio!.currentTime = 0;
    render();
    try {
      await audio!.play();
      if (token !== generation) return;
      if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined')
        navigator.mediaSession.metadata = new MediaMetadata({
          title: current().title,
          artist: current().artist,
        });
    } catch (error) {
      if (token !== generation || (error instanceof DOMException && error.name === 'AbortError'))
        return;
      status(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? '浏览器暂停了播放，请再按一次播放按钮。'
          : '这首音乐暂时无法播放。请再次按播放重试，或检查文件路径、网络与音频格式。',
      );
    } finally {
      if (token === generation) {
        pending = false;
        render();
        remember();
      }
    }
  }
  function cancelPending() {
    remember();
    generation++;
    pending = false;
    audio!.pause();
    resume = audio!.currentTime;
    loadedId = '';
    audio!.removeAttribute('src');
    audio!.load();
    render();
  }
  function toggle() {
    if (pending) cancelPending();
    else if (audio!.paused) void play();
    else audio!.pause();
  }
  function next(ended = false) {
    const next = nextIndex(index, playlist.length, mode, ended);
    if (next < 0) {
      status('歌单已播完。');
      remember();
      render();
      return;
    }
    if (next === index && ended) audio!.currentTime = 0;
    void play(next);
  }
  function previous() {
    const selected =
      mode === 'shuffle' && history.length
        ? history.pop()!
        : (index - 1 + playlist.length) % playlist.length;
    void play(selected, true);
  }

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const el = event.target.closest<HTMLElement>('button');
    if (!el) return;
    if (el.matches('[data-player-toggle]')) toggle();
    if (el.matches('[data-player-next]')) next();
    if (el.matches('[data-player-prev]')) previous();
    if (el.matches('[data-player-minimize]')) setMinimized(true);
    if (el.matches('[data-player-restore]')) setMinimized(false);
    if (el.matches('[data-mini-expand]')) {
      expanded = !expanded;
      render();
    }
    if (el.matches('[data-queue-open]')) {
      render();
      queue.open(el);
    }
    if (el.matches('[data-queue-close]')) queue.close();
    if (el.dataset.playTrack) {
      const chosen = playlist.findIndex((track) => track.id === el.dataset.playTrack);
      if (chosen === index && !audio.paused) toggle();
      else void play(chosen);
    }
  });
  document.addEventListener('input', (event) => {
    const el = event.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (el.matches('[data-player-seek]') && Number.isFinite(audio.duration)) {
      const position = Math.max(
        0,
        Math.min(audio.duration, (Number(el.value) / 1000) * audio.duration),
      );
      if (dragging === el) seekPreview = position;
      else audio.currentTime = position;
      progress();
    }
    if (el.matches('[data-player-volume]')) {
      audio.volume = Number(el.value);
      each<HTMLInputElement>('[data-player-volume]', (input) => {
        if (input !== el) input.value = el.value;
      });
      remember();
    }
  });
  document.addEventListener('change', (event) => {
    const el = event.target;
    if (
      el instanceof HTMLSelectElement &&
      el.matches('[data-player-mode-select]') &&
      playModes.includes(el.value as PlayMode)
    ) {
      mode = el.value as PlayMode;
      render();
      remember();
      announce(`已切换为${modeLabels[mode]}。${modeDescriptions[mode]}`);
    }
    if (
      el instanceof HTMLInputElement &&
      el.matches('[data-player-seek]') &&
      Number.isFinite(audio.duration)
    ) {
      audio.currentTime = Math.max(
        0,
        Math.min(audio.duration, (Number(el.value) / 1000) * audio.duration),
      );
      seekPreview = null;
      progress();
      remember();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.matches('[data-player-seek]'))
      dragging = event.target;
  });
  document.addEventListener('pointerup', () => {
    dragging = null;
  });
  document.addEventListener('pointercancel', () => {
    dragging = null;
    seekPreview = null;
    progress();
  });
  document.addEventListener('keydown', (event) => {
    if (!(event.target instanceof HTMLElement) || !event.target.matches('[data-player-controls]'))
      return;
    if (event.key === ' ') {
      event.preventDefault();
      toggle();
    }
    if (['ArrowLeft', 'ArrowRight'].includes(event.key) && Number.isFinite(audio.duration)) {
      event.preventDefault();
      audio.currentTime = Math.max(
        0,
        Math.min(audio.duration, audio.currentTime + (event.key === 'ArrowLeft' ? -5 : 5)),
      );
    }
  });
  audio.addEventListener('loadedmetadata', () => {
    if (resume > 0 && Number.isFinite(audio.duration))
      audio.currentTime = resume < audio.duration - 1 ? resume : 0;
    resume = 0;
    progress();
  });
  audio.addEventListener('timeupdate', progress);
  audio.addEventListener('play', render);
  audio.addEventListener('pause', () => {
    render();
    remember();
  });
  audio.addEventListener('ended', () => next(true));
  audio.addEventListener('error', () => {
    if (loadedId && !pending) {
      status('音频加载失败。请再次按播放重试，或检查文件与网络。');
      render();
    }
  });
  document.addEventListener('astro:page-load', () => {
    progressControls = findProgressControls();
    minimized = pageMinimized();
    render();
  });
  document.addEventListener('astro:before-swap', () => {
    queue.close(false);
    dragging = null;
    seekPreview = null;
    remember();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) remember();
  });
  window.addEventListener('pagehide', remember);
  if ('mediaSession' in navigator) {
    const actions: [MediaSessionAction, () => void][] = [
      [
        'play',
        () => {
          void play();
        },
      ],
      ['pause', () => audio.pause()],
      ['nexttrack', () => next()],
      ['previoustrack', previous],
    ];
    for (const [action, handler] of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* Older browsers omit some actions. */
      }
    }
  }
  render();
}
