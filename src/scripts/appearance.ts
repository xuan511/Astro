import { createDialogController } from '../lib/dialog';
import {
  parseDisplay,
  sceneModes,
  postModes,
  type DisplayPreference,
} from '../lib/layout-preferences';
declare global {
  var __shijianAppearance: { key: string; apply: () => void } | undefined;
}

const element = document.querySelector<HTMLElement>('[data-appearance-root]');
if (element && !globalThis.__shijianAppearance) {
  const root = element;
  const key = `shijian:${document.body.dataset.base || '/'}:appearance-v1`;
  const config: { defaults: DisplayPreference; fonts: { id: string; family: string }[] } =
    JSON.parse(root.querySelector('[data-display-config]')?.textContent || '{}');
  const fontIds = config.fonts.map((font) => font.id);
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(key);
  } catch {
    /* Optional storage. */
  }
  let preference = parseDisplay(stored, config.defaults, fontIds);
  const dialog = root.querySelector<HTMLDialogElement>('dialog');
  const surface = root.querySelector<HTMLInputElement>('[data-appearance-solid]');
  const hue = root.querySelector<HTMLInputElement>('[data-display-hue]');
  const controller = createDialogController(dialog, {
    initialFocus: () => dialog?.querySelector('select'),
  });
  function render() {
    const html = document.documentElement;
    for (const name of ['sidebar', 'layout', 'wallpaper', 'scene', 'solid', 'font'] as const)
      html.dataset[name] = String(preference[name]);
    html.style.setProperty('--theme-hue', String(preference.hue));
    html.style.setProperty(
      '--site-font',
      config.fonts.find((font) => font.id === preference.font)!.family,
    );
    if (surface) surface.checked = preference.solid;
    if (hue) hue.value = String(preference.hue);
    root.querySelectorAll('[data-hue-label]').forEach((label) => {
      label.textContent = `${preference.hue}°`;
    });
    root.querySelectorAll<HTMLSelectElement>('[data-display-select]').forEach((select) => {
      select.value = String(preference[select.dataset.displaySelect as keyof DisplayPreference]);
    });
    document
      .querySelectorAll<HTMLElement>('[data-scene-choice]')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.sceneChoice === preference.scene),
        ),
      );
    document
      .querySelectorAll<HTMLElement>('[data-layout-choice]')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.layoutChoice === preference.layout),
        ),
      );
    document.querySelectorAll<HTMLElement>('[data-appearance-open]').forEach((button) => {
      button.hidden = !controller.supported;
    });
    document.querySelectorAll<HTMLElement>('[data-layout-controls]').forEach((controls) => {
      controls.hidden = false;
    });
    document.dispatchEvent(new Event('shijian:display-change'));
  }
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(preference));
    } catch {
      /* Session still works. */
    }
    render();
  }
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.hasAttribute('data-appearance-open')) controller.open(button);
    if (button.hasAttribute('data-appearance-close')) controller.close();
    if (button.hasAttribute('data-display-reset')) {
      preference = { ...config.defaults };
      save();
    }
    if (sceneModes.includes(button.dataset.sceneChoice as DisplayPreference['scene'])) {
      preference.scene = button.dataset.sceneChoice as DisplayPreference['scene'];
      save();
    }
    if (postModes.includes(button.dataset.layoutChoice as DisplayPreference['layout'])) {
      preference.layout = button.dataset.layoutChoice as DisplayPreference['layout'];
      save();
    }
  });
  root.addEventListener('change', (event) => {
    if (!(event.target instanceof Element)) return;
    if (
      event.target instanceof HTMLSelectElement &&
      event.target.hasAttribute('data-display-select')
    ) {
      preference = parseDisplay(
        JSON.stringify({
          ...preference,
          [event.target.dataset.displaySelect!]: event.target.value,
        }),
        config.defaults,
        fontIds,
      );
      save();
    }
    if (event.target === surface && surface) {
      preference.solid = surface.checked;
      save();
    }
  });
  hue?.addEventListener('input', () => {
    preference.hue = Number(hue.value);
    save();
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== key) return;
    preference = parseDisplay(event.newValue, config.defaults, fontIds);
    render();
  });
  document.addEventListener('astro:before-swap', () => controller.close(false));
  document.addEventListener('astro:after-swap', render);
  document.addEventListener('astro:page-load', render);
  globalThis.__shijianAppearance = { key, apply: render };
  render();
}
