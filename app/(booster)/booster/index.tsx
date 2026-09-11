import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';

import { DashboardPanel } from '@/components/DashboardPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { colors, radii } from '@/constants/theme';
import { displayValue } from '@/data/players';
import { useRoster } from '@/hooks/useRoster';
import { supabase } from '@/lib/supabase';
import type { VerificationRequest } from '@/types/database';

function parseRosterCsv(raw: string) {
  const lines = raw.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const start = lines[0].toLowerCase().includes('name') ? 1 : 0;
  return lines.slice(start).flatMap((line) => {
    const [name, jersey, position, school_name] = line.split(',').map((part) => part.trim());
    if (!name) return [];
    return [
      {
        name,
        jersey_number: Number(jersey) || 0,
        position: position || 'ATH',
        school_name: school_name || '',
        height: '',
        backer_count: 0,
      },
    ];
  });
}

export default function BoosterHomeScreen() {
  const { players, refresh, setPlayers } = useRoster();
  const [csv, setCsv] = useState('name,jersey_number,position,school_name\nJane Doe,12,WR,Westlake High');
  const [queue, setQueue] = useState<VerificationRequest[]>([]);

  const loadQueue = useCallback(async () => {
    const { data } = await supabase
      .from('verification_requests')
      .select('*')
      .order('full_name', { ascending: true });
    setQueue((data as VerificationRequest[] | null) ?? []);
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const uploadCsv = async () => {
    const rows = parseRosterCsv(csv);
    if (rows.length === 0) {
      Alert.alert('CSV empty', 'Add at least one player row.');
      return;
    }
    const { error } = await supabase.from('players').insert(rows);
    if (error) {
      Alert.alert('Upload failed', error.message);
      return;
    }
    Alert.alert('Roster updated', `Inserted ${rows.length} player${rows.length === 1 ? '' : 's'}.`);
    void refresh();
  };

  const updateJersey = async (playerId: string, jersey: string) => {
    const jersey_number = Number(jersey);
    if (!Number.isInteger(jersey_number)) return;
    const { error } = await supabase.from('players').update({ jersey_number }).eq('id', playerId);
    if (error) {
      Alert.alert('Jersey update failed', error.message);
      return;
    }
    setPlayers((current) =>
      current.map((player) => (player.id === playerId ? { ...player, jersey_number } : player)),
    );
  };

  const verify = async (id: string, status: string) => {
    const { error } = await supabase.from('verification_requests').update({ status }).eq('id', id);
    if (error) {
      Alert.alert('Verification failed', error.message);
      return;
    }
    setQueue((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: 'Booster' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Booster Tools</Text>
        <DashboardPanel title="CSV bulk roster upload" body="Columns: name, jersey_number, position, school_name">
          <TextInput
            value={csv}
            onChangeText={setCsv}
            multiline
            textAlignVertical="top"
            style={styles.csv}
          />
          <Pressable accessibilityRole="button" onPress={() => void uploadCsv()} style={styles.primary}>
            <Text style={styles.primaryLabel}>Upload roster</Text>
          </Pressable>
        </DashboardPanel>
        <DashboardPanel title="Jersey number updates">
          {players.map((player) => (
            <View key={player.id} style={styles.row}>
              <Text style={styles.name}>{displayValue(player.name)}</Text>
              <TextInput
                keyboardType="number-pad"
                defaultValue={String(player.jersey_number)}
                onEndEditing={(event) => void updateJersey(player.id, event.nativeEvent.text)}
                style={styles.jersey}
              />
            </View>
          ))}
        </DashboardPanel>
        <DashboardPanel title="Profile verification queue">
          {queue.length === 0 ? (
            <Text style={styles.muted}>No pending verification requests.</Text>
          ) : (
            queue.map((item) => (
              <View key={item.id} style={styles.row}>
                <Text style={styles.name}>
                  {item.full_name} · {item.status}
                </Text>
                <Pressable onPress={() => void verify(item.id, 'verified')}>
                  <Text style={styles.link}>Verify</Text>
                </Pressable>
              </View>
            ))
          )}
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
  csv: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  jersey: {
    width: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlign: 'center',
    color: colors.text,
  },
  muted: {
    color: colors.textMuted,
  },
  link: {
    color: colors.accent,
    fontWeight: '800',
  },
});
