/**
 * Measures how each screen is used for the admin Reports desk: tab dwell, deepest scroll, feature taps and control
 * failures. Sends through `TelemetryManager`, so guests are included and rows stay anonymous.
 * Fan dock presentation composes into scroll callbacks; direction is never added to telemetry.
 */

import { useCallback, useRef } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { telemetry } from '@/services/TelemetryManager';
import { useFanNavigation } from '@/context/FanNavigationContext';

export type UsageSurface =
  | 'home'
  | 'local'
  | 'activity'
  | 'spotlight'
  | 'drip'
  | 'profile'
  | 'upload'
  | 'other';

/**
 * @purpose Measure tab dwell, max scroll depth, feature taps, and control failures for `/admin/reports` Usage.
 * @param surface Fan surface key stored on `telemetry_logs.channel`.
 * @returns Scroll handler plus `trackFeature` / `trackIssue` bound to this surface.
 * @sideEffects `TelemetryManager` queue → `telemetry_logs` (`tab_dwell`, `surface_scroll`, `feature_tap`, `ui_issue`).
 */
export function useSurfaceUsage(surface: UsageSurface) {
  const startedAt = useRef(Date.now());
  const maxScroll = useRef(0);
  const scroll = useFanNavigation();
  const focused = useRef(false);

  useFocusEffect(
    useCallback(() => {
      startedAt.current = Date.now();
      focused.current = true;
      maxScroll.current = 0;
      scroll.reset();
      telemetry.trackFeature(`tab.${surface}`, surface);
      return () => {
        focused.current = false;
        telemetry.trackTabDwell(surface, Date.now() - startedAt.current);
        if (maxScroll.current > 0) telemetry.trackScroll(surface, maxScroll.current);
      };
    }, [scroll, surface]),
  );

  const recordScrollPct = useCallback((pct: number) => {
    const next = Math.max(0, Math.min(100, Math.round(pct)));
    if (next > maxScroll.current) maxScroll.current = next;
  }, []);
  // The paged Highlights feed supplies percentages instead of native scroll events.
  const noteScrollPct = useCallback((pct: number) => {
    recordScrollPct(pct);
    if (focused.current) scroll.sample(pct * 10);
  }, [recordScrollPct, scroll]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const span = contentSize.height - layoutMeasurement.height;
      const pct = span <= 0 ? 100 : (contentOffset.y / span) * 100;
      recordScrollPct(pct);
      if (focused.current) scroll.sample(contentOffset.y);
    },
    [recordScrollPct, scroll],
  );

  const trackFeature = useCallback(
    (feature: string) => {
      telemetry.trackFeature(feature, surface);
    },
    [surface],
  );

  const trackIssue = useCallback(
    (control: string) => {
      telemetry.trackIssue(control, surface);
    },
    [surface],
  );

  return { onScroll, noteScrollPct, trackFeature, trackIssue };
}
