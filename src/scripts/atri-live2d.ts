import { init } from 'l2d';

// This module is referenced only by the isolated iframe, never by the shared page shell.
const canvas = document.querySelector('canvas')!;
const model = document.body.dataset.live2dModel!;
const send = (type: string) => parent.postMessage({ source: 'qing-atri', type }, location.origin);
if (parent !== window) {
  const ratio = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(innerWidth * ratio);
  canvas.height = Math.round(innerHeight * ratio);
  const engine = init(canvas);
  let ready = false;
  let timer = 0;
  let look: Record<string, number> = {};
  let allowed = new Set<string>();
  const apply = (extra: Record<string, number> = {}) => {
    if (ready)
      engine.setParams(
        Object.fromEntries(Object.entries({ ...look, ...extra }).filter(([id]) => allowed.has(id))),
      );
  };
  const deadline = setTimeout(() => send('error'), 20000);
  engine.on('loaded', () => {
    clearTimeout(deadline);
    allowed = new Set(engine.getParams().map((param) => param.id));
    ready = true;
    send('ready');
  });
  window.addEventListener('message', (event) => {
    if (
      event.source !== parent ||
      event.origin !== location.origin ||
      event.data?.source !== 'qing-atri-control' ||
      !ready
    )
      return;
    if (event.data.type === 'look') {
      const { x, y } = event.data;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const clamp = (value: number) => Math.max(-1, Math.min(1, value));
      look = {
        ParamAngleX: clamp(x) * 18,
        ParamAngleY: clamp(y) * 12,
        ParamEyeBallX: clamp(x),
        ParamEyeBallY: clamp(y),
      };
      apply();
    } else if (event.data.type === 'pet' || event.data.type === 'tap') {
      clearTimeout(timer);
      apply({
        ParamMouthForm: 1,
        ParamCheek: 0.55,
        ...(event.data.type === 'pet'
          ? { ParamEyeLSmile: 1, ParamEyeRSmile: 1, ParamEyeLOpen: 0.65, ParamEyeROpen: 0.65 }
          : {}),
      });
      timer = window.setTimeout(() => apply(), 1400);
    } else if (event.data.type === 'reset') {
      look = {};
      apply();
    }
  });
  window.addEventListener(
    'pagehide',
    () => {
      clearTimeout(deadline);
      clearTimeout(timer);
      ready = false;
      engine.destroy();
    },
    { once: true },
  );
  engine.load({ path: model, volume: 0, logLevel: 'error', scale: 0.95 }).catch(() => {
    clearTimeout(deadline);
    send('error');
  });
}
