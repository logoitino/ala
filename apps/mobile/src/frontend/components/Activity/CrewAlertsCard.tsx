/**
 * Crew alerts on Activity (DATA-01 F2). When an athlete a fan follows opens a Flash unlock, the server
 * queues a Crew alert for that fan; nothing used to read or clear that queue. This card shows the
 * signed-in fan's alerts and clears them, so the queue cannot grow without end. Push delivery is not
 * built; this is the in-app channel. Renders nothing when there are no alerts.
 * @sideEffects `crew_push_queue` SELECT on focus; `clear_my_crew_alerts` RPC on Clear.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { clearMyCrewAlerts, fetchMyCrewAlerts, type CrewAlert } from '@/lib/crew';
import { userProfileHref } from '@/lib/navigation';

/** @purpose The signed-in fan's Crew alerts with a Clear action. */
export function CrewAlertsCard() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<CrewAlert[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void fetchMyCrewAlerts().then((rows) => { if (live) setAlerts(rows); });
      return () => { live = false; };
    }, []),
  );

  const onClear = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await clearMyCrewAlerts();
      setAlerts([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear alerts.');
    } finally {
      setBusy(false);
    }
  }, []);

  if (!alerts.length) return null;
  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.kicker}>Crew alerts</Text>
      {alerts.slice(0, 5).map((alert) => (
        <Pressable key={alert.id} accessibilityRole="button" accessibilityLabel={alert.title || 'Open athlete'} disabled={!alert.athleteId}
          onPress={() => { if (alert.athleteId) router.push(userProfileHref(alert.athleteId)); }} style={styles.row}>
          <Text style={styles.title}>{alert.title || 'New from your Crew'}</Text>
          {alert.body ? <Text style={styles.body}>{alert.body}</Text> : null}
          <Text style={styles.body}>{new Date(alert.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
        </Pressable>
      ))}
      {alerts.length > 5 ? <Text style={styles.body}>{`+${alerts.length - 5} more`}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Clear Crew alerts" disabled={busy} onPress={() => { void onClear(); }} style={styles.clear}>
        <Text style={styles.clearText}>{busy ? 'Clearing…' : 'Clear'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 },
  kicker: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  row: { minHeight: 44, justifyContent: 'center', gap: 2 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13 },
  clear: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 12 },
  clearText: { color: colors.text, fontSize: 14, fontWeight: '800' },
});
