export interface Companion {
  id: string;
  name: string;
  work: string;
  image: string;
  lines: string[];
}
export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}
export interface Bounds extends Point, Size {}
export interface CompanionPreference {
  id: string;
  compact: boolean;
  hidden: boolean;
  quiet: boolean;
  position: Point | null;
}
const clamp = (value: number, maximum: number, minimum = 0) =>
  Math.min(Math.max(minimum, maximum), Math.max(minimum, value));

export function parseCompanions(raw: string): Companion[] {
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    const ids = new Set<string>();
    return values.filter((item): item is Companion => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.id !== 'string' ||
        !/^[a-z][a-z0-9-]*$/.test(item.id) ||
        ids.has(item.id) ||
        typeof item.name !== 'string' ||
        !item.name.trim() ||
        typeof item.work !== 'string' ||
        !item.work.trim() ||
        typeof item.image !== 'string' ||
        !/^\/(?!\/)[^?#]+\.(webp|png)$/.test(item.image) ||
        !Array.isArray(item.lines) ||
        !item.lines.length ||
        !item.lines.every((line: unknown) => typeof line === 'string' && line.trim())
      )
        return false;
      ids.add(item.id);
      return true;
    });
  } catch {
    return [];
  }
}

export function parseCompanionPreference(
  raw: string | null,
  catalog: readonly Companion[],
  mobile = false,
): CompanionPreference {
  let saved: Partial<CompanionPreference> = {};
  try {
    const value: unknown = JSON.parse(raw || '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) saved = value;
  } catch {
    /* Preferences are optional. */
  }
  const point = saved.position;
  return {
    id: catalog.find((item) => item.id === saved.id)?.id || catalog[0]?.id || '',
    compact: typeof saved.compact === 'boolean' ? saved.compact : mobile,
    hidden: saved.hidden === true,
    quiet: saved.quiet === true,
    position:
      point && Number.isFinite(point.x) && Number.isFinite(point.y)
        ? { x: clamp(point.x, 1), y: clamp(point.y, 1) }
        : null,
  };
}

/** Keep the entire control reachable, and move above the music controls on collision. */
export function placeCompanion(
  desired: Point,
  size: Size,
  viewport: Size,
  obstacle?: Bounds | null,
): Point {
  const gap = 12;
  const x = clamp(desired.x, viewport.width - size.width - gap, gap);
  let y = clamp(desired.y, viewport.height - size.height - gap, gap);
  if (
    obstacle &&
    x < obstacle.x + obstacle.width + gap &&
    x + size.width + gap > obstacle.x &&
    y < obstacle.y + obstacle.height + gap &&
    y + size.height + gap > obstacle.y
  ) {
    const above = obstacle.y - size.height - gap;
    if (above >= gap) y = above;
    else {
      const left = obstacle.x - size.width - gap;
      const right = obstacle.x + obstacle.width + gap;
      if (left >= gap) return { x: left, y };
      if (right + size.width <= viewport.width - gap) return { x: right, y };
      y = clamp(obstacle.y + obstacle.height + gap, viewport.height - size.height - gap, gap);
    }
  }
  return { x, y };
}

export function normalizePosition(point: Point, size: Size, viewport: Size): Point {
  return {
    x: clamp(point.x / Math.max(1, viewport.width - size.width), 1),
    y: clamp(point.y / Math.max(1, viewport.height - size.height), 1),
  };
}
