import { createDialogController } from '../lib/dialog';

let disposeProjectPreviews: (() => void) | undefined;

function initProjectPreviews() {
  disposeProjectPreviews?.();
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const previews: {
    modal: ReturnType<typeof createDialogController>;
    button: HTMLButtonElement;
  }[] = [];

  document.querySelectorAll<HTMLDialogElement>('[data-project-preview]').forEach((dialog) => {
    const button = dialog.parentElement?.querySelector<HTMLButtonElement>(
      '[data-project-preview-open]',
    );
    // Static project links stay usable when this enhancement is unsupported.
    if (!button || button.getAttribute('aria-controls') !== dialog.id) return;
    const modal = createDialogController(dialog, {
      onOpen: () => button.setAttribute('aria-expanded', 'true'),
      onClose: () => button.setAttribute('aria-expanded', 'false'),
    });
    if (!modal.supported) return;
    previews.push({ modal, button });
    button.hidden = false;
    button.addEventListener(
      'click',
      () => {
        modal.open(button);
      },
      options,
    );
    dialog
      .querySelector('[data-project-preview-close]')
      ?.addEventListener('click', () => modal.close(), options);
  });

  disposeProjectPreviews = () => {
    // Abort first so our close listener cannot refocus a departing card.
    controller.abort();
    for (const { modal, button } of previews) {
      modal.destroy();
      button.setAttribute('aria-expanded', 'false');
      button.hidden = true;
    }
  };
}

document.addEventListener('astro:page-load', initProjectPreviews);
document.addEventListener('astro:before-swap', () => {
  disposeProjectPreviews?.();
  disposeProjectPreviews = undefined;
});
initProjectPreviews();
