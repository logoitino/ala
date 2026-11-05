/**
 * Brand typefaces from the 2026-11 Lovable design standard: Bricolage Grotesque for headings and
 * scoreboard numbers, Figtree for labels and buttons (both SIL Open Font License, licences beside the
 * files in `assets/fonts/`). Each weight is its own family name (its PostScript name) so iOS, Android
 * and web resolve the same face; styles set `fontWeight: 'normal'` with these to avoid synthetic bold.
 * New native builds embed the files through the `expo-font` config plugin; the root layout also loads
 * them at runtime so over-the-air updates and web pick them up.
 */
import type { TextStyle } from 'react-native';

/** Family names = PostScript names of the bundled files. */
export const FONT = {
  display: 'BricolageGrotesque-ExtraBold',
  displayBold: 'BricolageGrotesque-Bold',
  regular: 'Figtree-Regular',
  medium: 'Figtree-Medium',
  semibold: 'Figtree-SemiBold',
  bold: 'Figtree-Bold',
  extrabold: 'Figtree-ExtraBold',
  black: 'Figtree-Black',
} as const;

/** Runtime font map for `expo-font` (`useFonts` / `loadAsync`). */
export const FONT_FILES = {
  [FONT.display]: require('../../../assets/fonts/BricolageGrotesque-ExtraBold.ttf'),
  [FONT.displayBold]: require('../../../assets/fonts/BricolageGrotesque-Bold.ttf'),
  [FONT.regular]: require('../../../assets/fonts/Figtree-Regular.ttf'),
  [FONT.medium]: require('../../../assets/fonts/Figtree-Medium.ttf'),
  [FONT.semibold]: require('../../../assets/fonts/Figtree-SemiBold.ttf'),
  [FONT.bold]: require('../../../assets/fonts/Figtree-Bold.ttf'),
  [FONT.extrabold]: require('../../../assets/fonts/Figtree-ExtraBold.ttf'),
  [FONT.black]: require('../../../assets/fonts/Figtree-Black.ttf'),
} as const;

/** Headline type (screen titles, hero lines, sheet titles). */
export const DISPLAY_TEXT: TextStyle = { fontFamily: FONT.display, fontWeight: 'normal' };

/**
 * @purpose Figtree face for a label weight, so callers keep thinking in weights ('700', '800'…).
 * @returns `{ fontFamily, fontWeight: 'normal' }` to spread into a text style.
 */
export function figtree(weight: '400' | '500' | '600' | '700' | '800' | '900' = '400'): TextStyle {
  const family =
    weight === '900' ? FONT.black
      : weight === '800' ? FONT.extrabold
        : weight === '700' ? FONT.bold
          : weight === '600' ? FONT.semibold
            : weight === '500' ? FONT.medium
              : FONT.regular;
  return { fontFamily: family, fontWeight: 'normal' };
}
