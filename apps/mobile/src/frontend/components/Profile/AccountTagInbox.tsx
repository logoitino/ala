/**
 * Mentions waiting on this account. Shown on your own profile. Confirming publishes the name
 * on that Highlight. Declining removes it. Donations are not affected.
 * @sideEffects `get_my_account_tags`, `confirm_account_tag`.
 */

import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { confirmAccountTag, fetchMyAccountTags, type MyAccountTag } from '@/lib/accountTags';

/**
 * @purpose Let the signed-in account accept or decline Highlight mentions.
 * @returns Nothing when no mention is waiting, including before the SQL is applied.
 */
export function AccountTagInbox() {
  const [rows, setRows] = useState<MyAccountTag[]>([]);

  const refresh = useCallback(async () => {
    setRows(await fetchMyAccountTags());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (rows.length === 0) return null;

  const answer = async (row: MyAccountTag, action: 'confirm' | 'reject') => {
    try {
      const ok = await confirmAccountTag(row.id, action);
      if (ok) {
        setRows((current) => current.filter((item) => item.id !== row.id));
      } else {
        Alert.alert('Mention not updated', 'We could not save your answer. Refresh your profile and try again.');
      }
    } catch {
      Alert.alert('Mention not updated', 'We could not save your answer. Refresh your profile and try again.');
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Tagged you</Text>
      {rows.map((row) => (
        <View key={row.id} style={styles.row}>
          <Text style={styles.title}>{row.reelTitle}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => void answer(row, 'confirm')} style={styles.yes}>
              <Text style={styles.yesLabel}>That's me</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void answer(row, 'reject')} style={styles.no}>
              <Text style={styles.noLabel}>Not me</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    marginTop: 4,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.deepGreen,
  },
  row: { gap: 8 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  yes: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.deepGreen,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  yesLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  no: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  noLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
});
