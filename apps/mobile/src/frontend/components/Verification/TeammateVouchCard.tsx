import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { fetchTeammatesToVouch, vouchForTeammate, type TeammateToVouch } from '@/lib/payoutGate';

/**
 * @purpose "Teammates waiting" on Activity: a confirmed athlete (school badge, or payouts unlocked) vouches
 *   that a pending teammate is on the team. Three vouches lift that teammate's payout cap (design §9).
 *   Renders nothing when there is no one to vouch for, or the caller may not vouch.
 * @sideEffects `get_teammates_to_vouch` on focus; `vouch_for_teammate`.
 */
export function TeammateVouchCard() {
  const [teammates, setTeammates] = useState<TeammateToVouch[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void fetchTeammatesToVouch().then((rows) => {
        if (live) setTeammates(rows);
      });
      return () => {
        live = false;
      };
    }, []),
  );

  const onVouch = useCallback(async (requestId: string) => {
    setBusyId(requestId);
    setError(null);
    try {
      const vouches = await vouchForTeammate(requestId);
      setTeammates((rows) =>
        rows.map((row) => (row.requestId === requestId ? { ...row, vouches, vouchedByMe: true } : row)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusyId(null);
    }
  }, []);

  return <TeammateVouchCardView teammates={teammates} busyId={busyId} error={error} onVouch={(id) => void onVouch(id)} />;
}

/**
 * @purpose Pure view so the list can be tested without the network.
 */
export function TeammateVouchCardView({
  teammates,
  busyId,
  error,
  onVouch,
}: {
  teammates: TeammateToVouch[];
  busyId: string | null;
  error: string | null;
  onVouch: (requestId: string) => void;
}) {
  if (teammates.length === 0) return null;
  return (
    <View style={styles.card} accessibilityLabel="Teammates waiting for a vouch">
      <Text style={styles.kicker}>Teammates waiting</Text>
      <Text style={styles.body}>Only vouch for someone you know is on your team. Your name is kept with the vouch.</Text>
      {teammates.map((mate) => {
        const detail = [mate.sport, mate.classYear ? `Class of ${mate.classYear}` : null, mate.jersey ? `#${mate.jersey}` : null]
          .filter(Boolean)
          .join(' · ');
        return (
          <View key={mate.requestId} style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.name} numberOfLines={1}>
                {mate.name}
              </Text>
              <Text style={styles.detail} numberOfLines={1}>
                {detail ? `${detail} · ` : ''}
                {Math.min(mate.vouches, 3)}/3 vouches
              </Text>
            </View>
            {mate.vouchedByMe ? (
              <Text style={styles.done}>Vouched ✓</Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Vouch for ${mate.name}`}
                haptic="selection"
                disabled={busyId != null}
                onPress={() => onVouch(mate.requestId)}
                style={[styles.button, busyId === mate.requestId && styles.dim]}
              >
                <Text style={styles.buttonLabel}>They’re on my team</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  detail: {
    color: colors.textMuted,
    fontSize: 12,
  },
  button: {
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.deepGreen,
  },
  buttonLabel: {
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: '800',
  },
  done: {
    color: colors.deepGreen,
    fontSize: 13,
    fontWeight: '800',
  },
  dim: {
    opacity: 0.5,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
