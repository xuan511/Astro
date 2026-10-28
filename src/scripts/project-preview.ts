export {};

let disposeProjectPreviews: (() => void) | undefined;

function initProjectPreviews() {
  disposeProjectPreviews?.();
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const previews: { dialog: HTMLDialogElement; button: HTMLButtonElement }[] = [];

  document.querySelectorAll<HTMLDialogElement>('[data-project-preview]').forEach((dialog) => {
    const button = dialog.parentElement?.querySelector<HTMLButtonElement>(
      '[data-project-preview-open]',
    );
    // Static project links stay usable when this enhancement is unsupported.
    if (!button || button.getAttribute('aria-controls') !== dialog.id || !dialog.showModal) return;
    previews.push({ dialog, button });
    button.hidden = false;
    button.addEventListener(
      'click',
      () => {
        if (document.querySelector('dialog[open]')) return;
        dialog.showModal();
        button.setAttribute('aria-expanded', 'true');
      },
      options,
    );
    dialog
      .querySelector('[data-project-preview-close]')
      ?.addEventListener('click', () => dialog.close(), options);
    dialog.addEventListener(
      'click',
      (event) => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          dialog.close();
      },
      options,
    );
    dialog.addEventListener(
      'close',
      () => {
        button.setAttribute('aria-expanded', 'false');
        if (button.isConnected && !document.querySelector('dialog[open]'))
          button.focus({ preventScroll: true });
      },
      options,
    );
  });

  disposeProjectPreviews = () => {
    // Abort first so our close listener cannot refocus a departing card.
    controller.abort();
    for (const { dialog, button } of previews) {
      if (dialog.open) dialog.close();
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
