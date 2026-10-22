/** Compact Beyond cards and sport-marked controls preserve text scaling, consent and action targets. */
import { StyleSheet } from 'react-native';
import { colors, MENU_METRICS, space } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';

export const beyondStyles = StyleSheet.create({
  screen: { padding: 12, paddingBottom: 16, gap: 10 },
  header: { gap: space.xs },
  headerField: { position: 'absolute', top: 0, bottom: 0, right: 0, left: '38%', overflow: 'hidden', borderRadius: 14 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.text },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.text },
  body: { fontSize: 13, lineHeight: 19, color: colors.text },
  hint: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  kicker: { fontSize: 12, lineHeight: 18, fontWeight: '800', color: FOCAL.jadeInk },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  section: { gap: space.sm },
  card: { padding: 12, gap: space.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.cardRadius },
  note: { padding: 12, gap: space.xs, backgroundColor: FOCAL.mistJade, borderRadius: MENU_METRICS.controlRadius },
  error: { padding: space.sm, fontSize: 14, lineHeight: 21, color: colors.danger, backgroundColor: colors.emberSoft, borderRadius: MENU_METRICS.controlRadius },
  notice: { padding: space.sm, fontSize: 14, lineHeight: 21, color: colors.primary, backgroundColor: colors.accentSoft, borderRadius: MENU_METRICS.controlRadius },
  input: { minHeight: 104, padding: space.sm, fontSize: 16, lineHeight: 23, color: colors.text, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.controlRadius, textAlignVertical: 'top' },
  count: { fontSize: 12, lineHeight: 18, color: colors.textMuted, textAlign: 'right', fontVariant: ['tabular-nums'] },
  button: { minHeight: MENU_METRICS.touchTarget, minWidth: MENU_METRICS.touchTarget, paddingVertical: space.sm, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: space.xs, borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.controlRadius, backgroundColor: colors.surface },
  buttonLabel: { flexShrink: 1, fontSize: 13, lineHeight: 19, fontWeight: '600', color: colors.text },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary, justifyContent: 'center' },
  primaryLabel: { color: colors.onAccent, fontWeight: '700' },
  quiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  quietLabel: { color: colors.primary },
  dangerLabel: { color: colors.danger },
  chip: { paddingVertical: space.xs, paddingHorizontal: space.sm, borderRadius: 999, alignSelf: 'flex-start' },
  chipSelected: { backgroundColor: FOCAL.jadeInk, borderColor: FOCAL.jadeInk },
  selected: { backgroundColor: colors.accentSoft, borderColor: colors.primary },
  selectedLabel: { color: colors.primary },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
