/** UX-13 consent clauses remain full/readable;44pt choices and Cancel preserve sign-flight/account locks. */
/**
 * The guardian consent form (MINOR-01): the versioned clauses from `data/guardianConsent.ts`, one tick box per
 * permission, parent / legal guardian, and the typed full name that is the signature. The draft version carries a
 * "testing only" banner (counsel writes the final text, LEGAL row AA). Payouts can only be allowed by the guardian on
 * record for the athlete's family account; everyone else sees why.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useOptionalAuth } from '@/context/AuthContext';
import { LegalAckToggle } from '@/components/Legal/LegalModal';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors } from '@/constants/theme';
import { GUARDIAN_CONSENT_CLAUSES, GUARDIAN_CONSENT_IS_DRAFT, GUARDIAN_CONSENT_VERSION, fillConsentClause } from '@/data/guardianConsent';
import type { ConsentInput } from '@/lib/minors';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

type Props = {
  teenFirstName: string;
  /** Stable target identity, including an invitation code when linking. */
  identityKey?: string;
  canAllowDonations: boolean;
  initial?: Partial<ConsentInput>;
  busy?: boolean;
  onSign: (consent: ConsentInput) => void | Promise<unknown>;
  onCancel?: () => void;
};

/** @purpose Read, choose permissions and sign. */
export function GuardianConsentForm(props: Props) {
  const auth = useOptionalAuth();
  const target = props.identityKey ?? props.teenFirstName;
  const lifetime = useRef({ owner: auth?.user?.id, guard: auth?.isSessionCurrent, target, epoch: 0 });
  if (lifetime.current.owner !== auth?.user?.id || lifetime.current.guard !== auth?.isSessionCurrent || lifetime.current.target !== target) lifetime.current = { owner: auth?.user?.id, guard: auth?.isSessionCurrent, target, epoch: lifetime.current.epoch + 1 };
  const scope = lifetime.current;
  return <ConsentBody key={scope.epoch} {...props} isCurrent={() => lifetime.current === scope && (scope.guard?.() ?? true)} />;
}

function ConsentBody({ teenFirstName, canAllowDonations, initial, busy, onSign, onCancel, isCurrent }: Props & { isCurrent: () => boolean }) {
  const mounted = useRef(true);
  const flight = useRef(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && isCurrent();
  const locked = Boolean(busy || signing || !isCurrent());
  const [publicProfile, setPublicProfile] = useState(initial?.allowsPublicProfile ?? false);
  const [donations, setDonations] = useState(canAllowDonations && (initial?.allowsDonations ?? false));
  const [relationship, setRelationship] = useState<ConsentInput['relationship']>(initial?.relationship ?? 'parent');
  const [name, setName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const ready = name.trim().length >= 2 && confirmed && !locked;
  const submit = async () => {
    if (flight.current || busy || !current() || name.trim().length < 2 || !confirmed) return;
    flight.current = true; setSigning(true); setError(null);
    try { await onSign({ signerName: name.trim(), relationship, allowsDonations: canAllowDonations && donations, allowsPublicProfile: publicProfile }); }
    catch (caught) { if (current()) setError(caught instanceof Error ? caught.message : 'Could not sign this consent. Try again.'); }
    finally { flight.current = false; if (current()) setSigning(false); }
  };
  const edit = (work: () => void) => { if (!flight.current && !busy && current()) work(); };

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
      <LegalAckToggle checked={publicProfile} onCheckedChange={value => edit(() => setPublicProfile(value))} disabled={locked} label={`${teenFirstName} may have a public profile`} />
      {canAllowDonations ? (
        <LegalAckToggle checked={donations} onCheckedChange={value => edit(() => setDonations(value))} disabled={locked} label={`Gifts to ${teenFirstName} may be paid out to the family account on record`} />
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
            disabled={locked}
            onPress={() => edit(() => setRelationship(value))}
            style={[styles.choice, relationship === value && styles.choiceOn]}
          >
            <Text style={[styles.choiceLabel, relationship === value && styles.choiceLabelOn]}>{value === 'parent' ? 'Parent' : 'Legal guardian'}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        accessibilityLabel="Your full name (signature)"
        autoCapitalize="words"
        editable={!locked}
        placeholder="Type your full name to sign"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        value={isCurrent() ? name : ''}
        onChangeText={value => edit(() => setName(value))}
      />
      <LegalAckToggle checked={confirmed} onCheckedChange={value => edit(() => setConfirmed(value))} disabled={locked} label="I have read this form, and the details I gave are true." />
      <AnimatedButton
        accessibilityLabel="Sign the consent"
        disabled={!ready}
        haptic="medium"
        onPress={() => void submit()}
        contentStyle={[styles.sign, !ready && styles.off]}
      >
        <Text style={styles.signLabel}>{busy || signing ? 'Signing…' : 'Sign'}</Text>
      </AnimatedButton>
      {isCurrent() && error ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.body}>{error}</Text> : null}
      {onCancel ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" haptic="selection" disabled={locked} onPress={() => edit(() => onCancel())} style={styles.cancel}>
          <Text style={styles.cancelLabel}>Cancel</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  draft: { padding: 10, borderRadius: 12, borderWidth: 1, borderColor: FOCAL.goldInk, ...TYPE.body, ...figtree('700'), color: colors.text },
  clause: { gap: 2 },
  clauseTitle: { ...TYPE.body, ...figtree('800'), color: colors.text },
  body: { ...figtree('400'), ...TYPE.body,  color: colors.textMuted },
  section: { marginTop: 6, ...TYPE.body, ...figtree('800'), color: colors.text },
  row: { flexWrap: 'wrap', flexDirection: 'row', gap: 8 },
  choice: { maxWidth: '100%', minHeight: 44, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  choiceOn: { backgroundColor: colors.text, borderColor: colors.text },
  choiceLabel: { ...TYPE.body, ...figtree('700'), color: colors.text },
  choiceLabelOn: { color: colors.onAccent },
  input: { ...figtree('400'), minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, ...TYPE.section, color: colors.text },
  sign: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  off: { opacity: 0.5 },
  signLabel: { ...TYPE.body, ...figtree('800'), color: colors.onAccent },
  cancel: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
  cancelLabel: { ...TYPE.body, ...figtree('700'), color: colors.textMuted },
});
