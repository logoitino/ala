/** Report presentation mirrors the approved localhost:3033 portal. Open dividers and measure inks
 * replace floating cards; report controls keep the native 44-point target on every platform. */
import { Platform, StyleSheet } from 'react-native';

export const REPORT_INK = { canvas: '#f6f8f7', surface: '#ffffff', mutedSurface: '#f0f4f2', border: '#e4e9e6',
  ink: '#10161a', soft: '#4a5560', muted: '#5b6670', jade: '#00733c', cyan: '#00707e', gold: '#8a6400', violet: '#4c1d95', bad: '#b3202f',
  jadeWash: '#e6f4ec', goldWash: '#faf3e2', badWash: '#fbeaea' } as const;
export const reportColor = (accent: string = 'jade') => REPORT_INK[accent as keyof typeof REPORT_INK] ?? REPORT_INK.muted;
export const REPORT_FONT = Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'Avenir Next, Segoe UI, system-ui, sans-serif' });
const fontFamily = REPORT_FONT;

export const reportStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: REPORT_INK.canvas },
  content: { width: '100%', maxWidth: 1680, alignSelf: 'center', paddingBottom: 40, gap: 28, minWidth: 0 },
  header: { gap: 10, borderBottomWidth: 1, borderBottomColor: REPORT_INK.border, paddingVertical: 28 },
  kicker: { fontFamily, fontSize: 11, fontWeight: '800', letterSpacing: 1.7, color: REPORT_INK.jade, textTransform: 'uppercase' },
  h1: { fontFamily, fontSize: 36, fontWeight: '800', color: REPORT_INK.ink, letterSpacing: -0.9 },
  h2: { fontFamily, fontSize: 20, fontWeight: '800', color: REPORT_INK.ink, letterSpacing: -0.3 },
  chartTitle: { fontFamily, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: REPORT_INK.ink },
  section: { minWidth: 0, gap: 16, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: REPORT_INK.border },
  sentence: { fontFamily, fontSize: 14, color: REPORT_INK.soft, lineHeight: 23, flexShrink: 1 },
  small: { fontFamily, fontSize: 12, color: REPORT_INK.muted, lineHeight: 19, flexShrink: 1 },
  strong: { fontFamily, fontSize: 14, fontWeight: '800', color: REPORT_INK.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, minWidth: 0, alignItems: 'flex-start' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', minWidth: 0 },
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  buttonOn: { borderBottomColor: REPORT_INK.jade },
  buttonText: { fontFamily, fontSize: 14, fontWeight: '800', color: REPORT_INK.soft },
  buttonTextOn: { color: REPORT_INK.jade },
  notice: { padding: 14, borderRadius: 10, backgroundColor: REPORT_INK.goldWash, borderWidth: 1, borderColor: REPORT_INK.gold, gap: 6 },
  error: { backgroundColor: REPORT_INK.badWash, borderColor: REPORT_INK.bad },
  table: { minWidth: 0, gap: 0, borderWidth: 1, borderColor: REPORT_INK.border, borderRadius: 8, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: REPORT_INK.border, paddingHorizontal: 12, paddingVertical: 10, gap: 16 },
  tableHead: { backgroundColor: REPORT_INK.mutedSurface },
  tableCell: { fontFamily, color: REPORT_INK.ink, fontSize: 12, minWidth: 100, flex: 1, lineHeight: 19 },
  source: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, color: REPORT_INK.muted, lineHeight: 18 },
  metric: { minWidth: 0, gap: 8, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: REPORT_INK.border },
  metricValue: { fontFamily, fontSize: 28, fontWeight: '800', color: REPORT_INK.ink, letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  heroValue: { fontFamily, fontSize: 60, fontWeight: '800', color: REPORT_INK.jade, letterSpacing: -2, fontVariant: ['tabular-nums'] },
});
