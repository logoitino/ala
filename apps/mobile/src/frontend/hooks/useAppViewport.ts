/**
 * Layout width for fan chrome. On Expo web desktop the app sits in a phone column
 * (`WebAppShell`); consumers must not size sheets/grids from the full browser width.
 */
import { Platform, useWindowDimensions } from 'react-native';

/** Desktop canvas wider than this gets the phone column + side atmosphere. */
export const WEB_PHONE_BREAKPOINT = 900;
/** Max width of the interactive app column on large screens. */
export const WEB_PHONE_WIDTH = 430;

/**
 * @purpose Clamp window width to the Expo web phone column when the desktop shell is active.
 * @param windowWidth `useWindowDimensions().width`
 * @param os Platform OS (injectable for tests).
 */
export function appViewportWidth(windowWidth: number, os: string = Platform.OS): number {
  if (os === 'web' && windowWidth >= WEB_PHONE_BREAKPOINT) {
    return WEB_PHONE_WIDTH;
  }
  return windowWidth;
}

/**
 * @purpose Effective content width for sheets, grids, and docked chrome.
 * @returns Window width on native / narrow web; `WEB_PHONE_WIDTH` when the desktop shell is active.
 * @sideEffects None.
 */
export function useAppViewportWidth(): number {
  const { width } = useWindowDimensions();
  return appViewportWidth(width);
}
