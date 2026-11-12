interface DialogOptions {
  initialFocus?: () => HTMLElement | null | undefined;
  onOpen?: () => void;
  onClose?: () => void;
  /** Full-screen image viewers intentionally close on their empty surface. */
  closeOnSurface?: boolean;
}

/** One native-dialog policy shared by search, project previews and image viewing. */
export function createDialogController(
  dialog: HTMLDialogElement | null,
  options: DialogOptions = {},
) {
  const supported = Boolean(dialog && typeof dialog.showModal === 'function');
  const listeners = new AbortController();
  let trigger: HTMLElement | null = null;
  let restoreFocus = true;
  let destroyed = false;

  function close(restore = true) {
    restoreFocus = restore;
    if (dialog?.open) dialog.close();
  }
  if (supported && dialog) {
    dialog.addEventListener(
      'close',
      () => {
        // A delayed native close event can arrive after the same dialog was reopened.
        if (dialog.open) return;
        options.onClose?.();
        if (restoreFocus && trigger?.isConnected && !document.querySelector('dialog[open]'))
          trigger.focus({ preventScroll: true });
        trigger = null;
      },
      { signal: listeners.signal },
    );
    dialog.addEventListener(
      'click',
      (event) => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        const outside =
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom;
        if (options.closeOnSurface || outside) close();
      },
      { signal: listeners.signal },
    );
  }

  return {
    supported,
    open(source?: HTMLElement | null) {
      if (destroyed || !supported || !dialog?.isConnected || document.querySelector('dialog[open]'))
        return false;
      trigger =
        source || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      restoreFocus = true;
      dialog.showModal();
      options.onOpen?.();
      options.initialFocus?.()?.focus({ preventScroll: true });
      return true;
    },
    close,
    destroy() {
      destroyed = true;
      listeners.abort();
      trigger = null;
      close(false);
    },
  };
}
