/** Existing athlete support screen/helper: visible money copy names personal gifts; identifiers and financial behavior stay unchanged. */
import { Alert, StyleSheet, Text, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { formatTipDollars as formatUsd } from '@/lib/reels';
import { useCustodial } from '@/hooks/useCustodial';
import { athleteMoneyNotice, pendingRequests, receivedLines, type CustodialWithdrawal } from '@/lib/custodial';

import { WithdrawalHistory } from './WithdrawalHistory';

/**
 * @purpose The athlete's view of their own money: who holds it, until when, and every guardian
 * withdrawal waiting on their OK (owner rule 2026-09-29 — no withdrawal without the athlete).
 * @param playerId The signed-in user's `profiles.player_id`. Renders nothing unless the server
 * says this viewer is that athlete (verified) and the custodial SQL is applied.
 * @sideEffects `useCustodial` (summary on focus; approve / decline RPCs).
 */
export function AthleteMoneyCard({ playerId }: { playerId: string | null | undefined }) {
  const custodial = useCustodial(playerId);
  const { summary } = custodial;
  if (!custodial.available || !summary || summary.viewerRole !== 'athlete') return null;

  const pending = pendingRequests(summary);

  const decide = (request: CustodialWithdrawal, approve: boolean) => {
    const amount = formatUsd(request.amountCents);
    Alert.alert(
      approve ? `Let ${summary.guardianName} withdraw ${amount}?` : `Decline ${amount}?`,
      approve
        ? 'They can move this amount out of the account held for you. You can’t undo this.'
        : 'The money stays in the account held for you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: approve ? 'Approve' : 'Decline',
          style: approve ? 'default' : 'destructive',
          onPress: () =>
            void custodial.decide(request.id, approve).catch((error: unknown) => {
              Alert.alert('Couldn’t save that', error instanceof Error ? error.message : 'Try again.');
            }),
        },
      ],
    );
  };

  const received = receivedLines(summary.receivedCents, summary.familyCents, formatUsd);

  return (
    <View style={styles.card} accessibilityLabel="Your money">
      <Text style={styles.kicker}>{summary.athleteControls ? 'Your money' : 'Your gifts'}</Text>
      <Text style={styles.total}>{received.headline}</Text>
      <Text style={styles.body}>{received.detail}</Text>
      <Text style={styles.body}>{athleteMoneyNotice(summary)}</Text>

      {pending.map((request) => (
        <View key={request.id} style={styles.pending}>
          <Text style={styles.pendingTitle}>
            {summary.guardianName} wants to withdraw {formatUsd(request.amountCents)}
          </Text>
          {request.note ? <Text style={styles.body}>“{request.note}”</Text> : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={custodial.busy}
              onPress={() => decide(request, false)}
              style={[styles.button, styles.decline, custodial.busy && styles.dim]}
            >
              <Text style={styles.declineLabel}>Decline</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={custodial.busy}
              onPress={() => decide(request, true)}
              style={[styles.button, styles.approve, custodial.busy && styles.dim]}
            >
              <Text style={styles.approveLabel}>Approve</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <WithdrawalHistory requests={summary.requests} />
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
    gap: 8,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  total: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  pending: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.deepGreen,
    padding: 12,
    gap: 8,
  },
  pendingTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: 10,
    alignItems: 'center',
  },
  decline: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  declineLabel: {
    color: colors.text,
    fontWeight: '700',
  },
  approve: {
    backgroundColor: colors.deepGreen,
  },
  approveLabel: {
    color: colors.onAccent,
    fontWeight: '800',
  },
  dim: {
    opacity: 0.5,
  },
});
