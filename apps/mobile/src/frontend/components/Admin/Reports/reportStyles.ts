/** Current admin reports share the fixed Daylight palette and bundled brand faces with the editing desks.
 * Content-sized cards and readable type preserve every measure and the native44-point action target. */
import { Platform, StyleSheet } from 'react-native';
import { ADMIN_REPORT_COLORS } from '../adminReportColors';
import { FONT, TYPE, figtree } from '@/theme/fonts';

export const REPORT_INK = { canvas: ADMIN_REPORT_COLORS.background, surface: ADMIN_REPORT_COLORS.surface, mutedSurface: '#f0f4f2', border: ADMIN_REPORT_COLORS.border,
  ink: ADMIN_REPORT_COLORS.text, soft: ADMIN_REPORT_COLORS.textSoft, muted: ADMIN_REPORT_COLORS.textMuted, jade: ADMIN_REPORT_COLORS.jade, cyan: '#00707e', gold: ADMIN_REPORT_COLORS.electricGold, violet: '#4c1d95', bad: ADMIN_REPORT_COLORS.danger,
  jadeWash: '#e6f4ec', goldWash: '#faf3e2', badWash: '#fbeaea' } as const;
export const reportColor = (accent: string = 'jade') => REPORT_INK[accent as keyof typeof REPORT_INK] ?? REPORT_INK.muted;
export const REPORT_FONT = FONT.regular;

export const reportStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: REPORT_INK.canvas },
  content: { width: '100%', maxWidth: 1680, alignSelf: 'center', paddingBottom: 32, gap: 20, minWidth: 0 },
  header: { gap: 8, borderBottomWidth: 1, borderBottomColor: REPORT_INK.border, paddingVertical: 20 },
  kicker: { ...TYPE.caption, ...figtree('800'), letterSpacing: 0.8, color: REPORT_INK.jade, textTransform: 'uppercase' },
  h1: { ...TYPE.display, fontFamily: FONT.display, fontWeight: 'normal', color: REPORT_INK.ink, letterSpacing: -0.6 },
  h2: { ...TYPE.title, fontFamily: FONT.displayBold, fontWeight: 'normal', color: REPORT_INK.ink, letterSpacing: -0.3 },
  chartTitle: { ...TYPE.caption, ...figtree('800'), letterSpacing: 0.8, textTransform: 'uppercase', color: REPORT_INK.ink },
  section: { minWidth: 0, gap: 12, padding: 16, borderWidth: 1, borderColor: REPORT_INK.border, borderRadius: 16, backgroundColor: REPORT_INK.surface },
  sentence: { ...TYPE.body, ...figtree('400'), color: REPORT_INK.soft, flexShrink: 1 },
  small: { ...TYPE.caption, ...figtree('400'), color: REPORT_INK.muted, flexShrink: 1 },
  strong: { ...TYPE.body, ...figtree('800'), color: REPORT_INK.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, minWidth: 0, alignItems: 'flex-start' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', minWidth: 0 },
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  buttonOn: { borderBottomColor: REPORT_INK.jade },
  buttonText: { ...TYPE.button, ...figtree('700'), color: REPORT_INK.soft },
  buttonTextOn: { color: REPORT_INK.jade },
  notice: { padding: 12, borderRadius: 14, backgroundColor: REPORT_INK.goldWash, borderWidth: 1, borderColor: REPORT_INK.gold, gap: 6 },
  error: { backgroundColor: REPORT_INK.badWash, borderColor: REPORT_INK.bad },
  table: { minWidth: 0, gap: 0, borderWidth: 1, borderColor: REPORT_INK.border, borderRadius: 8, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: REPORT_INK.border, paddingHorizontal: 12, paddingVertical: 10, gap: 16 },
  tableHead: { backgroundColor: REPORT_INK.mutedSurface },
  tableCell: { ...TYPE.body, ...figtree('400'), color: REPORT_INK.ink, minWidth: 100, flex: 1 },
  source: { ...TYPE.caption, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: REPORT_INK.muted },
  metric: { minWidth: 0, gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: REPORT_INK.border },
  metricValue: { ...TYPE.display, fontFamily: FONT.display, fontWeight: 'normal', color: REPORT_INK.ink, letterSpacing: -0.7, fontVariant: ['tabular-nums'] },
  heroValue: { fontFamily: FONT.display, fontSize: 48, lineHeight: 56, fontWeight: 'normal', color: REPORT_INK.jade, letterSpacing: -1, fontVariant: ['tabular-nums'] },
});
