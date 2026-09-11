import * as Location from 'expo-location';
import { Stack, type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DashboardPanel } from '@/components/DashboardPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { colors, radii } from '@/constants/theme';
import { displayValue } from '@/data/players';
import { useLiveScores } from '@/hooks/useLiveScores';
import { supabase } from '@/lib/supabase';

export default function OperatorHomeScreen() {
  const router = useRouter();
  const { games } = useLiveScores();
  const [checkIn, setCheckIn] = useState('Not checked in');

  const gpsCheckIn = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Location needed', 'Enable location to check in at the field.');
      return;
    }

    const position = await Location.getCurrentPositionAsync({});
    const label = `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
    setCheckIn(`Checked in at ${label}`);
    await supabase.from('operator_checkins').insert({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
  };

  return (
    <ScreenShell>
      <Stack.Screen options={{ title: 'Operator' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Sideline Operator</Text>
        <DashboardPanel title="GPS check-in" body={checkIn}>
          <Pressable accessibilityRole="button" onPress={() => void gpsCheckIn()} style={styles.primary}>
            <Text style={styles.primaryLabel}>Check in at venue</Text>
          </Pressable>
        </DashboardPanel>
        <DashboardPanel title="Game gig marketplace" body="Claim a live game, then open play macros.">
          <View style={styles.list}>
            {games.map((game) => (
              <Pressable
                key={game.id}
                accessibilityRole="button"
                onPress={() => router.push('/operator/scorer' as Href)}
                style={styles.gig}
              >
                <Text style={styles.gigTitle}>
                  {displayValue(game.home_team)} vs {displayValue(game.away_team)}
                </Text>
                <Text style={styles.muted}>{displayValue(game.venue)} · Open gig</Text>
              </Pressable>
            ))}
          </View>
        </DashboardPanel>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/operator/scorer' as Href)}
          style={styles.secondary}
        >
          <Text style={styles.secondaryLabel}>Open live play macros (TD / Tackle / Sack)</Text>
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
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  list: {
    gap: 8,
  },
  gig: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    backgroundColor: colors.background,
    gap: 4,
  },
  gigTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
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
  secondary: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
  },
});
