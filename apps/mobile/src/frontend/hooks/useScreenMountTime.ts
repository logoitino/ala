/**
 * Mount-to-first-effect latency for one key surface, sent once while the smoothness flag is on.
 * The mount mark is captured on first render; the runtime flag can arrive later (async config
 * fetch), so emission waits for it instead of measuring flag latency. Missing `layouts` (old
 * mocks/rows) stays silent. Flag default off until 20261020173000 is applied.
 * @sideEffects One `screen_mount` telemetry row per mount, at most.
 */

import { useEffect, useRef } from 'react';

import { useAppRuntime } from '@/context/AppRuntimeContext';
import { telemetry } from '@/services/TelemetryManager';

/** @purpose Time this surface's mount and report it once the smoothness flag allows. */
export function useScreenMountTime(surface: string): void {
  const { live } = useAppRuntime();
  const mountAt = useRef<number | null>(null);
  if (mountAt.current === null) mountAt.current = performance.now();
  const sent = useRef(false);
  const enabled = live.layouts?.telemetrySmoothness === true;
  useEffect(() => {
    if (enabled && !sent.current) {
      sent.current = true;
      telemetry.trackScreenMount(surface, performance.now() - (mountAt.current ?? performance.now()));
    }
  }, [enabled, surface]);
}
