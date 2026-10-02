/**
 * One student row on the school confirmation form: the athletic director or coach attests they met the student
 * in person and that they are on the roster (`ROSTER_ATTESTATION`). Used by app/school-confirm.tsx.
 */

import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import type { ConfirmResult, ConfirmationRequest } from '@/lib/schoolConfirm';

export const ROSTER_ATTESTATION = 'I met this student in person and they are on my roster.';

/**
 * @purpose One student on the school confirmation form: the 6-digit code from their phone, the
 * in-person roster tick, and Confirm / Not on my roster.
 * @param signature The staff member's typed name (entered once at the top of the form).
 * @param onDecide Calls `school_confirm_athlete`; resolves with the server's result.
 */
export function SchoolConfirmRow({
  request,
  signature,
  onDecide,
}: {
  request: ConfirmationRequest;
  signature: string;
  onDecide: (approve: boolean, meetCode: string) => Promise<ConfirmResult>;
}) {
  const [code, setCode] = useState('');
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signed = signature.trim().length >= 3;
  const canConfirm = signed && attested && code.length === 6 && !busy;

  const decide = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    const result = await onDecide(approve, code);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setCode('');
    }
  };

  const decline = () =>
    Alert.alert(
      `${request.fullName} is not on your roster?`,
      'They stay unverified and gifts to them stay held. They can ask again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Not on my roster', style: 'destructive', onPress: () => void decide(false) },
      ],
    );

  const details = [request.sport, request.classYear ? `Class of ${request.classYear}` : null, request.jersey ? `#${request.jersey}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card} accessibilityLabel={`Student ${request.fullName}`}>
      <Text style={styles.name}>{request.fullName}</Text>
      {details ? <Text style={styles.details}>{details}</Text> : null}
      <Text style={[styles.codeState, request.codeReady && styles.codeReady]}>
        {request.codeReady ? 'Code is on their screen now' : 'Ask them to open Activity → “Show my school code”'}
      </Text>

      <TextInput
        accessibilityLabel={`6-digit code for ${request.fullName}`}
        editable={!busy}
        inputMode="numeric"
        keyboardType="number-pad"
        maxLength={6}
        placeholder="6-digit code"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        value={code}
        onChangeText={(next) => setCode(next.replace(/\D/g, ''))}
      />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: attested }}
        accessibilityLabel={ROSTER_ATTESTATION}
        onPress={() => setAttested((prev) => !prev)}
        style={styles.tickRow}
      >
        <Ionicons name={attested ? 'checkbox' : 'square-outline'} size={22} color={colors.deepGreen} />
        <Text style={styles.tickLabel}>{ROSTER_ATTESTATION}</Text>
      </Pressable>

      {!signed ? <Text style={styles.details}>Sign with your full name at the top first.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy || !signed}
          onPress={decline}
          style={[styles.button, styles.decline, (busy || !signed) && styles.dim]}
        >
          <Text style={styles.declineLabel}>Not on my roster</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!canConfirm}
          onPress={() => void decide(true)}
          style={[styles.button, styles.confirm, !canConfirm && styles.dim]}
        >
          <Text style={styles.confirmLabel}>Confirm</Text>
        </Pressable>
      </View>
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
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  details: {
    color: colors.textMuted,
    fontSize: 13,
  },
  codeState: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  codeReady: {
    color: colors.deepGreen,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
  },
  tickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tickLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
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
  confirm: {
    backgroundColor: colors.deepGreen,
  },
  confirmLabel: {
    color: colors.onAccent,
    fontWeight: '800',
  },
  dim: {
    opacity: 0.5,
  },
});
