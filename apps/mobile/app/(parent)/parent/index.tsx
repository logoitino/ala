/**
 * Parent HQ: for a guardian, the linked athletes, consent for each (`setParentPlayerConsent`), the custodial
 * money card, the Rally card, a Share & Give QR per athlete and teen supervision (MINOR-01).
 * Failures show Retry rather than an empty list.
 */

import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { Stack } from 'expo-router';

import { GuardianCustodialCard } from '@/components/Custodial/GuardianCustodialCard';
import { ReceivedMaloPanel } from '@/components/Profile/ReceivedMaloPanel';
import { ShareQrModal } from '@/components/Profile/ShareQrModal';
import { RallyCard } from '@/components/Rally/RallyCard';
import { DashboardPanel } from '@/components/DashboardPanel';
import { ScreenHeading } from '@/components/ScreenHeading';
import { FOCAL } from '@/theme/motion';
import { FamilyFunDiscovery } from '@/components/FamilyFun/FamilyFunDiscovery';
import { ScreenShell } from '@/components/ScreenShell';
import { TagConfirmList } from '@/components/Spotlight/TagConfirmList';
import { EmptyState } from '@/components/UI/EmptyState';
import { colors, KIT } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { telemetry } from '@/services/TelemetryManager';
import { COMPLIANCE_PARENT } from '@/data/legal';
import { displayValue, type Player } from '@/data/players';
import { SHARE_FUND_CTA } from '@/data/share';
import { usePendingPlayerTags } from '@/hooks/usePendingPlayerTags';
import { useRoster } from '@/hooks/useRoster';
import { setParentPlayerConsent } from '@/lib/custodial';
import { GuardianSupervisionPanel } from '@/components/Custodial/GuardianSupervisionPanel';

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
  const [shareFor, setShareFor] = useState<Player | null>(null);

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
      const error = await setParentPlayerConsent(playerId, approved);
      if (error) {
        Alert.alert('Couldn’t update consent', error);
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
          accent={FOCAL.jadeInk}
        />
        <FamilyFunDiscovery />
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
        {/* MINOR-01: supervision, approvals and the signed consent (replaces the PRIV-01 privacy lock card). */}
        <GuardianSupervisionPanel />
        {!rosterError ? players.map((player) => (
          <View key={player.id} style={styles.athlete}>
            {/* Families do most of the sharing; the QR uses the athlete id, so it works before the athlete picks a username. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${SHARE_FUND_CTA} for ${displayValue(player.name, 'your athlete')}`}
              haptic="selection"
              onPress={() => setShareFor(player)}
              style={styles.share}
            >
              <Text style={styles.shareLabel}>{`${SHARE_FUND_CTA} · ${displayValue(player.name, 'your athlete')}`}</Text>
              <Text style={styles.muted}>A QR and link family can use to give.</Text>
            </Pressable>
            {/* Rally goal (start / approve / close / thank) and donations to say thanks for. */}
            <RallyCard player={player} athleteName={displayValue(player.name, 'your athlete')} manage guardian />
            <ReceivedMaloPanel playerId={player.id} />
            <GuardianCustodialCard playerId={player.id} />
          </View>
        )) : null}
      </ScrollView>
      {/* Mounted only while open: the sheet finishes its own close animation before onClose clears it. */}
      {shareFor ? (
        <ShareQrModal
          visible
          athleteName={displayValue(shareFor.name, 'your athlete')}
          playerId={shareFor.id}
          onClose={() => setShareFor(null)}
        />
      ) : null}
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
  share: {
    minHeight: 48,
    borderRadius: KIT.controlRadius,
    borderWidth: 0,
    borderColor: colors.deepGreen,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  shareLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.deepGreen,
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
    fontWeight: '800',
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
    backgroundColor: colors.surface,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  chipLabel: {
    fontWeight: '700',
    color: colors.text,
  },
  chipLabelOn: {
    color: colors.background,
  },
});
