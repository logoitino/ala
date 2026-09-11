import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { FeeCheckbox } from '@/components/FeeCheckbox';
import { TipButton } from '@/components/TipButton';
import { colors } from '@/constants/theme';
import { MALO_DISCLAIMER, TIP_AMOUNTS, displayValue, type Player } from '@/data/players';
import { useTipCheckout } from '@/hooks/useTipCheckout';

type TipCheckoutProps = {
  player: Player;
  compact?: boolean;
  onBacked?: (nextCount: number) => void;
};

export function TipCheckout({ player, compact = false, onBacked }: TipCheckoutProps) {
  const [coverFees, setCoverFees] = useState(true);
  const { startCheckout, busy } = useTipCheckout();
  const playerName = displayValue(player.name, 'this athlete');

  return (
    <View style={[styles.section, compact && styles.compact]}>
      <View style={styles.tipRow}>
        {TIP_AMOUNTS.map((amount) => (
          <TipButton
            key={amount}
            amount={amount}
            disabled={busy}
            onPress={(tipAmount) =>
              void startCheckout({ player, tipAmount, coverFees, onBacked })
            }
          />
        ))}
      </View>

      <FeeCheckbox playerName={playerName} checked={coverFees} onChange={setCoverFees} />

      <Text style={styles.disclaimer}>{MALO_DISCLAIMER}</Text>

      {busy ? (
        <View style={styles.busyRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.busyText}>Opening PaymentSheet…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  compact: {
    gap: 10,
    marginTop: 4,
  },
  tipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.textMuted,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  busyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
