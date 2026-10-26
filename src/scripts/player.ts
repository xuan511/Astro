import { withBase } from '../lib/paths';
import {
  type Track,
  type PlayMode,
  parsePreference,
  nextIndex,
  playModes,
  modeLabels,
  timeLabel,
} from '../lib/player-state';

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
  let feedback = '';
  let dragging: HTMLInputElement | null = null;
  let lastStored = 0;
  let resume = preference.position;
  const history: number[] = [];
  const dialog = root.querySelector<HTMLDialogElement>('dialog');
  const each = <T extends Element = HTMLElement>(selector: string, fn: (el: T) => void) =>
    document.querySelectorAll<T>(selector).forEach(fn);
  const current = () => playlist[index]!;

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
    each('[data-player-feedback]', (el) => {
      el.textContent = feedback;
    });
  }
  function progress() {
    const duration = audio!.duration;
    const position = loadedId ? audio!.currentTime : resume;
    each('[data-player-current]', (el) => {
      el.textContent = timeLabel(position);
    });
    each('[data-player-duration]', (el) => {
      el.textContent = timeLabel(duration);
    });
    each<HTMLInputElement>('[data-player-seek]', (input) => {
      input.disabled = !Number.isFinite(duration) || duration <= 0;
      if (input !== dragging)
        input.value = duration > 0 ? String((position / duration) * 1000) : '0';
      input.setAttribute('aria-valuetext', `${timeLabel(position)} / ${timeLabel(duration)}`);
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
    each('[data-player-title]', (el) => {
      el.textContent = track.title;
    });
    each('[data-player-artist]', (el) => {
      el.textContent = track.artist;
    });
    each<HTMLImageElement>('[data-player-cover]', (el) => {
      const src = withBase(track.cover || 'images/avatar.svg');
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
    each('[data-player-mode]', (el) => {
      el.setAttribute('aria-label', `播放模式：${modeLabels[mode]}，点击切换`);
      el.setAttribute('title', modeLabels[mode]);
    });
    each('[data-mode-label]', (el) => {
      el.textContent = modeLabels[mode];
    });
    each('[data-mini-expand]', (el) => {
      el.setAttribute('aria-expanded', String(expanded));
      el.setAttribute('aria-label', expanded ? '收起播放进度' : '展开播放进度');
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
    if (el.matches('[data-player-mode]')) {
      mode = playModes[(playModes.indexOf(mode) + 1) % playModes.length]!;
      render();
      remember();
    }
    if (el.matches('[data-mini-expand]')) {
      expanded = !expanded;
      render();
    }
    if (el.matches('[data-queue-open]')) {
      render();
      if (!dialog?.open) dialog?.showModal();
    }
    if (el.matches('[data-queue-close]')) dialog?.close();
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
      audio.currentTime = (Number(el.value) / 1000) * audio.duration;
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
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.matches('[data-player-seek]'))
      dragging = event.target;
  });
  document.addEventListener('pointerup', () => {
    dragging = null;
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
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
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
  document.addEventListener('astro:page-load', render);
  document.addEventListener('astro:before-swap', () => {
    dialog?.close();
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
