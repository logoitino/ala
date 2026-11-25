/** Home and Local share one compact search field; theme and dismissal remain with each route. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { TYPE, figtree } from '@/theme/fonts';
import { FOCAL } from '@/theme/motion';

type Props = Pick<TextInputProps, 'value' | 'onChangeText' | 'onFocus' | 'placeholder' | 'accessibilityLabel' | 'autoFocus'> & {
  tone?: 'daylight' | 'video';
  onClose?: () => void;
};

export function FanSearchField({ tone = 'daylight', onClose, ...input }: Props) {
  const video = tone === 'video';
  const ink = video ? colors.onVideo : colors.text;
  return (
    <View style={[styles.field, video && styles.video]}>
      <Ionicons name="search-outline" size={18} color={video ? FOCAL.neonJade : FOCAL.jadeInk} accessible={false} />
      <TextInput {...input} autoCapitalize="none" autoCorrect={false} returnKeyType="search"
        placeholderTextColor={video ? '#D8DEE2' : colors.textMuted} style={[styles.input, { color: ink }]} />
      {onClose ? <Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={onClose}
        style={styles.close}><Ionicons name="close" size={18} color={ink} accessible={false} /></Pressable>
        : <View style={styles.close} />}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexGrow: 1, flexShrink: 1, minWidth: 0, minHeight: 46, paddingLeft: 12, flexDirection: 'row',
    alignItems: 'center', gap: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  video: { backgroundColor: colors.videoScrim, borderColor: `${FOCAL.neonJade}66` },
  input: { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 6, fontSize: TYPE.body.fontSize, ...figtree('600') },
  close: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
