import type { ReactionPlan } from '../lib/companion-reactions';

/** Each interaction owns a finite batch. Repeated clicks replace it instead of stacking work. */
export function createCompanionMotion(
  root: HTMLElement,
  figure: HTMLElement,
  effects: HTMLElement,
) {
  let animations: Animation[] = [];
  let generation = 0;
  function stop() {
    generation++;
    animations.forEach((animation) => animation.cancel());
    animations = [];
    effects.replaceChildren();
    root.classList.remove('is-reacting');
    delete root.dataset.reaction;
  }
  function play(plan: ReactionPlan, enabled: boolean) {
    stop();
    if (!enabled || typeof figure.animate !== 'function') return false;
    const batch = generation;
    root.dataset.reaction = plan.name;
    root.classList.add('is-reacting');
    animations.push(
      figure.animate(plan.frames, {
        duration: plan.duration,
        easing: 'cubic-bezier(.22,.7,.3,1)',
        fill: 'none',
      }),
    );
    for (let index = 0; index < plan.particles; index++) {
      const particle = figure.ownerDocument.createElement('span');
      particle.className = 'companion-particle';
      particle.dataset.tone = plan.tone;
      particle.textContent = plan.symbols[index % plan.symbols.length];
      effects.append(particle);
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (18 + (index % 4) * 10);
      const y = -40 - (index % 3) * 20;
      animations.push(
        particle.animate(
          [
            { transform: 'translate(-50%, 0) scale(.35)', opacity: 0 },
            { opacity: 1, offset: 0.18 },
            {
              transform: `translate(calc(-50% + ${x}px), ${y}px) rotate(${side * 22}deg) scale(1)`,
              opacity: 0.95,
              offset: 0.7,
            },
            {
              transform: `translate(calc(-50% + ${x * 1.1}px), ${y - 15}px) rotate(${side * 32}deg) scale(.65)`,
              opacity: 0,
            },
          ],
          { duration: plan.duration + 150, delay: index * 24, easing: 'ease-out', fill: 'both' },
        ),
      );
    }
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (generation === batch) stop();
    });
    return true;
  }
  return { play, stop };
}
