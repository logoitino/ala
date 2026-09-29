import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { withdrawalStatusLabel, type CustodialWithdrawal } from '@/lib/custodial';
import { formatTipDollars } from '@/lib/reels';

/** Past (non-pending) withdrawal requests, newest first, shared by the athlete and guardian cards. */
export function WithdrawalHistory({ requests }: { requests: CustodialWithdrawal[] }) {
  const past = requests.filter((r) => r.status !== 'pending_athlete').slice(0, 5);
  if (past.length === 0) return null;
  return (
    <View style={styles.list}>
      <Text style={styles.heading}>Withdrawals</Text>
      {past.map((request) => (
        <View key={request.id} style={styles.row}>
          <Text style={styles.amount}>{formatTipDollars(request.amountCents)}</Text>
          <Text style={styles.status}>{withdrawalStatusLabel(request.status)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 4,
    marginTop: 4,
  },
  heading: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  amount: {
    color: colors.text,
    fontSize: 14,
  },
  status: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
