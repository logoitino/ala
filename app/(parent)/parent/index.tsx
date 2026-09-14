import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { Stack } from 'expo-router';

import { DashboardPanel } from '@/components/DashboardPanel';
import { ScreenHeading } from '@/components/ScreenHeading';
import { ScreenShell } from '@/components/ScreenShell';
import { TagConfirmList } from '@/components/Spotlight/TagConfirmList';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { displayValue } from '@/data/players';
import { usePendingPlayerTags } from '@/hooks/usePendingPlayerTags';
import { useRoster } from '@/hooks/useRoster';
import { requestPayout } from '@/lib/payouts';
import { supabase } from '@/lib/supabase';

export default function ParentHomeScreen() {
  const { profile } = useAuth();
  const { players, setPlayers } = useRoster();
  const pending = usePendingPlayerTags();
  const [busy, setBusy] = useState(false);

  const toggleConsent = async (playerId: string, approved: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const patch: { parental_consent_approved: boolean; guardian_id?: string | null } = {
        parental_consent_approved: approved,
      };
      if (approved && profile?.id) patch.guardian_id = profile.id;
      const { error } = await supabase.from('players').update(patch).eq('id', playerId);
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

  const setupPayout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await requestPayout({
        amountCents: 2500,
        description: "Parent custodial payout setup",
      });
      Alert.alert('Custodial payout', result.message);
    } catch (error) {
      Alert.alert('Payout setup failed', error instanceof Error ? error.message : 'Unknown error');
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
          lede="Consent, custodial payouts, and confirm that a fan tagged the right jersey."
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
          body="Approve minor consent before public Mālo is enabled for each athlete."
        >
          <View style={styles.list}>
            {players.map((player) => {
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
            })}
          </View>
        </DashboardPanel>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void setupPayout()}
          style={styles.primary}
        >
          <Text style={styles.primaryLabel}>Set up Stripe custodial payout</Text>
        </Pressable>
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
  primary: {
    backgroundColor: colors.deepGreen,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryLabel: {
    color: colors.onAccent,
    fontWeight: '800',
    fontSize: 16,
  },
});
