import { StyleSheet, Text, View } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import {
  VAULT_LOCK_ACTION,
  VAULT_LOCKED_HINT,
  VAULT_OPEN_ACTION,
  VAULT_OPEN_HINT,
} from '@/data/exclusive';
import { FOCAL } from '@/theme/motion';

type VaultLockCardProps = {
  locked: boolean;
  busy?: boolean;
  onToggle: (nextLocked: boolean) => void;
};

/**
 * @purpose Athlete Management master switch: Lock Vault 🔒 (subscribe to watch) or Open Vault 🌐.
 * @param locked Current `players.vault_locked`.
 * @param busy Disables the action while the RPC is in flight.
 * @param onToggle Persists the next lock flag.
 */
export function VaultLockCard({ locked, busy = false, onToggle }: VaultLockCardProps) {
  const { live } = useAppRuntime();
  const dollars = live.catalog.exclusiveDollars;
  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.kicker}>{locked ? 'Vault locked 🔒' : 'Vault open 🌐'}</Text>
      <Text style={styles.body}>{locked ? VAULT_LOCKED_HINT : VAULT_OPEN_HINT}</Text>
      <Text style={styles.meta}>
        {locked
          ? `Subscribers pay $${dollars.toFixed(2)}/mo to watch Vault Highlights ⚡.`
          : 'Long-press a clip to move it into the Vault collection, then lock when you are ready.'}
      </Text>
      <AnimatedButton
        accessibilityLabel={locked ? VAULT_OPEN_ACTION : VAULT_LOCK_ACTION}
        disabled={busy}
        haptic="medium"
        onPress={() => onToggle(!locked)}
        contentStyle={[styles.btn, busy && styles.busy]}
      >
        <Text style={styles.btnLabel}>{busy ? 'Updating…' : locked ? VAULT_OPEN_ACTION : VAULT_LOCK_ACTION}</Text>
      </AnimatedButton>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: FOCAL.jadeInk,
    padding: 14,
    gap: 8,
  },
  kicker: {
    color: FOCAL.jadeInk,
    fontSize: 15,
    fontWeight: '800',
  },
  body: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  btn: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  busy: {
    opacity: 0.55,
  },
  btnLabel: {
    color: FOCAL.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
