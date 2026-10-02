/**
 * Mentions waiting on this account. Shown on your own profile. Confirming publishes the name
 * on that Highlight. Declining removes it. Donations are not affected.
 * @sideEffects `get_my_account_tags`, `confirm_account_tag`.
 */

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
    const ok = await confirmAccountTag(row.id, action);
    if (ok) setRows((current) => current.filter((item) => item.id !== row.id));
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
    gap: 10,
    marginTop: 12,
    padding: 16,
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
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  yes: {
    borderRadius: radii.pill,
    backgroundColor: colors.deepGreen,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  yesLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  no: {
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  noLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
});
