/** FUN-01 Daylight controls: explicit actions and accessible fields without automatic writes or payment chrome.
 * Play actions use the trivia palette so a phone-width Fan Zone reads as a game, not a form. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';
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
    hero: { gap: 4, padding: 16, borderRadius: 20, backgroundColor: FOCAL.electricGold, borderWidth: 3, borderColor: FOCAL.islandCyan },
    heroKicker: { color: FOCAL.cyanInk, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
    heroCopy: { color: FOCAL.ink, fontSize: 15, fontWeight: '600', lineHeight: 21 },
    playCard: { gap: 10, padding: 14, borderRadius: 18, borderWidth: 3, borderColor: FOCAL.electricViolet, backgroundColor: FOCAL.mistGold },
    alias: { color: FOCAL.ink, fontSize: 20, fontWeight: '900' },
    copy: { color: colors.textMuted, fontSize: 16, lineHeight: 23 },
    title: { color: colors.text, fontSize: 21, fontWeight: '700' },
    notice: { color: colors.text, fontSize: 16, lineHeight: 23 },
});
const styles = StyleSheet.create({
    button: { minHeight: 48, padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center' },
    play: { minHeight: 52, backgroundColor: FOCAL.neonJade, borderColor: FOCAL.jadeInk },
    selected: { backgroundColor: FOCAL.electricViolet, borderColor: FOCAL.violetInk },
    buttonText: { color: colors.primary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
    playText: { color: FOCAL.ink },
    selectedText: { color: '#FFFFFF' },
    panel: { padding: 16, gap: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    title: { color: colors.text, fontSize: 20, fontWeight: '800' },
    copy: { color: colors.text, fontSize: 16, lineHeight: 23 },
    field: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, color: colors.text },
});
