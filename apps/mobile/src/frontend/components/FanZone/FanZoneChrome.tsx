/** FUN-01 Daylight controls: explicit actions and accessible fields without automatic writes or payment chrome. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii } from '@/constants/theme';
export function FanButton({ label, onPress, disabled = false }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
}) {
    return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: 0.45 }]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
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
export const fanStyles = StyleSheet.create({ page: { padding: 20, gap: 16 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, copy: { color: colors.textMuted, fontSize: 16, lineHeight: 23 }, title: { color: colors.text, fontSize: 21, fontWeight: '700' }, notice: { color: colors.text, fontSize: 16, lineHeight: 23 } });
const styles = StyleSheet.create({ button: { minHeight: 44, padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, buttonText: { color: colors.primary, fontSize: 16, fontWeight: '600' }, panel: { padding: 16, gap: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, title: { color: colors.text, fontSize: 20, fontWeight: '700' }, copy: { color: colors.text, fontSize: 16, lineHeight: 23 }, field: { minHeight: 44, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, color: colors.text } });
