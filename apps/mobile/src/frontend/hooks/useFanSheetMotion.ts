/**
 * One open/close contract for fan bottom sheets: SPRING_SHEET up, cubic slide away, backdrop fade,
 * Reduce Motion timing branch, and rAF reset so re-opens never snap. Profile, Soft-Wall, Legal, and
 * similar menus should use this instead of ad-hoc springs.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  SHEET_BACKDROP_IN_TIMING,
  SHEET_BACKDROP_OUT_MS,
  SHEET_CLOSE_TIMING,
  SHEET_REDUCED_MS,
  SHEET_TRAVEL,
  SPRING_SHEET,
} from '@/theme/motion';

export type FanSheetMotion = {
  translateY: SharedValue<number>;
  backdropOpacity: SharedValue<number>;
  sheetStyle: ReturnType<typeof useAnimatedStyle>;
  backdropStyle: ReturnType<typeof useAnimatedStyle>;
  /** Reset off-screen then spring/timing to rest. Call when the sheet becomes visible. */
  playOpen: () => void;
  /**
   * Slide away then run `onSettled` on the JS thread. Does not call a parent `onClose` —
   * the caller decides when to clear `visible`.
   */
  playClose: (onSettled?: () => void) => void;
  reduceMotion: boolean;
};

/**
 * @purpose Shared Reanimated travel for fan bottom sheets so menus open and close with one feel.
 * @param travel Off-screen Y distance in px (default `SHEET_TRAVEL`).
 * @returns Shared values, animated styles, and open/close helpers. Respects Reduce Motion.
 * @sideEffects Reanimated UI-thread animations only.
 */
export function useFanSheetMotion(travel: number = SHEET_TRAVEL): FanSheetMotion {
  const reduceMotion = useReducedMotion() === true;
  const translateY = useSharedValue(travel);
  const backdropOpacity = useSharedValue(0);
  const openFrame = useRef<number | null>(null);

  useEffect(() => () => {
    if (openFrame.current != null) cancelAnimationFrame(openFrame.current);
  }, []);

  const playOpen = useCallback(() => {
    if (openFrame.current != null) cancelAnimationFrame(openFrame.current);
    translateY.value = travel;
    backdropOpacity.value = 0;
    openFrame.current = requestAnimationFrame(() => {
      openFrame.current = null;
      if (reduceMotion) {
        translateY.value = withTiming(0, { duration: SHEET_REDUCED_MS, easing: Easing.out(Easing.cubic) });
        backdropOpacity.value = withTiming(1, { duration: SHEET_REDUCED_MS });
        return;
      }
      translateY.value = withSpring(0, SPRING_SHEET);
      backdropOpacity.value = withTiming(1, SHEET_BACKDROP_IN_TIMING);
    });
  }, [backdropOpacity, reduceMotion, translateY, travel]);

  const playClose = useCallback((onSettled?: () => void) => {
    if (openFrame.current != null) {
      cancelAnimationFrame(openFrame.current);
      openFrame.current = null;
    }
    const settle = () => {
      onSettled?.();
    };
    const outMs = reduceMotion ? SHEET_REDUCED_MS : SHEET_BACKDROP_OUT_MS;
    backdropOpacity.value = withTiming(0, { duration: outMs });
    translateY.value = withTiming(
      travel,
      reduceMotion
        ? { duration: SHEET_REDUCED_MS, easing: Easing.in(Easing.cubic) }
        : SHEET_CLOSE_TIMING,
      (finished) => {
        if (finished) runOnJS(settle)();
      },
    );
  }, [backdropOpacity, reduceMotion, translateY, travel]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  return { translateY, backdropOpacity, sheetStyle, backdropStyle, playOpen, playClose, reduceMotion };
}
