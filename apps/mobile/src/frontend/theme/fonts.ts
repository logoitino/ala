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
 * Readable mobile type scale (UX-12, 2026-11-20). Compact panels save space through layout,
 * not undersized copy: body14/20, captions12/16, and clear section headings. Font scaling remains enabled.
 * Spread `{ ...TYPE.body }` (or pick size/lineHeight) — do not invent new per-screen sizes.
 */
export const TYPE = {
  /** Fan / role screen titles (was ~30–32). */
  display: { fontSize: 26, lineHeight: 30 } as TextStyle,
  /** Compact headings and sheet titles (was ~24). */
  title: { fontSize: 20, lineHeight: 26 } as TextStyle,
  /** Section labels and card titles (was ~16). */
  section: { fontSize: 16, lineHeight: 21 } as TextStyle,
  /** Primary body copy in cards, sheets and notices. */
  body: { fontSize: 14, lineHeight: 20 } as TextStyle,
  /** Secondary hints and metadata; never smaller to force a fit. */
  caption: { fontSize: 12, lineHeight: 16 } as TextStyle,
  /** Button / chip labels (was ~15–16). */
  button: { fontSize: 14, lineHeight: 20 } as TextStyle,
} as const;

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
