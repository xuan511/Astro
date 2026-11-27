export const sidebarModes = ['left', 'right', 'both', 'none'] as const;
export const postModes = ['list', 'grid', 'masonry'] as const;
export const wallpaperModes = ['banner', 'fullscreen', 'transparent', 'solid'] as const;
export const sceneModes = ['coast', 'mist', 'paper'] as const;
export interface DisplayPreference {
  paletteVersion: 2;
  sidebar: (typeof sidebarModes)[number];
  layout: (typeof postModes)[number];
  wallpaper: (typeof wallpaperModes)[number];
  scene: (typeof sceneModes)[number];
  solid: boolean;
  hue: number;
  font: string;
}
export const displayDefaults: DisplayPreference = {
  paletteVersion: 2,
  sidebar: 'both',
  layout: 'grid',
  wallpaper: 'banner',
  scene: 'coast',
  solid: false,
  hue: 205,
  font: 'system',
};
/** Pure and embedded before paint: storage never supplies CSS, URLs or HTML. */
export function parseDisplay(
  raw: string | null,
  defaults: DisplayPreference = displayDefaults,
  fontIds: readonly string[] = ['system'],
): DisplayPreference {
  let value;
  try {
    value = JSON.parse(raw || '{}');
  } catch {
    /* Use configured defaults. */
  }
  const choose = <T extends string>(options: readonly T[], candidate: unknown, fallback: T): T =>
    options.includes(candidate as T) ? (candidate as T) : fallback;
  return {
    paletteVersion: 2,
    sidebar: choose(['left', 'right', 'both', 'none'], value?.sidebar, defaults.sidebar),
    layout: choose(['list', 'grid', 'masonry'], value?.layout, defaults.layout),
    wallpaper: choose(
      ['banner', 'fullscreen', 'transparent', 'solid'],
      value?.wallpaper,
      defaults.wallpaper,
    ),
    scene: choose(['coast', 'mist', 'paper'], value?.scene, defaults.scene),
    solid: typeof value?.solid === 'boolean' ? value.solid : defaults.solid,
    hue:
      value?.paletteVersion !== 2 && value?.hue === 165
        ? defaults.hue
        : typeof value?.hue === 'number' && Number.isFinite(value.hue)
          ? Math.round(Math.max(0, Math.min(359, value.hue)))
          : defaults.hue,
    font: fontIds.includes(value?.font) ? value.font : defaults.font,
  };
}
export function displayBootstrap(
  key: string,
  defaults: DisplayPreference,
  fonts: readonly { id: string; family: string }[],
) {
  const config = JSON.stringify({ key, defaults, fonts }).replaceAll('<', '\\u003c');
  return `(()=>{const c=${config};const session=globalThis.__shijianAppearance;if(session?.key===c.key){session.apply();return}let raw;try{raw=localStorage.getItem(c.key)}catch{}const p=(${parseDisplay.toString()})(raw,c.defaults,c.fonts.map(f=>f.id));const root=document.documentElement;for(const k of ['sidebar','layout','wallpaper','scene','solid','font'])root.dataset[k]=String(p[k]);root.style.setProperty('--theme-hue',String(p.hue));root.style.setProperty('--site-font',c.fonts.find(f=>f.id===p.font)?.family||c.fonts[0].family)})()`;
}

/** Shortest-column packing, preserving source order and a regular-grid fallback. */
export function masonryPositions(
  width: number,
  minimum: number,
  gap: number,
  heights: readonly number[],
) {
  const columns = Math.max(1, Math.floor((width + gap) / (minimum + gap)));
  const columnWidth = Math.max(0, (width - gap * (columns - 1)) / columns);
  const bottoms = Array<number>(columns).fill(0);
  const items = heights.map((height) => {
    const column = bottoms.indexOf(Math.min(...bottoms));
    const item = { x: column * (columnWidth + gap), y: bottoms[column], width: columnWidth };
    bottoms[column] += Math.max(0, height) + gap;
    return item;
  });
  return {
    columns,
    columnWidth,
    items,
    height: Math.max(0, ...bottoms) - (heights.length ? gap : 0),
  };
}
