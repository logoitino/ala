import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Stack } from 'expo-router';

import { DashboardPanel } from '@/components/DashboardPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { displayValue } from '@/data/players';
import { useRoster } from '@/hooks/useRoster';
import { supabase } from '@/lib/supabase';
import type { TipLedgerEntry } from '@/types/database';

export default function AthleteHomeScreen() {
  const { profile } = useAuth();
  const { players } = useRoster();
  const [tips, setTips] = useState<TipLedgerEntry[]>([]);
  const [headline, setHeadline] = useState(profile?.full_name ?? '');

  const athlete = players[0] ?? null;

  const loadTips = useCallback(async () => {
    if (!athlete) {
      setTips([]);
      return;
    }
    const { data } = await supabase
      .from('tips')
      .select('*')
      .eq('player_id', athlete.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setTips((data as TipLedgerEntry[] | null) ?? []);
  }, [athlete]);

  useEffect(() => {
    void loadTips();
  }, [loadTips]);

  const total = tips.reduce((sum, tip) => sum + tip.amount_cents, 0);

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: 'Athlete' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Athlete HQ</Text>
        <DashboardPanel
          title="Private tip ledger"
          body={
            athlete
              ? `${displayValue(athlete.name)} has received $${(total / 100).toFixed(2)} from fans.`
              : 'No linked athlete profile yet.'
          }
        >
          {tips.length === 0 ? (
            <Text style={styles.muted}>Tips will appear here after PaymentSheet checkouts.</Text>
          ) : (
            tips.map((tip) => (
              <Text key={tip.id} style={styles.row}>
                ${(tip.amount_cents / 100).toFixed(2)} · {new Date(tip.created_at).toLocaleDateString()}
              </Text>
            ))
          )}
        </DashboardPanel>
        <DashboardPanel title="Training badges" body="Unlocked by live-game volume and fan backing.">
          <Text style={styles.badge}>Film Room · Starter</Text>
          <Text style={styles.badge}>Community Backer Magnet</Text>
          <Text style={styles.badge}>Friday Night Lights</Text>
        </DashboardPanel>
        <DashboardPanel title="Profile customization">
          <TextInput
            value={headline}
            onChangeText={setHeadline}
            placeholder="Display name / headline"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.muted}>Saved locally for this device until account linking ships.</Text>
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
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  row: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  badge: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
});
