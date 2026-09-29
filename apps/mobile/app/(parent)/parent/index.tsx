import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { Stack } from 'expo-router';

import { GuardianCustodialCard } from '@/components/Custodial/GuardianCustodialCard';
import { ReceivedMaloPanel } from '@/components/Profile/ReceivedMaloPanel';
import { RallyCard } from '@/components/Rally/RallyCard';
import { DashboardPanel } from '@/components/DashboardPanel';
import { ScreenHeading } from '@/components/ScreenHeading';
import { ScreenShell } from '@/components/ScreenShell';
import { TagConfirmList } from '@/components/Spotlight/TagConfirmList';
import { EmptyState } from '@/components/UI/EmptyState';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { telemetry } from '@/services/TelemetryManager';
import { COMPLIANCE_PARENT } from '@/data/legal';
import { displayValue } from '@/data/players';
import { usePendingPlayerTags } from '@/hooks/usePendingPlayerTags';
import { useRoster } from '@/hooks/useRoster';
import { supabase } from '@/lib/supabase';

export default function ParentHomeScreen() {
  const { live } = useAppRuntime();
  const { profile } = useAuth();
  const { players: roster, loading: rosterLoading, error: rosterError, refresh: refreshRoster, setPlayers } = useRoster();
  // Owner rule 2026-09-29: a guardian sees only the athletes linked to them (`players.guardian_id`,
  // set by an admin after verification), never the whole roster.
  const players = useMemo(
    () => (profile?.id ? roster.filter((player) => player.guardian_id === profile.id) : []),
    [profile?.id, roster],
  );
  const pending = usePendingPlayerTags();
  const [busy, setBusy] = useState(false);

  const toggleConsent = async (playerId: string, approved: boolean) => {
    if (approved) {
      Alert.alert('Prototype consent', COMPLIANCE_PARENT, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save toggle', onPress: () => void writeConsent(playerId, true) },
      ]);
      return;
    }
    await writeConsent(playerId, false);
  };

  const writeConsent = async (playerId: string, approved: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      telemetry.trackFeature('parent_consent', 'parent');
      // 2026-09 audit item 2: `parental_consent_approved` / `guardian_consent_at` are no longer
      // directly UPDATE-able (column grant narrowed to close the booster/operator guardian-write
      // hole) — this now goes through `parent_set_player_consent`, which re-checks server-side
      // that this row's `guardian_id` already equals the caller's own linked profile.
      const { error } = await supabase.rpc('parent_set_player_consent', {
        target_player_id: playerId,
        approved,
      });
      if (error) {
        Alert.alert('Couldn’t update consent', error.message);
        return;
      }
      setPlayers((current) =>
        current.map((player) =>
          player.id === playerId ? { ...player, parental_consent_approved: approved } : player,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: 'Parent' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeading
          kicker="Tapua'i parent"
          title="Parent Guardian"
          lede={live.copy.parentLede}
        />
        <TagConfirmList
          tags={pending.tags}
          busyId={pending.busyId}
          error={pending.error}
          emptyText="No pending tags for your athletes."
          onConfirm={(id) => void pending.resolve(id, 'confirm')}
          onReject={(id) => void pending.resolve(id, 'reject')}
        />
        <DashboardPanel
          title="Linked student-athletes"
          body={COMPLIANCE_PARENT}
        >
          <View style={styles.list}>
            {!rosterLoading && rosterError ? (
              <EmptyState
                kicker="Roster"
                title="Could not load linked athletes"
                lede="Check your connection and try again."
                actionLabel="Retry"
                onAction={() => void refreshRoster()}
              />
            ) : null}
            {!rosterLoading && !rosterError && players.length === 0 ? (
              <Text style={styles.muted}>
                No athletes are linked to you yet. Tapua'i links a guardian after checking who they are.
              </Text>
            ) : null}
            {!rosterError ? players.map((player) => {
              const approved = Boolean(player.parental_consent_approved);
              return (
                <View key={player.id} style={styles.row}>
                  <View style={styles.meta}>
                    <Text style={styles.name}>
                      #{displayValue(player.jersey_number)} {displayValue(player.name)}
                    </Text>
                    <Text style={styles.muted}>
                      {approved ? 'Consent approved' : 'Consent required'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void toggleConsent(player.id, !approved)}
                    style={[styles.chip, approved && styles.chipOn, busy && { opacity: 0.5 }]}
                  >
                    <Text style={[styles.chipLabel, approved && styles.chipLabelOn]}>
                      {approved ? 'Revoke' : 'Approve'}
                    </Text>
                  </Pressable>
                </View>
              );
            }) : null}
          </View>
        </DashboardPanel>
        {!rosterError ? players.map((player) => (
          <View key={player.id} style={styles.athlete}>
            {/* Rally goal (start / approve / close / thank) and donations to say thanks for. */}
            <RallyCard player={player} athleteName={displayValue(player.name, 'your athlete')} manage guardian />
            <ReceivedMaloPanel playerId={player.id} />
            <GuardianCustodialCard playerId={player.id} />
          </View>
        )) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 14,
  },
  list: {
    gap: 10,
  },
  athlete: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: colors.deepGreen,
    borderColor: colors.deepGreen,
  },
  chipLabel: {
    fontWeight: '700',
    color: colors.text,
  },
  chipLabelOn: {
    color: colors.onAccent,
  },
});
