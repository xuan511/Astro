import { masonryPositions } from '../lib/layout-preferences';
let dispose = () => {};
function mountFeeds() {
  dispose();
  const feeds = [...document.querySelectorAll<HTMLElement>('[data-post-feed]')];
  let frame = 0;
  let active = true;
  const reset = (feed: HTMLElement) => {
    delete feed.dataset.masonryReady;
    feed.style.removeProperty('height');
    for (const card of feed.children)
      if (card instanceof HTMLElement) {
        for (const name of ['width', 'left', 'top']) card.style.removeProperty(name);
      }
  };
  function layout() {
    frame = 0;
    for (const feed of feeds) {
      if (document.documentElement.dataset.layout !== 'masonry') {
        reset(feed);
        continue;
      }
      const cards = [...feed.children].filter(
        (card): card is HTMLElement => card instanceof HTMLElement,
      );
      const width = feed.clientWidth;
      const minimum = Number(feed.dataset.columnWidth) || 280;
      const gap = Number(feed.dataset.cardGap) || 20;
      const sizing = masonryPositions(width, minimum, gap, []);
      cards.forEach((card) => {
        card.style.width = `${sizing.columnWidth}px`;
      });
      const result = masonryPositions(
        width,
        minimum,
        gap,
        cards.map((card) => card.offsetHeight),
      );
      cards.forEach((card, index) => {
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
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  feeds.forEach((feed) => {
    observer?.observe(feed);
    [...feed.children].forEach((card) => observer?.observe(card));
  });
  document.addEventListener('shijian:display-change', schedule);
  window.addEventListener('resize', schedule, { passive: true });
  document.fonts?.ready.then(schedule);
  schedule();
  dispose = () => {
    active = false;
    observer?.disconnect();
    cancelAnimationFrame(frame);
    document.removeEventListener('shijian:display-change', schedule);
    window.removeEventListener('resize', schedule);
  };
}
document.addEventListener('astro:before-swap', () => dispose());
document.addEventListener('astro:page-load', mountFeeds);
mountFeeds();
