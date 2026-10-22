/**
 * Friend and block controls on someone else's profile (PRIV-01): Add friend / Requested / Accept / Friends, and Block or
 * Unblock behind a confirmation. Also the "This profile is private" note a non-friend sees on a private account. The
 * relationship comes from the database (`get_public_profiles` → `viewer_relation`); a blocked person sees a guest's
 * view and is never told.
 * @sideEffects `get_public_profiles`, `list_my_friends`, `request_friend`, `respond_friend`, `remove_friend`, `block_user`,
 *   `unblock_user` through `lib/privacy`.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors } from '@/constants/theme';
import {
  blockUser,
  fetchMyFriends,
  getPublicProfiles,
  removeFriend,
  requestFriend,
  respondFriend,
  unblockUser,
} from '@/lib/privacy';
import { FOCAL } from '@/theme/motion';

type State = 'none' | 'requested' | 'incoming' | 'friends' | 'blocked';

/** @purpose Friend / block row for the athlete account linked to `playerId` (nothing for your own or an unlinked athlete). */
export function ProfileFriendActions({ playerId }: { playerId: string }) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [name, setName] = useState('this account');
  const [isPrivate, setIsPrivate] = useState(false);
  const [state, setState] = useState<State | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [account] = await getPublicProfiles({ playerIds: [playerId] });
    const rel = account?.viewer_relation;
    if (!account || !rel || rel === 'self' || rel === 'admin' || rel === 'guest') {
      setProfileId(null);
      setIsPrivate(Boolean(account?.account_private) && rel === 'guest');
      return;
    }
    setProfileId(account.id);
    setName(account.full_name || 'this account');
    setIsPrivate(account.account_private === true && rel !== 'friend' && rel !== 'guardian');
    if (rel === 'friend') { setState('friends'); return; }
    if (rel === 'blocked') { setState('blocked'); return; }
    try {
      const mine = (await fetchMyFriends()).find((row) => row.profileId === account.id);
      setRequestId(mine?.requestId ?? null);
      setState(mine?.status === 'incoming' ? 'incoming' : mine?.status === 'outgoing' ? 'requested' : 'none');
    } catch {
      setState('none');
    }
  }, [playerId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try { await work(); await load(); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : 'That did not work.'); }
    finally { setBusy(false); }
  };

  const confirmBlock = () => {
    if (!profileId) return;
    Alert.alert(`Block ${name}?`, `${name} won't see your profile or be able to add you, join your Crew or tag you. They aren't told.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => void act(() => blockUser(profileId)) },
    ]);
  };

  const privateNote = isPrivate ? (
    <Text style={styles.private} accessibilityRole="text">
      This profile is private. You can still watch their Highlights, give and join their Crew.
    </Text>
  ) : null;

  if (!profileId || !state) return privateNote;

  const primary: Record<State, { label: string; onPress: () => void } | null> = {
    none: { label: 'Add friend', onPress: () => void act(async () => { await requestFriend(profileId); }) },
    requested: { label: 'Requested · Cancel', onPress: () => void act(() => removeFriend(profileId)) },
    incoming: { label: 'Accept friend request', onPress: () => void act(async () => { if (requestId) await respondFriend(requestId, true); }) },
    friends: { label: 'Friends ✓ · Unfriend', onPress: () => void act(() => removeFriend(profileId)) },
    blocked: { label: 'Unblock', onPress: () => void act(() => unblockUser(profileId)) },
  };
  const main = primary[state];

  return (
    <View style={styles.wrap}>
      {privateNote}
      <View style={styles.row}>
        {main ? (
          <Pressable accessibilityRole="button" accessibilityLabel={main.label} accessibilityState={{ disabled: busy }} disabled={busy}
            haptic="selection" onPress={main.onPress} style={[styles.button, state === 'none' || state === 'incoming' ? styles.buttonOn : null]}>
            <Text style={[styles.label, state === 'none' || state === 'incoming' ? styles.labelOn : null]}>{main.label}</Text>
          </Pressable>
        ) : null}
        {state === 'incoming' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Decline friend request" disabled={busy} haptic="selection"
            onPress={() => void act(async () => { if (requestId) await respondFriend(requestId, false); })} style={styles.button}>
            <Text style={styles.label}>Decline</Text>
          </Pressable>
        ) : null}
        {state !== 'blocked' ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Block ${name}`} disabled={busy} haptic="selection" onPress={confirmBlock} style={styles.button}>
            <Text style={styles.label}>Block</Text>
          </Pressable>
        ) : null}
      </View>
      {message ? <Text style={styles.message} accessibilityRole="alert">{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 44, maxWidth: '100%', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: FOCAL.mistViolet, justifyContent: 'center' },
  buttonOn: { backgroundColor: FOCAL.violetInk, borderColor: FOCAL.violetInk },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  labelOn: { color: colors.onAccent },
  private: { fontSize: 13, color: colors.textMuted },
  message: { fontSize: 13, color: colors.danger },
});
