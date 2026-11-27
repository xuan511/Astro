import { masonryPositions } from '../lib/layout-preferences';
let dispose = () => {};
function mountFeeds() {
  dispose();
  const feeds = [...document.querySelectorAll<HTMLElement>('[data-post-feed]')];
  if (!feeds.length) {
    dispose = () => {};
    return;
  }
  const cards = new Map(
    feeds.map((feed) => [
      feed,
      [...feed.children].filter((card): card is HTMLElement => card instanceof HTMLElement),
    ]),
  );
  let active = true,
    frame = 0;
  let observer: ResizeObserver | null = null;
  let observing = false;
  function reset() {
    for (const feed of feeds) {
      if (!feed.dataset.masonryReady) continue;
      delete feed.dataset.masonryReady;
      feed.style.removeProperty('height');
      cards.get(feed)!.forEach((card) => {
        for (const name of ['width', 'left', 'top']) card.style.removeProperty(name);
      });
    }
  }
  function layout() {
    frame = 0;
    if (!active || document.documentElement.dataset.layout !== 'masonry') return;
    for (const feed of feeds) {
      const children = cards.get(feed)!;
      const width = feed.clientWidth,
        minimum = Number(feed.dataset.columnWidth) || 280,
        gap = Number(feed.dataset.cardGap) || 20;
      const sizing = masonryPositions(width, minimum, gap, []);
      children.forEach((card) => {
        card.style.width = `${sizing.columnWidth}px`;
      });
      const result = masonryPositions(
        width,
        minimum,
        gap,
        children.map((card) => card.offsetHeight),
      );
      children.forEach((card, index) => {
        card.style.left = `${result.items[index].x}px`;
        card.style.top = `${result.items[index].y}px`;
      });
      feed.style.height = `${result.height}px`;
      feed.dataset.masonryReady = 'true';
    }
  }
  function schedule() {
    if (active && !frame) frame = requestAnimationFrame(layout);
  }
  function configure() {
    if (document.documentElement.dataset.layout === 'masonry') {
      if (!observing) {
        observing = true;
        if (typeof ResizeObserver === 'function') {
          observer = new ResizeObserver(schedule);
          feeds.forEach((feed) => {
            observer!.observe(feed);
            cards.get(feed)!.forEach((card) => observer!.observe(card));
          });
        } else window.addEventListener('resize', schedule, { passive: true });
      }
      schedule();
    } else {
      observing = false;
      observer?.disconnect();
      observer = null;
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
      frame = 0;
      reset();
    }
  }
  document.addEventListener('shijian:display-change', configure);
  document.fonts?.ready.then(() => {
    if (active && observing) schedule();
  });
  configure();
  dispose = () => {
    active = false;
    observer?.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('shijian:display-change', configure);
  };
}
document.addEventListener('astro:before-swap', () => dispose());
document.addEventListener('astro:page-load', mountFeeds);
mountFeeds();
