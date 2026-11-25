/** Shared fan-sheet geometry; an explicit web workspace may expand account detail panels only. */
import { useContext } from 'react';
import { Platform, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cardShadow, colors, MENU_METRICS, space } from '@/constants/theme';
import { useAppViewportWidth } from '@/hooks/useAppViewport';
import { SheetPresentationContext } from '@/components/UI/SheetPresentationContext';

/** Widest a fan popup grows. Wider browsers center this card instead of stretching it. */
const SHEET_MAX = 440;

/**
 * One blur strength for every fan sheet backdrop. These had drifted to 40 and 48 across the
 * five sheets, so a menu and a checkout dimmed the feed by visibly different amounts.
 */
export const SHEET_BLUR_INTENSITY = 44;

export type SheetFrame = {
  /** Equal side gutters and clearance above the home indicator. Backdrop stays full-screen. */
  dock: ViewStyle;
  /** The card itself: bounded readable width; an opted-in desktop account workspace can grow. */
  card: ViewStyle;
};

/**
 * @purpose Shared frame for fan bottom sheets so menus line up on an iPhone SE, a Pro Max, and a wide browser.
 * Uses the app viewport width (phone column on Expo web desktop), not the full browser window.
 * @returns `dock` for the wrapper under the sheet, and `card` to spread onto the sheet after its color styles.
 * @sideEffects None. Reads the app viewport size and the safe area.
 */
export function useSheetFrame(): SheetFrame {
  const width = useAppViewportWidth();
  const window = useWindowDimensions();
  const presentation = useContext(SheetPresentationContext);
  const insets = useSafeAreaInsets();
  if (presentation === 'web-workspace' && Platform.OS === 'web' && window.width >= 820) {
    return {
      dock: { width: '100%', paddingHorizontal: Math.max(24, (window.width - 760) / 2), paddingBottom: 24 },
      card: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 24,
        paddingTop: 12, paddingBottom: 20, borderRadius: MENU_METRICS.sheetRadius,
        borderWidth: 1, borderColor: colors.border, ...cardShadow, overflow: 'hidden' },
    };
  }
  const compact = width < 360;
  const side = width >= SHEET_MAX + 32 ? (width - SHEET_MAX) / 2 : compact ? 10 : space.sm;

  return {
    dock: {
      width: '100%',
      paddingHorizontal: side,
      paddingBottom: space.xs + insets.bottom,
    },
    card: {
      width: '100%',
      maxWidth: SHEET_MAX,
      alignSelf: 'center',
      // Compact popups (owner 2026-10-21): more of the screen for content, same 44pt controls inside.
      paddingHorizontal: compact ? space.sm : space.md,
      paddingTop: space.xs,
      paddingBottom: space.sm,
      borderRadius: MENU_METRICS.sheetRadius,
      borderWidth: 1,
      borderColor: colors.border,
      ...cardShadow,
      overflow: 'hidden',
    },
  };
}
