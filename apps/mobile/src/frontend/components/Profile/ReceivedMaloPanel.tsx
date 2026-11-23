/** UX-13 readable shared type preserves every action and required notice. Private Profile and Parent HQ gift list retains the family-account amounts and preset-only thanks.
 * Compact rows must preserve every gift origin and amount disclosure.
 * @sideEffects Reads received gifts and submits the selected thank-you through existing hooks. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ThanksPicker } from '@/components/Thanks/ThanksPicker';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import { useDonationsToThank } from '@/hooks/useDonationThanks';
import { useReceivedMalo } from '@/hooks/useReceivedMalo';
import { thanksText, type ThanksKey } from '@/lib/donationThanks';
import { tipChannelLabel } from '@/lib/finance';
import { receivedLines } from '@/lib/custodial';
import { TYPE, figtree } from '@/theme/fonts';

/**
 * @purpose Private list (athlete's own profile, and Parent HQ) of each donation received and where it
 *   started, with a one-tap preset "Say thanks" per donor (owner 2026-09-29: athletes are encouraged to
 *   thank donors). Presets only, never free text — many athletes are minors (LEGAL row S).
 * @param playerId This athlete's `players.id`.
 * @sideEffects `useReceivedMalo` → `get_received_malo`; `useDonationsToThank` → `get_donations_to_thank`,
 *   `thank_donation`. Unavailable ledgers offer Retry; outgoing thanks never close or celebrate an incoming picker.
 */
