import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import { DashboardPanel } from '@/components/DashboardPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { colors } from '@/constants/theme';
import { displayValue } from '@/data/players';
import { useRoster } from '@/hooks/useRoster';
import { requestPayout } from '@/lib/payouts';
import { supabase } from '@/lib/supabase';
import type { Disbursement, Profile, VerificationRequest } from '@/types/database';

export default function AdminHomeScreen() {
  const { players } = useRoster();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [queue, setQueue] = useState<VerificationRequest[]>([]);
  const [payouts, setPayouts] = useState<Disbursement[]>([]);

  const refresh = useCallback(async () => {
    const [profileResult, queueResult, payoutResult] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('verification_requests').select('*'),
      supabase.from('disbursements').select('*').order('created_at', { ascending: false }).limit(12),
    ]);
    setProfiles((profileResult.data as Profile[] | null) ?? []);
    setQueue((queueResult.data as VerificationRequest[] | null) ?? []);
    setPayouts((payoutResult.data as Disbursement[] | null) ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const verifyAccount = async (id: string, is_verified: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_verified }).eq('id', id);
    if (error) {
      Alert.alert('Override failed', error.message);
      return;
    }
    setProfiles((current) =>
      current.map((item) => (item.id === id ? { ...item, is_verified } : item)),
    );
  };

  const disburse = async (playerId: string, name: string) => {
    try {
      const result = await requestPayout({
        amountCents: 5000,
        description: `Admin disbursement for ${name}`,
      });
      await supabase.from('disbursements').insert({
        player_id: playerId,
        amount_cents: 5000,
        status: result.status,
      });
      Alert.alert('God Mode payout', result.message);
      void refresh();
    } catch (error) {
      Alert.alert('Disbursement failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: 'Admin' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>God Mode</Text>
        <DashboardPanel title="Account verification overrides">
          {profiles.length === 0 ? (
            <Text style={styles.muted}>No profiles yet. They appear after auth + schema.sql.</Text>
          ) : (
            profiles.map((profile) => (
              <View key={profile.id} style={styles.row}>
                <Text style={styles.name}>
                  {profile.full_name} · {profile.role}
                </Text>
                <Pressable onPress={() => void verifyAccount(profile.id, !profile.is_verified)}>
                  <Text style={styles.link}>{profile.is_verified ? 'Unverify' : 'Verify'}</Text>
                </Pressable>
              </View>
            ))
          )}
        </DashboardPanel>
        <DashboardPanel title="Booster verification queue">
          {queue.length === 0 ? (
            <Text style={styles.muted}>Queue is clear.</Text>
          ) : (
            queue.map((item) => (
              <Text key={item.id} style={styles.name}>
                {item.full_name} · {item.status}
              </Text>
            ))
          )}
        </DashboardPanel>
        <DashboardPanel title="Financial disbursements">
          {players.slice(0, 6).map((player) => (
            <View key={player.id} style={styles.row}>
              <Text style={styles.name}>{displayValue(player.name)}</Text>
              <Pressable onPress={() => void disburse(player.id, displayValue(player.name))}>
                <Text style={styles.link}>Pay $50</Text>
              </Pressable>
            </View>
          ))}
          {payouts.map((item) => (
            <Text key={item.id} style={styles.muted}>
              ${(item.amount_cents / 100).toFixed(2)} · {item.status}
            </Text>
          ))}
        </DashboardPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 14,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  link: {
    color: colors.accent,
    fontWeight: '800',
  },
});
