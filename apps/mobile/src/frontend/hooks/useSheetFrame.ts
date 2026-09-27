import { useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radii, space } from '@/constants/theme';

/** Widest a fan popup grows. Wider browsers center this card instead of stretching it. */
const SHEET_MAX = 440;

export type SheetFrame = {
  /** Equal side gutters and clearance above the home indicator. Backdrop stays full-screen. */
  dock: ViewStyle;
  /** The card itself: even padding, one radius, never wider than `SHEET_MAX`. */
  card: ViewStyle;
};

/**
 * @purpose Shared frame for fan bottom sheets so menus line up on an iPhone SE, a Pro Max, and a wide browser.
 * @returns `dock` for the wrapper under the sheet, and `card` to spread onto the sheet after its color styles.
 * @sideEffects None. Reads the window size and the safe area.
 */
export function useSheetFrame(): SheetFrame {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
      paddingHorizontal: compact ? space.md : space.lg,
      paddingTop: space.sm,
      paddingBottom: space.md,
      borderRadius: radii.xl,
      overflow: 'hidden',
    },
  };
}