export function ReceivedMaloPanel({ playerId }: { playerId: string }) {
  const { rows, totalCents, familyCents, loading, error, refresh } = useReceivedMalo(playerId);
  const { rows: thanksRows, thank, loading: thanksLoading, error: thanksError, refresh: refreshThanks } = useDonationsToThank(playerId);
  const celebration = useOptionalCelebration();
  const { user, isSessionCurrent } = useAuth();
  const holder = useRef({ userId: user?.id, playerId, guard: isSessionCurrent, active: true, flight: false });
  if (holder.current.userId !== user?.id || holder.current.playerId !== playerId || holder.current.guard !== isSessionCurrent)
    holder.current = { userId: user?.id, playerId, guard: isSessionCurrent, active: true, flight: false };
  const scope = holder.current;
  const current = () => holder.current === scope && scope.active && (scope.guard?.() ?? true);
  useEffect(() => { scope.active = true; return () => { scope.active = false; }; }, [scope]);
  const [picker, setPicker] = useState<{ owner: typeof scope; id: string | null; busy: boolean } | null>(null);
  const picking = picker?.owner === scope && current() ? picker.id : null;
  const busy = picker?.owner === scope && current() ? picker.busy : false;
  const setPicking = (id: string | null) => { if (current() && !scope.flight) setPicker({ owner: scope, id, busy: false }); };
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  // The headline is what reaches the family account, not the donated total (which is more).
  const received = receivedLines(totalCents, familyCents, money);
  const thanksByTip = useMemo(() => new Map(thanksRows.map((row) => [row.tipId, row])), [thanksRows]);
  const toThank = thanksRows.filter((row) => !row.thankedKey).length;

  const sendThanks = async (tipId: string, key: ThanksKey) => {
    if (!current() || scope.flight || thanksLoading || thanksError) return;
    scope.flight = true;
    setPicker({ owner: scope, id: tipId, busy: true });
    try {
      const result = await thank(tipId, key);
      if (!current()) return;
      setPicker({ owner: scope, id: result.ok ? null : tipId, busy: false });
      celebration?.showToast(result.ok ? 'Thank-you sent 🙏' : result.message);
    } catch {
      if (current()) { setPicker({ owner: scope, id: tipId, busy: false }); celebration?.showToast('Could not send the thank-you. Try again.'); }
    } finally { scope.flight = false; }
  };

  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel={`Support received, ${loading ? 'loading' : error ? 'unavailable' : received.headline}`}>
      <Text style={styles.kicker}>Support received</Text>
      <Text style={styles.total}>{loading ? 'Loading gifts…' : error ? 'Gifts unavailable' : received.headline}</Text>
      {!loading && !error && rows.length > 0 ? <Text style={styles.meta}>{received.detail}</Text> : null}
      <Text style={styles.lede}>
        Each gift shows who sent it and where it started: a Highlight, a Rally, a QR link, a gear goal or your profile.
        Saying thanks keeps people cheering you on.
      </Text>
      {!thanksError && !thanksLoading && toThank > 0 ? (
        <Text style={styles.nudge}>
          {toThank} {toThank === 1 ? 'gift sender is' : 'gift senders are'} waiting for a thank-you.
        </Text>
      ) : null}
      {loading ? <ActivityIndicator color={colors.deepGreen} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <Text style={styles.empty}>No gifts yet. They show up here after a fan gives.</Text>
      ) : null}
      {error ? <View><Text style={styles.empty} accessibilityRole="alert">{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry gifts" onPress={() => void refresh()} style={styles.thankButton}><Text style={styles.thankLabel}>Retry</Text></Pressable></View> : null}
      {thanksError ? <View><Text style={styles.empty} accessibilityRole="alert">{thanksError}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry thank-yous" onPress={() => void refreshThanks()} style={styles.thankButton}><Text style={styles.thankLabel}>Retry thank-yous</Text></Pressable></View> : null}
      {(error ? [] : rows).slice(0, 8).map((row) => {
        const thanks = thanksByTip.get(row.id);
        const sent = thanks?.thankedKey ? thanksText(thanks.thankedKey) : null;
        return (
          <View key={row.id} style={styles.item}>
            <View style={styles.row}>
              <View style={styles.identity}>
                <Text style={styles.name}>{row.fan_name}</Text>
                <Text style={styles.meta}>{tipChannelLabel(row.origin, row.entry, row.source_label)}</Text>
              </View>
              <View style={styles.amounts}>
                <Text style={styles.amount}>{money(row.amount_cents)}</Text>
                {row.family_cents != null ? <Text style={styles.meta}>{money(row.family_cents)} for your family account</Text> : null}
              </View>
            </View>
            {thanks && sent ? <Text style={styles.thanked}>Thanked ✓ “{sent}”</Text> : null}
            {!thanksError && !thanksLoading && thanks && !sent && picking !== row.id ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Say thanks to ${row.fan_name}`}
                onPress={() => setPicking(row.id)}
                style={styles.thankButton}
              >
                <Text style={styles.thankLabel}>Say thanks 🙏</Text>
              </Pressable>
            ) : null}
            {!thanksError && !thanksLoading && thanks && !sent && picking === row.id ? (
              <ThanksPicker busy={busy} onPick={(key) => void sendThanks(row.id, key)} onCancel={() => setPicking(null)} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  amounts: {
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  card: {
    gap: 8,
    marginTop: 4,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  kicker: {
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.deepGreen,
  },
  total: {
    ...TYPE.title,
    ...figtree('800'),
    color: colors.text,
  },
  lede: { ...figtree('400'),
    ...TYPE.body,

    color: colors.textMuted,
  },
  empty: { ...figtree('400'),
    ...TYPE.body,
    color: colors.textMuted,
  },
  nudge: {
    ...TYPE.body,
    ...figtree('800'),
    color: colors.deepGreen,
  },
  item: {
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  thanked: {
    ...TYPE.caption,
    ...figtree('700'),
    color: colors.textMuted,
  },
  thankButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.deepGreen,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  thankLabel: {
    ...TYPE.body,
    ...figtree('800'),
    color: colors.deepGreen,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...TYPE.body,
    ...figtree('700'),
    color: colors.text,
  },
  meta: { ...figtree('400'),
    ...TYPE.caption,
    color: colors.textMuted,
  },
  amount: {
    ...TYPE.body,
    ...figtree('800'),
    color: colors.deepGreen,
  },
});
