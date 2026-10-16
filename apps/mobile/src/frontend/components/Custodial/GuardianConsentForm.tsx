/**
 * The guardian consent form (MINOR-01): the versioned clauses from `data/guardianConsent.ts`, one tick box per
 * permission, parent / legal guardian, and the typed full name that is the signature. The draft version carries a
 * "testing only" banner (counsel writes the final text, LEGAL row AA). Payouts can only be allowed by the guardian on
 * record for the athlete's family account; everyone else sees why.
 */
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { LegalAckToggle } from '@/components/Legal/LegalModal';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors } from '@/constants/theme';
import { GUARDIAN_CONSENT_CLAUSES, GUARDIAN_CONSENT_IS_DRAFT, GUARDIAN_CONSENT_VERSION, fillConsentClause } from '@/data/guardianConsent';
import type { ConsentInput } from '@/lib/minors';
import { FOCAL } from '@/theme/motion';

type Props = {
  teenFirstName: string;
  canAllowDonations: boolean;
  initial?: Partial<ConsentInput>;
  busy?: boolean;
  onSign: (consent: ConsentInput) => void;
  onCancel?: () => void;
};

/** @purpose Read, choose permissions and sign. */
export function GuardianConsentForm({ teenFirstName, canAllowDonations, initial, busy, onSign, onCancel }: Props) {
  const [publicProfile, setPublicProfile] = useState(initial?.allowsPublicProfile ?? false);
  const [donations, setDonations] = useState(canAllowDonations && (initial?.allowsDonations ?? false));
  const [relationship, setRelationship] = useState<ConsentInput['relationship']>(initial?.relationship ?? 'parent');
  const [name, setName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const ready = name.trim().length >= 2 && confirmed && !busy;

  return (
    <View style={styles.wrap}>
      {GUARDIAN_CONSENT_IS_DRAFT ? (
        <Text style={styles.draft} accessibilityRole="alert">
          {`Draft form (${GUARDIAN_CONSENT_VERSION}) for testing only. Counsel has not approved this text.`}
        </Text>
      ) : null}
      {GUARDIAN_CONSENT_CLAUSES.map((clause) => (
        <View key={clause.title} style={styles.clause}>
          <Text style={styles.clauseTitle}>{clause.title}</Text>
          <Text style={styles.body}>{fillConsentClause(clause.body, teenFirstName)}</Text>
        </View>
      ))}
      <Text style={styles.section}>Permissions</Text>
      <LegalAckToggle checked={publicProfile} onCheckedChange={setPublicProfile} disabled={busy} label={`${teenFirstName} may have a public profile`} />
      {canAllowDonations ? (
        <LegalAckToggle checked={donations} onCheckedChange={setDonations} disabled={busy} label={`Donations to ${teenFirstName} may be paid out to the family account on record`} />
      ) : (
        <Text style={styles.body}>Payouts can only be allowed by the guardian on record for this athlete&apos;s family account.</Text>
      )}
      <Text style={styles.section}>I am their</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Relationship">
        {(['parent', 'legal_guardian'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityLabel={value === 'parent' ? 'Parent' : 'Legal guardian'}
            accessibilityState={{ selected: relationship === value }}
            haptic="selection"
            onPress={() => setRelationship(value)}
            style={[styles.choice, relationship === value && styles.choiceOn]}
          >
            <Text style={[styles.choiceLabel, relationship === value && styles.choiceLabelOn]}>{value === 'parent' ? 'Parent' : 'Legal guardian'}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        accessibilityLabel="Your full name (signature)"
        autoCapitalize="words"
        editable={!busy}
        placeholder="Type your full name to sign"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        value={name}
        onChangeText={setName}
      />
      <LegalAckToggle checked={confirmed} onCheckedChange={setConfirmed} disabled={busy} label="I have read this form, and the details I gave are true." />
      <AnimatedButton
        accessibilityLabel="Sign the consent"
        disabled={!ready}
        haptic="medium"
        onPress={() => onSign({ signerName: name.trim(), relationship, allowsDonations: donations, allowsPublicProfile: publicProfile })}
        contentStyle={[styles.sign, !ready && styles.off]}
      >
        <Text style={styles.signLabel}>{busy ? 'Signing…' : 'Sign'}</Text>
      </AnimatedButton>
      {onCancel ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" haptic="selection" onPress={onCancel} style={styles.cancel}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  draft: { padding: 10, borderRadius: 12, borderWidth: 1, borderColor: FOCAL.goldInk, fontSize: 12, fontWeight: '700', color: colors.text },
  clause: { gap: 2 },
  clauseTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  section: { marginTop: 6, fontSize: 14, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', gap: 8 },
  choice: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  choiceOn: { backgroundColor: FOCAL.violetInk, borderColor: FOCAL.violetInk },
  choiceLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  choiceLabelOn: { color: colors.onAccent },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, fontSize: 16, color: colors.text },
  sign: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: FOCAL.violetInk },
  off: { opacity: 0.5 },
  signLabel: { fontSize: 15, fontWeight: '800', color: colors.onAccent },
  cancel: { alignItems: 'center', paddingVertical: 8 },
  cancelLabel: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
});
