/**
 * Friend requests waiting for you, on Activity (PRIV-01). Accept or decline; the sender is never told about a decline.
 * Shows nothing when there are no requests or the privacy update is not on this database yet.
 * @sideEffects `list_my_friends`, `respond_friend` through `lib/privacy`.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { fetchMyFriends, respondFriend, type FriendRow } from '@/lib/privacy';
import { FOCAL } from '@/theme/motion';

/** @purpose Incoming friend requests with Accept / Decline. */
export function FriendRequestsCard() {
  const [rows, setRows] = useState<FriendRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows((await fetchMyFriends()).filter((row) => row.status === 'incoming')); }
    catch { setRows([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const respond = async (row: FriendRow, accept: boolean) => {
    if (busy) return;
    setBusy(row.requestId);
    setMessage(null);
    try {
      await respondFriend(row.requestId, accept);
      setRows((current) => current.filter((item) => item.requestId !== row.requestId));
      if (accept) setMessage(`You and ${row.name} are friends.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0 && !message) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Friend requests</Text>
      {rows.map((row) => (
        <View key={row.requestId} style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Accept ${row.name}`} disabled={busy != null} haptic="selection"
            onPress={() => void respond(row, true)} style={[styles.button, styles.buttonOn]}>
            <Text style={[styles.label, styles.labelOn]}>Accept</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Decline ${row.name}`} disabled={busy != null} haptic="selection"
            onPress={() => void respond(row, false)} style={styles.button}>
            <Text style={styles.label}>Decline</Text>
          </Pressable>
        </View>
      ))}
      {message ? <Text style={styles.message} accessibilityRole="alert">{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, marginTop: 8, padding: 12, borderRadius: radii.lg, backgroundColor: colors.surface },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: colors.textMuted, textTransform: 'uppercase' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { flex: 1, minWidth: 100, fontSize: 14, fontWeight: '700', color: colors.text },
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  buttonOn: { backgroundColor: FOCAL.violetInk, borderColor: FOCAL.violetInk },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  labelOn: { color: colors.onAccent },
  message: { fontSize: 13, color: colors.text },
});
