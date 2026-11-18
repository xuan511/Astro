let dispose: (() => void) | undefined;
function initSpotlight() {
  dispose?.();
  const root = document.querySelector<HTMLElement>('[data-spotlight]');
  if (!root) return;
  const slides = [...root.querySelectorAll<HTMLElement>('[data-spotlight-slide]')];
  const controls = root.querySelector<HTMLElement>('[data-spotlight-controls]');
  if (!controls || slides.length < 2) return;
  const controller = new AbortController();
  let current = 0;
  function show(index: number) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.hidden = i !== current;
      slide.inert = i !== current;
    });
    controls!.querySelectorAll<HTMLElement>('[data-spotlight-index]').forEach((button) => {
      button.setAttribute(
        'aria-pressed',
        String(Number(button.dataset.spotlightIndex) === current),
      );
    });
    const count = root!.querySelector('output');
    if (count)
      count.textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
  }
  controls.hidden = false;
  controls.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLElement>('button');
      if (!button) return;
      if (button.hasAttribute('data-spotlight-prev')) show(current - 1);
      else if (button.hasAttribute('data-spotlight-next')) show(current + 1);
      else if (button.dataset.spotlightIndex !== undefined)
        show(Number(button.dataset.spotlightIndex));
    },
    { signal: controller.signal },
  );
  controls.addEventListener(
    'keydown',
    (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      show(
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? slides.length - 1
            : current + (event.key === 'ArrowLeft' ? -1 : 1),
      );
    },
    { signal: controller.signal },
  );
  show(0);
  dispose = () => controller.abort();
}
document.addEventListener('astro:page-load', initSpotlight);
document.addEventListener('astro:before-swap', () => dispose?.());
initSpotlight();
