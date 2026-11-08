/** Compact Beyond cards and sport-marked controls preserve text scaling, consent and action targets. */
import { StyleSheet } from 'react-native';
import { cardShadow, colors, KIT, MENU_METRICS, space } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';
import { DISPLAY_TEXT, FONT, TYPE } from '@/theme/fonts';

export const beyondStyles = StyleSheet.create({
  screen: { padding: space.sm, paddingBottom: space.md, gap: space.sm },
  header: { gap: space.xs },
  headerField: { position: 'absolute', top: 0, bottom: 0, right: 0, left: '38%', overflow: 'hidden', borderRadius: 12 },
  title: { ...DISPLAY_TEXT, ...TYPE.display, letterSpacing: -0.6, color: colors.text },
  heading: { fontFamily: FONT.displayBold, fontWeight: 'normal', ...TYPE.section, letterSpacing: -0.3, color: colors.text },
  body: { ...TYPE.body, color: colors.text },
  hint: { ...TYPE.body, color: colors.textMuted },
  kicker: { ...TYPE.caption, fontWeight: '800', color: FOCAL.jadeInk },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  section: { gap: space.sm },
  card: { padding: space.md, gap: space.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.cardRadius, ...cardShadow },
  note: { padding: space.sm, gap: space.xs, backgroundColor: FOCAL.mistJade, borderRadius: MENU_METRICS.controlRadius },
  error: { padding: space.sm, ...TYPE.body, color: colors.danger, backgroundColor: colors.emberSoft, borderRadius: MENU_METRICS.controlRadius },
  notice: { padding: space.sm, ...TYPE.body, color: colors.primary, backgroundColor: colors.accentSoft, borderRadius: MENU_METRICS.controlRadius },
  input: { minHeight: 88, padding: space.sm, ...TYPE.section, color: colors.text, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: MENU_METRICS.controlRadius, textAlignVertical: 'top' },
  count: { ...TYPE.caption, color: colors.textMuted, textAlign: 'right', fontVariant: ['tabular-nums'] },
  button: { minHeight: MENU_METRICS.touchTarget, minWidth: MENU_METRICS.touchTarget, paddingVertical: space.sm, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: space.xs, borderWidth: 1, borderColor: colors.border, borderRadius: KIT.controlRadius, backgroundColor: colors.surface },
  buttonLabel: { flexShrink: 1, ...TYPE.button, fontWeight: '800', color: colors.text },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary, justifyContent: 'center', ...KIT.shadowSoft },
  primaryLabel: { color: colors.onAccent, fontWeight: '800' },
  quiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  quietLabel: { color: colors.primary },
  dangerLabel: { color: colors.danger },
  chip: { paddingVertical: space.xs, paddingHorizontal: space.sm, borderRadius: 999, alignSelf: 'flex-start' },
  chipSelected: { backgroundColor: colors.text, borderColor: colors.text },
  selected: { backgroundColor: colors.accentSoft, borderColor: colors.primary },
  selectedLabel: { color: colors.primary },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
