/** UX-13 readable controls preserve all consent, money and operator actions. Guardian record setup and per-athlete Stripe test-bank setup remain separate from live payouts. */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useCustodial } from '@/hooks/useCustodial';
import { useAuth } from '@/context/AuthContext';
import { PayoutSetupCard } from '@/components/Profile/PayoutSetupCard';
import {
  formatHandoverDate,
  parseBirthDateInput,
  parseDollarInput,
  pendingRequests,
  receivedLines,
} from '@/lib/custodial';
import { formatTipDollars } from '@/lib/reels';

import { WithdrawalHistory } from './WithdrawalHistory';
import { TYPE, figtree } from '@/theme/fonts';

/**
 * @purpose A guardian's custodial account for one linked athlete (owner rules 2026-09-29): enter
 * the birth date once, say whether the bank account is in the athlete's name (encouraged), ask
 * the athlete to approve a withdrawal, and see the handover date after which only the athlete
 * can move the money.
 * @param playerId A `players.id` whose `guardian_id` is this guardian. Loading, missing SQL, errors and
 * permission loss stay visible; admins inspect records without guardian actions.
 * @remarks Recording a request moves no money — payouts stay 503 until the Phase 1a ledger and
 * Connect destination charges ship (ROADMAP Wave 1).
 * @sideEffects `useCustodial` RPCs.
 */
