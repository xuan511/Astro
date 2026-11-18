import { createDialogController } from '../lib/dialog';
import { parseAppearance, scenes, type Scene } from '../lib/appearance-preferences';
declare global {
  var __shijianAppearance: { key: string; apply: () => void } | undefined;
}

const element = document.querySelector<HTMLElement>('[data-appearance-root]');
if (element) {
  const root = element;
  const key = `shijian:${document.body.dataset.base || '/'}:appearance-v1`;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(key);
  } catch {
    /* Optional persistence. */
  }
  const preference = parseAppearance(stored);
  const dialog = root.querySelector<HTMLDialogElement>('dialog');
  const surface = root.querySelector<HTMLInputElement>('[data-appearance-solid]');
  const controller = createDialogController(dialog, {
    initialFocus: () => dialog?.querySelector<HTMLButtonElement>('[aria-pressed="true"]'),
  });
  function render() {
    document.documentElement.dataset.scene = preference.scene;
    document.documentElement.dataset.solid = String(preference.solid);
    if (surface) surface.checked = preference.solid;
    document.querySelectorAll<HTMLButtonElement>('[data-scene-choice]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.sceneChoice === preference.scene));
    });
    document.querySelectorAll<HTMLElement>('[data-appearance-open]').forEach((button) => {
      button.hidden = !controller.supported;
    });
  }
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(preference));
    } catch {
      /* Current session works. */
    }
    render();
  }
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('button');
    if (!button) return;
    if (button.hasAttribute('data-appearance-open')) controller.open(button);
    if (button.hasAttribute('data-appearance-close')) controller.close();
    const scene = button.dataset.sceneChoice;
    if (scenes.includes(scene as Scene)) {
      preference.scene = scene as Scene;
      save();
    }
  });
  surface?.addEventListener('change', () => {
    preference.solid = surface.checked;
    save();
  });
  document.addEventListener('astro:before-swap', () => controller.close(false));
  document.addEventListener('astro:page-load', render);
  globalThis.__shijianAppearance = { key, apply: render };
  render();
}
