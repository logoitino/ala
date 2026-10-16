import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useCustodial } from '@/hooks/useCustodial';
import {
  formatHandoverDate,
  parseBirthDateInput,
  parseDollarInput,
  pendingRequests,
  receivedLines,
} from '@/lib/custodial';
import { formatTipDollars } from '@/lib/reels';

import { WithdrawalHistory } from './WithdrawalHistory';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Try again.';
}

/**
 * @purpose A guardian's custodial account for one linked athlete (owner rules 2026-09-29): enter
 * the birth date once, say whether the bank account is in the athlete's name (encouraged), ask
 * the athlete to approve a withdrawal, and see the handover date after which only the athlete
 * can move the money.
 * @param playerId A `players.id` whose `guardian_id` is this guardian. Renders nothing when the
 * server does not recognise the caller as that athlete's guardian or the SQL is not applied.
 * @remarks Recording a request moves no money — payouts stay 503 until the Phase 1a ledger and
 * Connect destination charges ship (ROADMAP Wave 1).
 * @sideEffects `useCustodial` RPCs.
 */
export function GuardianCustodialCard({ playerId }: { playerId: string }) {
  const custodial = useCustodial(playerId);
  const { summary } = custodial;
  const [birthInput, setBirthInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [note, setNote] = useState('');
  // Before a birth date is on file the server rejects a bank-only save, so hold the answer here.
  const [bankChoice, setBankChoice] = useState<boolean | null>(null);

  if (!custodial.available || !summary || summary.viewerRole === 'athlete') return null;

  const pending = pendingRequests(summary);
  const name = summary.athleteName;

  const saveSetup = () => {
    const birthDate = parseBirthDateInput(birthInput);
    if (!birthDate) {
      Alert.alert('Check the date', 'Use YYYY-MM-DD or MM/DD/YYYY.');
      return;
    }
    Alert.alert(
      `Is ${birthDate} right?`,
      `This sets the day ${name} takes over their own money. Only Tapua'i support can change it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () =>
            void custodial.setup(birthDate, bankChoice ?? summary.bankInAthleteName).catch((error: unknown) => {
              Alert.alert('Couldn’t save', errorText(error));
            }),
        },
      ],
    );
  };

  const setBank = (inAthleteName: boolean) => {
    void custodial.setup(null, inAthleteName).catch((error: unknown) => {
      Alert.alert('Couldn’t save', errorText(error));
    });
  };

  const sendRequest = () => {
    const amountCents = parseDollarInput(amountInput);
    if (!amountCents) {
      Alert.alert('Enter an amount', 'How much do you want to withdraw?');
      return;
    }
    void custodial
      .request(amountCents, note)
      .then(() => {
        setAmountInput('');
        setNote('');
        Alert.alert('Sent to ' + name, `${name} gets a request in Activity. Nothing moves until they approve.`);
      })
      .catch((error: unknown) => Alert.alert('Couldn’t send', errorText(error)));
  };

  if (summary.athleteControls) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{name}</Text>
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
        <Text style={styles.body}>
          You look after the donations {name} receives until they turn {summary.handoverAge}. They see every
          gift, and nothing is withdrawn without their OK.
        </Text>
        <Text style={styles.label}>{name}'s date of birth</Text>
        <TextInput
          value={birthInput}
          onChangeText={setBirthInput}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          style={styles.input}
          accessibilityLabel={`${name}'s date of birth`}
        />
        <BankQuestion
          value={bankChoice ?? summary.bankInAthleteName}
          disabled={custodial.busy}
          onChange={setBankChoice}
        />
        <Pressable
          accessibilityRole="button"
          disabled={custodial.busy}
          onPress={saveSetup}
          style={[styles.primary, custodial.busy && styles.dim]}
        >
          <Text style={styles.primaryLabel}>Save</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.total}>{receivedLines(summary.receivedCents, summary.familyCents, formatTipDollars).headline}</Text>
      <Text style={styles.body}>{receivedLines(summary.receivedCents, summary.familyCents, formatTipDollars).detail}</Text>
      <Text style={styles.body}>
        You hold this for {name} until {formatHandoverDate(summary.handoverDate)}. After that it is
        theirs to move.
      </Text>
      <BankQuestion value={summary.bankInAthleteName} disabled={custodial.busy} onChange={setBank} />

      {pending.map((request) => (
        <View key={request.id} style={styles.pending}>
          <Text style={styles.label}>
            {formatTipDollars(request.amountCents)} — waiting on {name}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={custodial.busy}
            onPress={() =>
              void custodial.cancel(request.id).catch((error: unknown) => {
                Alert.alert('Couldn’t cancel', errorText(error));
              })
            }
            style={[styles.chip, custodial.busy && styles.dim]}
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
            onChangeText={setAmountInput}
            placeholder="$ amount"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={styles.input}
            accessibilityLabel="Withdrawal amount"
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="What it's for (club fee, cleats…)"
            placeholderTextColor={colors.textMuted}
            maxLength={280}
            style={styles.input}
            accessibilityLabel="What the withdrawal is for"
          />
          <Pressable
            accessibilityRole="button"
            disabled={custodial.busy}
            onPress={sendRequest}
            style={[styles.primary, custodial.busy && styles.dim]}
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
    fontSize: 17,
    fontWeight: '800',
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
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  form: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 12,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  chip: {
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
    fontWeight: '700',
  },
  chipLabelOn: {
    color: colors.onAccent,
  },
  primary: {
    backgroundColor: colors.deepGreen,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryLabel: {
    color: colors.onAccent,
    fontWeight: '800',
    fontSize: 16,
  },
  dim: {
    opacity: 0.5,
  },
});
