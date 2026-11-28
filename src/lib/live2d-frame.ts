export interface Live2DVisibility {
  enabled: boolean;
  hidden: boolean;
  compact: boolean;
  quiet: boolean;
  reducedMotion: boolean;
  mobile: boolean;
  away: boolean;
}

export function shouldMountLive2D(value: Live2DVisibility): boolean {
  return (
    value.enabled &&
    !value.hidden &&
    !value.compact &&
    !value.quiet &&
    !value.reducedMotion &&
    !value.mobile &&
    !value.away
  );
}

interface FrameHandle {
  remove(): void;
}
/** One browsing context owns the engine, network work and RAF loop, even during loading. */
export function createLive2DFrame<T extends FrameHandle>(
  mount: () => T,
  changed: (state: 'off' | 'loading' | 'ready' | 'error') => void,
) {
  let frame: T | null = null;
  let blocked = false;
  return {
    sync(visible: boolean) {
      if (!visible) {
        frame?.remove();
        frame = null;
        blocked = false;
        changed('off');
      } else if (!frame && !blocked) {
        changed('loading');
        frame = mount();
      }
    },
    ready(source: T) {
      if (source === frame) changed('ready');
    },
    fail(source: T) {
      if (source !== frame) return;
      frame.remove();
      frame = null;
      blocked = true;
      changed('error');
    },
    get current() {
      return frame;
    },
  };
}
