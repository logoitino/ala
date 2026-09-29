import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '@/constants/theme';
import { useReceivedMalo } from '@/hooks/useReceivedMalo';
import { tipChannelLabel } from '@/lib/finance';

/**
 * @purpose Private list on an athlete's own profile of each gift they received and where it started.
 * @param playerId This athlete's `players.id`.
 * @sideEffects `useReceivedMalo` → `get_received_malo`.
 */
export function ReceivedMaloPanel({ playerId }: { playerId: string }) {
  const { rows, totalCents, loading } = useReceivedMalo(playerId);
  const dollars = `$${(totalCents / 100).toFixed(2)}`;

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel={`Support received, ${dollars}`}>
      <Text style={styles.kicker}>Support received</Text>
      <Text style={styles.total}>{loading ? 'Loading gifts…' : `${dollars} from fans`}</Text>
      <Text style={styles.lede}>
        Each gift shows who sent it and where it started: a Highlight, a QR link, a wishlist item, your profile, or a live play.
      </Text>
      {loading ? <ActivityIndicator color={colors.deepGreen} /> : null}
      {!loading && rows.length === 0 ? (
        <Text style={styles.empty}>No donations yet. They show up here after a fan donates.</Text>
      ) : null}
      {rows.slice(0, 8).map((row) => (
        <View key={row.id} style={styles.row}>
          <View style={styles.identity}>
            <Text style={styles.name}>{row.fan_name}</Text>
            <Text style={styles.meta}>{tipChannelLabel(row.origin, row.entry, row.source_label)}</Text>
          </View>
          <Text style={styles.amount}>${(row.amount_cents / 100).toFixed(2)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    marginTop: 12,
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.deepGreen,
  },
  total: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  lede: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  amount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.deepGreen,
  },
});
