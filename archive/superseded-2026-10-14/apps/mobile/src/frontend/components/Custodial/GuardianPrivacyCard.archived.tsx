// ARCHIVED 2026-10-14 · MINOR-01 · owner approved · whole file apps/mobile/src/frontend/components/Custodial/GuardianPrivacyCard.tsx (GuardianPrivacyCard).
// Not built, tested or imported. Restore: move the code back to that path, drop ".archived" from the name, import it (needs the archived lock functions).
// Every archived item and its reason: docs/engineering/data-ownership.json → archived.

/**
 * Parent HQ: the athlete's privacy settings with Lock / Unlock (PRIV-01). While locked, the athlete can make settings
 * stricter but not looser; the lock ends on its own at the handover date when the birth date is known. Shows nothing for
 * an athlete with no linked account or where the privacy update is not on this database yet.
 * @sideEffects `get_public_profiles`, `guardian_get_privacy`, `guardian_set_privacy` through `lib/privacy`.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { AUDIENCE_LABEL, PRIVACY_ITEMS, fetchGuardianPrivacy, getPublicProfiles, saveGuardianPrivacy, type PrivacySettings } from '@/lib/privacy';
import { FOCAL } from '@/theme/motion';

/** @purpose The linked athlete's privacy summary and the guardian's lock. */
export function GuardianPrivacyCard({ playerId }: { playerId: string }) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [account] = await getPublicProfiles({ playerIds: [playerId] });
    if (!account) return;
    try {
      setSettings(await fetchGuardianPrivacy(account.id));
      setProfileId(account.id);
    } catch {
      setProfileId(null);
    }
  }, [playerId]);
  useEffect(() => { void load(); }, [load]);

  const save = async (next: Partial<PrivacySettings>, lock?: boolean, done?: string) => {
    if (!profileId || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      setSettings(await saveGuardianPrivacy(profileId, next, lock));
      if (done) setMessage(done);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  if (!profileId || !settings) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Privacy</Text>
      <Text style={styles.title}>{`${settings.accountPrivate ? 'Private' : 'Public'} account${settings.locked ? ' · locked by you' : ''}`}</Text>
      <Text style={styles.body}>
        {PRIVACY_ITEMS.map((item) => `${item.label}: ${AUDIENCE_LABEL[settings.audience[item.key]]}`).join(' · ')}
      </Text>
      <Text style={styles.body}>
        {`${settings.hideFromSearch ? 'Hidden from search' : 'Shown in search'} · friend requests from ${settings.friendRequestsFrom === 'nobody' ? 'nobody' : 'anyone'}`}
      </Text>
      <View style={styles.row}>
        {!settings.accountPrivate ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Make the account private" disabled={busy} haptic="selection"
            onPress={() => void save({ accountPrivate: true }, undefined, 'The account is private.')} style={styles.button}>
            <Text style={styles.label}>Make private</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={settings.locked ? 'Unlock privacy settings' : 'Lock privacy settings'} disabled={busy} haptic="selection"
          onPress={() => void save({}, !settings.locked, settings.locked ? 'Settings unlocked.' : 'Settings locked: they can only be made stricter.')}
          style={[styles.button, !settings.locked && styles.buttonOn]}>
          <Text style={[styles.label, !settings.locked && styles.labelOn]}>{settings.locked ? 'Unlock' : 'Lock settings'}</Text>
        </Pressable>
      </View>
      {message ? <Text style={styles.message} accessibilityRole="alert">{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, marginTop: 12, padding: 16, borderRadius: radii.lg, backgroundColor: colors.surface },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: colors.textMuted, textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  buttonOn: { backgroundColor: FOCAL.violetInk, borderColor: FOCAL.violetInk },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  labelOn: { color: colors.onAccent },
  message: { fontSize: 13, color: colors.text },
});
