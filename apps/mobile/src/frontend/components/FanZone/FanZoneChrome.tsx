/** FUN-01 Daylight controls: explicit actions and accessible fields without automatic writes or payment chrome.
 * Play actions use the trivia palette so a phone-width Fan Zone reads as a game, not a form.
 * 2026-11 Lovable refresh: night hero, light cards, ink selected path, jade play action. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { cardShadow, colors, KIT } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';
import { DISPLAY_TEXT } from '@/theme/fonts';
export function FanButton({ label, onPress, disabled = false, selected = false, play = false }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    /** The path the person is on. */
    selected?: boolean;
    /** The main play action, such as a ballot. */
    play?: boolean;
}) {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} style={[styles.button, play && styles.play, selected && styles.selected, disabled && { opacity: 0.45 }]}><Text style={[styles.buttonText, play && styles.playText, selected && styles.selectedText]}>{label}</Text></Pressable>;
}
export function FanPanel({ title, children }: {
    title: string;
    children: ReactNode;
}) { return <View style={styles.panel}><Text accessibilityRole="header" style={styles.title}>{title}</Text>{children}</View>; }
export function FanField({ label, value, onChange, multiline = false }: {
    label: string;
    value: string;
    onChange: (text: string) => void;
    multiline?: boolean;
}) { return <><Text style={styles.copy}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} multiline={multiline} style={styles.field}/></>; }
export function FanCheck({ label, value, onChange, disabled = false }: {
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
}) { return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onChange(!value)} style={styles.button}><Text style={styles.copy}>{value ? '☑' : '☐'} {label}</Text></Pressable>; }
export const fanStyles = StyleSheet.create({
    docked: { paddingBottom: 0 },
    phone: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center' },
    scroll: { flex: 1 },
    page: { padding: 16, gap: 14, paddingBottom: 28 },
    stack: { gap: 8 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    hero: { gap: 6, padding: 20, borderRadius: KIT.heroRadius, backgroundColor: colors.videoSurface },
    heroKicker: { color: FOCAL.electricGold, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
    heroTitle: { ...DISPLAY_TEXT, color: colors.onVideo, fontSize: 30, letterSpacing: -0.8 },
    heroCopy: { color: colors.onVideoMuted, fontSize: 15, fontWeight: '600', lineHeight: 21 },
    playCard: { gap: 10, padding: 16, borderRadius: KIT.cardRadius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, ...cardShadow },
    alias: { color: FOCAL.ink, fontSize: 20, fontWeight: '900' },
    copy: { color: colors.textMuted, fontSize: 16, lineHeight: 23 },
    title: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
    notice: { color: colors.text, fontSize: 16, lineHeight: 23 },
});
const styles = StyleSheet.create({
    button: { minHeight: 48, padding: 12, borderRadius: KIT.controlRadius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
    play: { minHeight: 52, backgroundColor: colors.primary, borderColor: colors.primary, ...KIT.shadowSoft },
    selected: { backgroundColor: colors.text, borderColor: colors.text },
    buttonText: { color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
    playText: { color: colors.onAccent },
    selectedText: { color: colors.background },
    panel: { padding: 16, gap: 12, borderRadius: KIT.cardRadius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, ...cardShadow },
    title: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
    copy: { color: colors.text, fontSize: 16, lineHeight: 23 },
    field: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: KIT.controlRadius, color: colors.text, backgroundColor: colors.background },
});