export function GuardianCustodialCard({ playerId }: { playerId: string }) {
  const custodial = useCustodial(playerId);
  const { user, session, profile, isSessionCurrent } = useAuth();
  const { summary } = custodial;
  const owner = user?.id && user.id === session?.user.id && profile?.user_id === user.id ? user.id : null;
  const key = `${owner || 'guest'}:${playerId}`;
  const scope = useRef({ key, sessionGuard: isSessionCurrent, epoch: 0, mounted: true });
  const flight = useRef<object | null>(null);
  if (scope.current.key !== key || scope.current.sessionGuard !== isSessionCurrent) { scope.current = { ...scope.current, key, sessionGuard: isSessionCurrent, epoch: scope.current.epoch + 1 }; flight.current = null; }
  const epoch = scope.current.epoch;
  const current = () => !!owner && scope.current.mounted && scope.current.key === key && scope.current.epoch === epoch && (isSessionCurrent?.() ?? true);
  useEffect(() => { scope.current.mounted = true; return () => { scope.current.mounted = false; }; }, []);
  const [draft, setDraft] = useState({ key, epoch, birthInput: '', amountInput: '', note: '', bankChoice: null as boolean | null, reviewBirth: null as string | null });
  const inputs = draft.key === key && draft.epoch === epoch ? draft : { key, epoch, birthInput: '', amountInput: '', note: '', bankChoice: null, reviewBirth: null };
  const updateDraft = (patch: Partial<typeof draft>) => { if (current()) setDraft({ ...inputs, ...patch, key, epoch }); };
  const { birthInput, amountInput, note, bankChoice, reviewBirth } = inputs;
  const [pendingOperation, setPending] = useState<{ key: string; epoch: number } | null>(null);
  const [notice, setNotice] = useState<{ key: string; epoch: number; text: string } | null>(null);
  const busy = custodial.busy || pendingOperation?.key === key && pendingOperation.epoch === epoch;
  const act = async (work: () => Promise<void>, success?: () => void) => {
    if (!current() || busy || flight.current) return;
    const operation = {}; flight.current = operation; setPending({ key, epoch }); setNotice(null);
    try { await work(); if (current() && flight.current === operation) success?.(); }
    catch { if (current() && flight.current === operation) setNotice({ key, epoch, text: 'This test account action could not be confirmed. Refresh and try again.' }); }
    finally { if (flight.current === operation) { flight.current = null; if (current()) setPending(null); } }
  };
  // Before a birth date is on file the server rejects a bank-only save, so hold the answer here.

  if (custodial.loading) return <View style={styles.card}><Text style={styles.body}>Loading custodial account…</Text></View>;
  if (!custodial.available) return <View style={styles.card}><Text style={styles.body}>Custodial account setup is not available on this server yet.</Text></View>;
  if (custodial.error) return <View style={styles.card}><Text style={styles.body} accessibilityRole="alert">{custodial.error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry account" onPress={() => void custodial.refresh()} style={styles.chip}><Text style={styles.chipLabel}>Retry account</Text></Pressable></View>;
  if (!current() || !summary || summary.playerId !== playerId || summary.viewerRole === 'athlete') return <View style={styles.card}><Text style={styles.body}>This custodial account is not available to this signed-in guardian.</Text></View>;

  const pending = pendingRequests(summary);
  const name = summary.athleteName;
  const actionNotice = notice?.key === key && notice.epoch === epoch ? notice.text : null;
  const testNotice = <Text style={styles.hint}>TEST ONLY — use synthetic account information. Record actions move no real money; payouts remain disabled.</Text>;

  if (summary.viewerRole === 'admin') return <View style={styles.card}><Text style={styles.title}>{name} · read-only inspection</Text>{testNotice}<Text style={styles.body}>Guardian record {summary.hasAccount ? 'created' : 'not created'}. This view cannot connect a bank or act as the guardian.</Text><WithdrawalHistory requests={summary.requests} /></View>;

  const saveSetup = () => {
    if (!current() || busy) return;
    const birthDate = parseBirthDateInput(birthInput);
    if (!birthDate) {
      setNotice({ key, epoch, text: 'Check the date. Use YYYY-MM-DD or MM/DD/YYYY.' });
      return;
    }
    updateDraft({ reviewBirth: birthDate });
  };

  const setBank = (inAthleteName: boolean) => {
    void act(() => custodial.setup(null, inAthleteName));
  };

  const sendRequest = () => {
    if (!current() || busy) return;
    const amountCents = parseDollarInput(amountInput);
    if (!amountCents) {
      setNotice({ key, epoch, text: 'Enter an amount for the test withdrawal request.' });
      return;
    }
    void act(() => custodial.request(amountCents, note), () => {
      updateDraft({ amountInput: '', note: '' });
      setNotice({ key, epoch, text: 'Test request recorded. No real money moves.' });
    });
  };

  if (summary.athleteControls) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{name}</Text>
        {testNotice}
        <Text style={styles.body}>
          {name} is {summary.handoverAge}+ and now manages their own money. Only they can withdraw it.
        </Text>
        <WithdrawalHistory requests={summary.requests} />
      </View>
    );
  }

  if (!summary.handoverDate) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Set up {name}'s account</Text>
        {testNotice}
        <Text style={styles.body}>
          You look after the gifts {name} receives until they turn {summary.handoverAge}. They see every
          gift, and nothing is withdrawn without their OK.
        </Text>
        <Text style={styles.label}>{name}'s date of birth</Text>
        <TextInput
          value={birthInput}
          onChangeText={(birthInput) => updateDraft({ birthInput, reviewBirth: null })}
          editable={!busy}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          style={styles.input}
          accessibilityLabel={`${name}'s date of birth`}
        />
        <BankQuestion
          value={bankChoice ?? summary.bankInAthleteName}
          disabled={busy}
          onChange={(bankChoice) => updateDraft({ bankChoice, reviewBirth: null })}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={saveSetup}
          style={[styles.primary, busy && styles.dim]}
        >
          <Text style={styles.primaryLabel}>Save</Text>
        </Pressable>
        {reviewBirth ? <View style={styles.form}>
          <Text style={styles.body}>Confirm {reviewBirth}. This sets the handover date. Only Tapua'i support can correct it later.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Confirm custodial record" disabled={busy} onPress={() => void act(() => custodial.setup(reviewBirth, bankChoice ?? summary.bankInAthleteName), () => updateDraft({ reviewBirth: null }))} style={styles.primary}><Text style={styles.primaryLabel}>Confirm test record</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => updateDraft({ reviewBirth: null })} style={styles.chip}><Text style={styles.chipLabel}>Back</Text></Pressable>
        </View> : null}
        {actionNotice ? <Text style={styles.body} accessibilityRole="alert">{actionNotice}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{name}</Text>
      {testNotice}
      <Text style={styles.total}>{receivedLines(summary.receivedCents, summary.familyCents, formatTipDollars).headline}</Text>
      <Text style={styles.body}>{receivedLines(summary.receivedCents, summary.familyCents, formatTipDollars).detail}</Text>
      <Text style={styles.body}>
        You hold this for {name} until {formatHandoverDate(summary.handoverDate)}. After that it is
        theirs to move.
      </Text>
      <Text style={styles.hint}>The bank-name answer records your intention; it does not link or verify a bank.</Text>
      <BankQuestion value={summary.bankInAthleteName} disabled={busy} onChange={setBank} />
      {summary.hasAccount && summary.guardianLinked ? <PayoutSetupCard playerId={playerId} athleteName={name} disabled={busy} /> : null}
      {actionNotice ? <Text style={styles.body} accessibilityRole="alert">{actionNotice}</Text> : null}

      {pending.map((request) => (
        <View key={request.id} style={styles.pending}>
          <Text style={styles.label}>
            {formatTipDollars(request.amountCents)} — waiting on {name}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() =>
              void act(() => custodial.cancel(request.id))
            }
            style={[styles.chip, busy && styles.dim]}
          >
            <Text style={styles.chipLabel}>Cancel request</Text>
          </Pressable>
        </View>
      ))}

      {pending.length === 0 ? (
        <View style={styles.form}>
          <Text style={styles.label}>Ask {name} to approve a withdrawal</Text>
          <TextInput
            value={amountInput}
            onChangeText={(amountInput) => updateDraft({ amountInput })}
            editable={!busy}
            placeholder="$ amount"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={styles.input}
            accessibilityLabel="Withdrawal amount"
          />
          <TextInput
            value={note}
            onChangeText={(note) => updateDraft({ note })}
            editable={!busy}
            placeholder="What it's for (club fee, cleats…)"
            placeholderTextColor={colors.textMuted}
            maxLength={280}
            style={styles.input}
            accessibilityLabel="What the withdrawal is for"
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={sendRequest}
            style={[styles.primary, busy && styles.dim]}
          >
            <Text style={styles.primaryLabel}>Send to {name}</Text>
          </Pressable>
        </View>
      ) : null}

      <WithdrawalHistory requests={summary.requests} />
    </View>
  );
}

