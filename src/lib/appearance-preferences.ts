export const scenes = ['coast', 'mist', 'paper'] as const;
export type Scene = (typeof scenes)[number];
export interface AppearancePreference {
  scene: Scene;
  solid: boolean;
}
export function parseAppearance(raw: string | null): AppearancePreference {
  try {
    const value = JSON.parse(raw || '{}');
    return {
      scene: scenes.includes(value?.scene) ? value.scene : 'coast',
      solid: value?.solid === true,
    };
  } catch {
    return { scene: 'coast', solid: false };
  }
}

/** Validated, self-contained bootstrap runs before paint, including client navigation. */
export function appearanceBootstrap(key: string) {
  const encoded = JSON.stringify(key).replaceAll('<', '\\u003c');
  return `(()=>{const key=${encoded};const session=globalThis.__shijianAppearance;if(session?.key===key){session.apply();return}let p;try{p=JSON.parse(localStorage.getItem(key)||'{}')}catch{}document.documentElement.dataset.scene=['coast','mist','paper'].includes(p?.scene)?p.scene:'coast';document.documentElement.dataset.solid=String(p?.solid===true)})()`;
}
