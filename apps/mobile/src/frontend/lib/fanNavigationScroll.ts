/** In-memory fan dock scroll decisions; only meaningful direction changes notify React.
 * The idle timer restores the backdrop without collecting or changing usage telemetry.
 */
const TRAVEL = 12;
const SAMPLE_MS = 80;
const IDLE_MS = 600;

/** @purpose Soften only the dock backdrop on downward travel; restore on up, stop or focus. */
export function createFanNavigationScroll(onChange: (softened: boolean) => void) {
  let anchor: number | undefined;
  let observed: number | undefined;
  let lastDecision = -Infinity;
  let softened = false;
  let idle: ReturnType<typeof setTimeout> | undefined;

  const change = (next: boolean) => {
    if (next === softened) return;
    softened = next;
    onChange(next);
  };
  const cancelIdle = () => { if (idle !== undefined) clearTimeout(idle); idle = undefined; };
  const restore = () => {
    cancelIdle();
    change(false);
    anchor = observed;
    lastDecision = -Infinity;
  };

  return {
    sample(offset: number) {
      if (!Number.isFinite(offset)) return;
      const y = Math.max(0, offset);
      if (anchor === undefined) { anchor = y; observed = y; return; }
      if (y !== observed) {
        observed = y;
        cancelIdle();
        idle = setTimeout(restore, IDLE_MS);
      }
      const now = Date.now();
      if (now - lastDecision < SAMPLE_MS || Math.abs(y - anchor) < TRAVEL) return;
      change(y > anchor);
      anchor = y;
      lastDecision = now;
    },
    restore,
    reset() { restore(); anchor = undefined; observed = undefined; },
    dispose: cancelIdle,
  };
}