function BankQuestion({
  value,
  disabled,
  onChange,
}: {
  value: boolean | null;
  disabled: boolean;
  onChange: (inAthleteName: boolean) => void;
}) {
  return (
    <View style={styles.form}>
      <Text style={styles.label}>Is the payout bank account in the athlete's name?</Text>
      <Text style={styles.hint}>
        Strongly encouraged — a custodial or youth account in their name keeps the money clearly theirs.
      </Text>
      <View style={styles.row}>
        {([true, false] as const).map((option) => (
          <Pressable
            key={String(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === option }}
            disabled={disabled}
            onPress={() => onChange(option)}
            style={[styles.chip, value === option && styles.chipOn, disabled && styles.dim]}
          >
            <Text style={[styles.chipLabel, value === option && styles.chipLabelOn]}>
              {option ? 'Yes' : 'Not yet'}
            </Text>
          </Pressable>
        ))}
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
    gap: 10,
  },
  title: {
    color: colors.text,
    ...TYPE.section,
    ...figtree('800'),
  },
  total: {
    color: colors.text,
    ...TYPE.title,
    ...figtree('800'),
  },
  body: { ...figtree('400'),
    color: colors.textMuted,
    ...TYPE.body,

  },
  label: {
    color: colors.text,
    ...TYPE.body,
    ...figtree('700'),
  },
  hint: { ...figtree('400'),
    color: colors.textMuted,
    ...TYPE.body,

  },
  form: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  input: { ...figtree('400'),
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    ...TYPE.section,
    paddingHorizontal: 12,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: colors.deepGreen,
    borderColor: colors.deepGreen,
  },
  chipLabel: {
    color: colors.text,
    ...figtree('700'),
  },
  chipLabelOn: {
    color: colors.onAccent,
  },
  primary: {
    minHeight: 44,
    backgroundColor: colors.deepGreen,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryLabel: {
    color: colors.onAccent,
    ...figtree('800'),
    ...TYPE.section,
  },
  dim: {
    opacity: 0.5,
  },
});
