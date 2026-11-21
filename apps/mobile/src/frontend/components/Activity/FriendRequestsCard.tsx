/** UX-13 readable shared type preserves every action and required notice.
 * Friend requests waiting for you, on Activity (PRIV-01). Accept or decline; the sender is never told about a decline.
 * Shows nothing when there are no requests or the privacy update is not on this database yet.
 * @sideEffects `list_my_friends`, `respond_friend` through `lib/privacy`.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { fetchMyFriends, respondFriend, type FriendRow } from '@/lib/privacy';
import { TYPE, figtree } from '@/theme/fonts';

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
  kicker: { ...TYPE.caption, ...figtree('800'), letterSpacing: 1.2, color: colors.textMuted, textTransform: 'uppercase' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { flex: 1, minWidth: 100, ...TYPE.body, ...figtree('700'), color: colors.text },
  button: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  buttonOn: { minHeight: 44, backgroundColor: colors.text, borderColor: colors.text },
  label: { ...TYPE.body, ...figtree('700'), color: colors.text },
  labelOn: { color: colors.onAccent },
  message: { ...figtree('400'), ...TYPE.body, color: colors.text },
});
