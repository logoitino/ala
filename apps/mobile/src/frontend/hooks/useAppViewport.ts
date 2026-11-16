/**
 * Layout width for fan chrome. On Expo web desktop (≥820) the three-panel shell is active
 * (`WebAppShell`); sheets/grids use the center column width, not the full browser window.
 * Web branching waits until after mount so it stays aligned with `WebAppShell`'s hydration-safe layout.
 */
import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/** Three-panel Facebook-style layout (left + center + right). */
export const WEB_DESKTOP_THREE = 1280;
/** Two-panel layout: icon left rail; right rail as a toggle. Below this = phone chrome. */
export const WEB_DESKTOP_TABLET = 820;
/** Readable center column target for Highlights on desktop (design WEB-DESKTOP-01). */
export const WEB_CENTER_MAX = 680;
/** Legacy phone-column width (pre–WEB-DESKTOP three-panel). Kept for tests / migration. */
export const WEB_PHONE_WIDTH = 430;
/** @deprecated Use `WEB_DESKTOP_TABLET`. Phone-column shell used ≥900 before three-panel. */
export const WEB_PHONE_BREAKPOINT = WEB_DESKTOP_TABLET;

export type WebDesktopMode = 'mobile' | 'tablet' | 'desktop';

/**
 * @purpose Resolve Expo web desktop mode from window width (hydration-safe when `layoutReady`).
 */
export function webDesktopMode(
  windowWidth: number,
  os: string = Platform.OS,
  layoutReady: boolean = true,
): WebDesktopMode {
  if (os !== 'web' || !layoutReady) return 'mobile';
  if (windowWidth >= WEB_DESKTOP_THREE) return 'desktop';
  if (windowWidth >= WEB_DESKTOP_TABLET) return 'tablet';
  return 'mobile';
}

/**
 * @purpose Effective content width for sheets, grids, and docked chrome.
 * Desktop/tablet: center column (capped). Mobile web / native: full window width.
 */
export function appViewportWidth(
  windowWidth: number,
  os: string = Platform.OS,
  layoutReady: boolean = true,
): number {
  const mode = webDesktopMode(windowWidth, os, layoutReady);
  if (mode === 'desktop' || mode === 'tablet') {
    // Center column shares the shell; leave room for rails without inventing a second phone frame.
    const railBudget = mode === 'desktop' ? 240 + 320 + 48 : 72 + 48;
    return Math.min(WEB_CENTER_MAX, Math.max(WEB_PHONE_WIDTH, windowWidth - railBudget));
  }
  return windowWidth;
}

/**
 * @purpose Effective content width for sheets, grids, and docked chrome.
 * @returns Window width on native / narrow web; center-column width when the desktop shell is active.
 * @sideEffects None.
 */
export function useAppViewportWidth(): number {
  const { width } = useWindowDimensions();
  const [layoutReady, setLayoutReady] = useState(Platform.OS !== 'web');
  useEffect(() => {
    setLayoutReady(true);
  }, []);
  return appViewportWidth(width, Platform.OS, layoutReady);
}

/**
 * @purpose Expo web layout mode for shell / tab-bar branching.
 * @returns `mobile` | `tablet` | `desktop` (always `mobile` on native and before mount).
 * @sideEffects None.
 */
export function useWebDesktopMode(): WebDesktopMode {
  const { width } = useWindowDimensions();
  const [layoutReady, setLayoutReady] = useState(Platform.OS !== 'web');
  useEffect(() => {
    setLayoutReady(true);
  }, []);
  return webDesktopMode(width, Platform.OS, layoutReady);
}
