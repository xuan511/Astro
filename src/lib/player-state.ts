export type PlayMode = 'sequence' | 'repeat-one' | 'shuffle';
export interface Track {
  id: string;
  title: string;
  artist: string;
  src: string;
  cover?: string;
  demo: boolean;
}
export interface PlayerPreference {
  id: string;
  position: number;
  volume: number;
  mode: PlayMode;
}
export const playModes: PlayMode[] = ['sequence', 'repeat-one', 'shuffle'];
export const modeLabels: Record<PlayMode, string> = {
  sequence: '顺序播放',
  'repeat-one': '单曲循环',
  shuffle: '随机播放',
};

export function parsePreference(
  raw: string | null,
  playlist?: readonly Pick<Track, 'id'>[],
): PlayerPreference {
  const fallback: PlayerPreference = { id: '', position: 0, volume: 0.55, mode: 'sequence' };
  try {
    const value = JSON.parse(raw || 'null');
    if (!value || typeof value !== 'object') return fallback;
    const id = typeof value.id === 'string' ? value.id : '';
    const knownTrack = playlist === undefined || playlist.some((track) => track.id === id);
    return {
      id: knownTrack ? id : '',
      position: knownTrack && Number.isFinite(value.position) ? Math.max(0, value.position) : 0,
      volume: Number.isFinite(value.volume)
        ? Math.max(0, Math.min(1, value.volume))
        : fallback.volume,
      mode: playModes.includes(value.mode) ? value.mode : fallback.mode,
    };
  } catch {
    return fallback;
  }
}

export function nextIndex(
  index: number,
  count: number,
  mode: PlayMode,
  ended = false,
  random = Math.random,
): number {
  if (count <= 0) return -1;
  if (mode === 'repeat-one' && ended) return Math.max(0, index);
  if (mode === 'shuffle') {
    if (count === 1) return 0;
    const pick = Math.min(count - 2, Math.floor(Math.max(0, random()) * (count - 1)));
    return pick >= index ? pick + 1 : pick;
  }
  if (ended && index >= count - 1) return -1;
  return (index + 1) % count;
}

export function timeLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
