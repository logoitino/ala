/**
 * Short personal-gift pages shared by the fan popup and inline athlete cards.
 * Amount selection never pays: givers review the exact allocation before the deliberate final action.
 * The Amount page opens with the small owner-approved brand line (TAGLINE_HEADLINE); later pages stay plain.
 * @sideEffects Stripe checkout through useTipCheckout. Optional tips and Stripe coverage require the literal-true flag.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { FeeCheckbox } from '@/components/FeeCheckbox';
import { TipButton } from '@/components/TipButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { MenuStepIndicator } from '@/components/UI/MenuChrome';
import { colors, KIT, MENU_METRICS, radii, SCOREBOARD_DIGITS } from '@/constants/theme';
import { COMPLIANCE_PAYMENT, GIFT_RECORD_NOTICE } from '@/data/legal';
import { PLATFORM_TIP_HINT, PLATFORM_TIP_PERCENTS, PLATFORM_TIP_TITLE, TAGLINE_HEADLINE, donationBreakdownLine, donationSplitLine, donationWhereItGoes, platformTipCentsFor, platformTipChipLabel } from '@/data/malo';
import { AURA_PER_DOLLAR, MALO_DISCLAIMER, auraPointsForTip, displayValue, type Player } from '@/data/players';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useTipCheckout } from '@/hooks/useTipCheckout';
import { useScreenMountTime } from '@/hooks/useScreenMountTime';
import type { TipEntry, TipOrigin } from '@/lib/finance';

type TipCheckoutProps = {
  player: Player; compact?: boolean; hideHeader?: boolean;
  /** Popup bodies flex within the constrained sheet; inline cards retain their own bounded height. */
  embedded?: boolean;
  reelId?: string; origin?: TipOrigin; entry?: TipEntry; wishlistItemId?: string; rallyId?: string;
  sourceLabel?: string; onBacked?: (nextCount: number) => void; onTipped?: (amountCents: number) => void;
  onBusyChange?: (busy: boolean) => void;
  /** The host blocks stale presses as soon as its closing animation starts. */
  canInteract?: () => boolean;
};

function parseCustomTip(value: string): number | null {
  // Reject malformed currency rather than silently converting letters, signs or multiple decimal points.
  if (!/^\d+(?:\.\d{0,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 1 && amount <= 1000 ? Math.round(amount * 100) / 100 : null;
}

/** Captured review/charge values keep a published configuration change from silently altering payment. */
type GiftAllocation = { playerId: string; tipAmount: number; coverFees: boolean; platformTipPercent: number; feeCents: number; totalCents: number };
function sameAllocation(a: GiftAllocation | null, b: GiftAllocation | null): boolean {
  return a != null && b != null && a.playerId === b.playerId && a.tipAmount === b.tipAmount &&
    a.coverFees === b.coverFees && a.platformTipPercent === b.platformTipPercent && a.feeCents === b.feeCents && a.totalCents === b.totalCents;
}

/**
 * @purpose Amount → Options → Review inside one gift surface, with navigation outside the scroll.
 * @sideEffects Opens Stripe only on final Give; synchronous guards preserve the reviewed amount and prevent repeat charges.
 */
export function TipCheckout({ player, compact = false, hideHeader = false, embedded = false, reelId, origin, entry, wishlistItemId, rallyId, sourceLabel, onBacked, onTipped, onBusyChange, canInteract }: TipCheckoutProps) {
  useScreenMountTime('donate-sheet');
  const [step, setStep] = useState(1);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [coverFees, setCoverFees] = useState(false);
  const [tipPercent, setTipPercent] = useState(0);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [paid, setPaid] = useState(false);
  const [notice, setNotice] = useState('');
  const [paymentSnapshot, setPaymentSnapshot] = useState<GiftAllocation | null>(null);
  const reviewRef = useRef<GiftAllocation | null>(null);
  const paidRef = useRef(false);
  const paymentRef = useRef(false);
  const mountedRef = useRef(true);
  const recipientRef = useRef({ id: player.id, generation: 0 });
  if (recipientRef.current.id !== player.id) {
    recipientRef.current = { id: player.id, generation: recipientRef.current.generation + 1 };
  }
  const busyCallbackRef = useRef(onBusyChange);
  busyCallbackRef.current = onBusyChange;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const { startCheckout, busy } = useTipCheckout();
  const { live } = useAppRuntime();
  const { height } = useWindowDimensions();
  const locked = busy || submitting;
  const enabled = live.buttons?.MONETIZATION_TIPS_ENABLED === true;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const stepRef = useRef(step);
  stepRef.current = step;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  // Keep the existing SQL gift cap (100000 cents) and never offer an invalid published preset.
  const presets = live.catalog.maloAmounts.filter((value) => Number.isFinite(value) && value >= 1 && value <= 1000 && Math.round(value * 100) / 100 === value);
  const tipAmounts = presets.length ? presets : [5, 10, 25];
  const playerName = displayValue(player.name, 'this athlete');
  const customAmount = useMemo(() => parseCustomTip(customValue), [customValue]);
  const draftAmount = customOpen ? customAmount : selectedAmount;
  const draftCoverFees = enabled && coverFees;
  const draftTipPercent = enabled ? tipPercent : 0;
  const draftFeeCents = draftCoverFees ? Math.round(live.catalog.maloFeeDollars * 100) : 0;
  const allocation: GiftAllocation | null = draftAmount == null ? null : {
    playerId: player.id, tipAmount: draftAmount, coverFees: draftCoverFees, platformTipPercent: draftTipPercent,
    feeCents: draftFeeCents, totalCents: Math.round(draftAmount * 100) + draftFeeCents + platformTipCentsFor(draftAmount, draftTipPercent),
  };
  const allocationRef = useRef(allocation);
  allocationRef.current = allocation;
  // The review must keep the issued allocation while Stripe or paid-ledger recording is in flight.
  const displayed = (paymentRef.current || paidRef.current) && paymentSnapshot ? paymentSnapshot : allocation;
  const amount = displayed?.tipAmount ?? null;
  const fee = (displayed?.feeCents ?? 0) / 100;
  const total = (displayed?.totalCents ?? 0) / 100;
  const breakdown = amount == null ? '' : donationBreakdownLine({ athleteName: playerName, donationDollars: amount, feeDollars: fee, tipPercent: displayed?.platformTipPercent ?? 0 });
  const staleExtras = !enabled && (coverFees || tipPercent !== 0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    // Changing the target must never carry another family's amount or optional extras across.
    setStep(1); setSelectedAmount(null); setCoverFees(false); setTipPercent(0);
    setCustomOpen(false); setCustomValue(''); setComplete(false); setPaid(false); paidRef.current = false;
    setNotice(''); setPaymentSnapshot(null); reviewRef.current = null;
  }, [player.id]);
  useEffect(() => {
    if (paymentRef.current || paidRef.current || locked) return;
    if (!enabled && (coverFees || tipPercent !== 0)) {
      // Uncharged extras disappear on OFF; returning to Options requires the new total to be reviewed.
      setCoverFees(false); setTipPercent(0); reviewRef.current = null; setStep(2);
      setNotice('Optional extras are now off. Review your gift total again before giving.');
    } else if (step === 3 && reviewRef.current && !sameAllocation(reviewRef.current, allocationRef.current)) {
      reviewRef.current = null; setStep(2);
      setNotice('Your gift total changed. Review it again before giving.');
    }
  }, [enabled, coverFees, tipPercent, locked, step, draftAmount, draftFeeCents]);
  useEffect(() => { busyCallbackRef.current?.(locked); }, [locked]);
  useEffect(() => () => { busyCallbackRef.current?.(false); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [step, complete]);

  const navigate = (next: number) => {
    if (paymentRef.current || paidRef.current || locked || canInteract?.() === false) return;
    if (next === 3) reviewRef.current = allocationRef.current ? { ...allocationRef.current } : null;
    Keyboard.dismiss(); setStep(next);
  };
  const pay = async () => {
    if (paymentRef.current || paidRef.current || lockedRef.current || canInteract?.() === false || stepRef.current !== 3 || complete) return;
    const reviewed = reviewRef.current;
    const current = allocationRef.current;
    if (!current || current.playerId !== player.id || current.tipAmount < 1 || current.tipAmount > 1000) return;
    if ((!enabledRef.current && (coverFees || tipPercent !== 0)) || !sameAllocation(reviewed, current)) {
      reviewRef.current = null; setStep(2); setNotice('Your gift total changed. Review it again before giving.'); return;
    }
    paymentRef.current = true; setSubmitting(true); busyCallbackRef.current?.(true); Keyboard.dismiss();
    setPaymentSnapshot({ ...current });
    const generation = recipientRef.current.generation;
    const isCurrentRecipient = () => mountedRef.current && recipientRef.current.generation === generation;
    try {
      await startCheckout({ player, tipAmount: current.tipAmount, coverFees: current.coverFees, reelId, origin, entry, wishlistItemId, rallyId, sourceLabel, platformTipPercent: current.platformTipPercent,
        reviewedTotalCents: current.totalCents, reviewedFeeCents: current.feeCents,
        // Once Stripe succeeds, failures in recording/counters must never offer another charge.
        onPaid: () => { if (isCurrentRecipient()) { paidRef.current = true; setPaid(true); } },
        onBacked: (count) => { if (isCurrentRecipient()) { setComplete(true); onBacked?.(count); } },
        onTipped: (cents) => { if (isCurrentRecipient()) onTipped?.(cents); } });
    } finally {
      paymentRef.current = false;
      if (mountedRef.current) { if (!paidRef.current) setPaymentSnapshot(null); setSubmitting(false); busyCallbackRef.current?.(false); }
    }
  };

  return (
    <View style={[styles.section, compact && styles.compact, embedded ? styles.embedded : { maxHeight: Math.max(320, Math.min(590, height - 100)) }]}>
      {!compact && !hideHeader ? <Text style={styles.title}>Send a gift to {playerName}</Text> : null}
      {!complete && !paid ? <MenuStepIndicator labels={['Amount', 'Options', 'Review']} current={step} /> : null}
      <ScrollView ref={scrollRef} style={[styles.body, embedded && styles.embeddedBody]} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
        {notice && !complete && !paid ? <Text accessibilityRole="alert" style={styles.disclaimer}>{notice}</Text> : null}
        {complete ? <View style={styles.hero}><Text style={styles.kicker}>MĀLO! ✨</Text><Text style={styles.title}>Thanks for showing up</Text><Text style={styles.copy}>Your gift to {playerName} is recorded.</Text></View> : null}
        {paid && !complete ? <View style={styles.hero}><Text style={styles.title}>Payment received</Text><Text style={styles.copy}>{locked ? 'Finishing your gift record…' : 'Your payment went through. Contact support to check your gift before paying again.'}</Text><Text style={styles.breakdown}>{breakdown}</Text></View> : null}
        {!complete && !paid && step === 1 ? <>
          {/* Brand line (BRAND-01) sits above the Amount page only; Options and Review stay plain financial copy. */}
          <Text style={styles.tagline}>{TAGLINE_HEADLINE}</Text>
          <View style={styles.hero}><Text style={styles.kicker}>COMMUNITY LOVE 💚</Text><Text style={styles.pageTitle}>Choose your gift</Text><Text style={styles.split}>{donationSplitLine(playerName)}</Text><Text style={styles.copy}>For {playerName}'s sports costs — fees, gear and travel.</Text></View>
          <View style={styles.tipRow}>{tipAmounts.map((value) => <TipButton key={value} amount={value} label={`$${value}`} disabled={locked} selected={!customOpen && selectedAmount === value} onPress={() => { setCustomOpen(false); setSelectedAmount(value); }} />)}<TipButton label="Custom" sublabel="Your amount" disabled={locked} selected={customOpen} onPress={() => setCustomOpen(true)} /></View>
          {customOpen ? <View style={styles.customBlock}><TextInput accessibilityLabel="Custom gift amount" editable={!locked} keyboardType="decimal-pad" onChangeText={setCustomValue} placeholder="$1.00–$1,000.00" placeholderTextColor={colors.textMuted} returnKeyType="done" style={styles.input} value={customValue} /><Text style={styles.copy}>{customAmount == null ? 'Enter $1–$1,000, with up to two decimal places.' : `+${auraPointsForTip(customAmount)} Aura Points ⚡`}</Text></View> : null}
          <Text style={styles.auraHint}>You and {playerName} each earn {AURA_PER_DOLLAR} Aura Points per $1 ⚡</Text>
          <Text style={styles.disclaimer}>Selecting an amount does not charge you.</Text>
        </> : null}
        {!complete && !paid && step === 2 ? <>
          <View style={styles.hero}><Text style={styles.kicker}>YOUR CHOICE ✨</Text><Text style={styles.pageTitle}>{enabled ? 'Optional extras' : 'Your gift'}</Text><Text style={styles.copy}>Your gift is ${amount?.toFixed(2)}.{enabled ? ' You can keep both extras off and continue.' : ' Continue to review before giving.'}</Text></View>
          {enabled ? <>
            <View style={styles.tipBlock}><Text style={styles.tipTitle}>{PLATFORM_TIP_TITLE}</Text><View style={styles.tipChips} accessibilityRole="radiogroup">{PLATFORM_TIP_PERCENTS.map((percent) => <Pressable key={percent} accessibilityRole="radio" accessibilityLabel={percent === 0 ? "No tip for Tapua'i" : `${percent}% tip for Tapua'i`} accessibilityState={{ selected: tipPercent === percent, disabled: locked }} disabled={locked} onPress={() => { if (enabledRef.current && !paymentRef.current && !paidRef.current) setTipPercent(percent); }} style={[styles.tipChip, tipPercent === percent && styles.tipChipOn]}><Text style={[styles.tipChipText, tipPercent === percent && styles.tipChipTextOn]}>{platformTipChipLabel(percent)}</Text></Pressable>)}</View><Text style={styles.disclaimer}>{PLATFORM_TIP_HINT}</Text></View>
            <FeeCheckbox playerName={playerName} checked={coverFees} disabled={locked} onChange={setCoverFees} />
            <Text style={styles.disclaimer}>{MALO_DISCLAIMER}</Text>
          </> : null}
          <Text style={styles.breakdown}>{breakdown}</Text>
        </> : null}
        {!complete && !paid && step === 3 ? <>
          <View style={styles.hero}><Text style={styles.kicker}>READY TO REVIEW 💚</Text><Text style={styles.pageTitle}>Your gift to {playerName}</Text><Text style={styles.total}>${total.toFixed(2)}</Text><Text style={styles.copy}>Total you pay</Text><Text style={styles.breakdown}>{breakdown}</Text></View>
          <Text style={styles.disclaimer}>{donationWhereItGoes(playerName)}</Text>
          <Text style={styles.disclaimer}>{MALO_DISCLAIMER}</Text>
          <View style={styles.testNotice}><Text style={styles.disclaimer}>{COMPLIANCE_PAYMENT}</Text></View>
          <Text style={styles.disclaimer}>{GIFT_RECORD_NOTICE}</Text>
        </> : null}
      </ScrollView>
      {!complete && !paid ? <View style={styles.footer}>
        {step > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Back" accessibilityState={{ disabled: locked }} disabled={locked} onPress={() => navigate(step - 1)} style={[styles.back, locked && styles.disabled]}><Text style={styles.backText}>Back</Text></Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={step === 3 ? `Send a gift · Pay $${total.toFixed(2)}` : 'Next'} accessibilityState={{ disabled: locked || amount == null || staleExtras }} disabled={locked || amount == null || staleExtras} onPress={() => { if (step === 3) void pay(); else navigate(step + 1); }} style={[styles.next, (locked || amount == null || staleExtras) && styles.disabled]}>{locked ? <ActivityIndicator color={colors.onAccent} /> : null}<Text style={styles.nextText}>{locked ? 'Opening payment…' : step === 3 ? `Send a gift · Pay $${total.toFixed(2)}` : 'Next →'}</Text></Pressable>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, flexShrink: 1 }, compact: { marginTop: 4 }, embedded: { flex: 1, minHeight: 0 },
  body: { flexShrink: 1 }, embeddedBody: { flex: 1, minHeight: 0 }, bodyContent: { gap: 14, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  hero: { gap: 6, backgroundColor: colors.background, borderRadius: MENU_METRICS.cardRadius, padding: 16 },
  tagline: { fontSize: 12, lineHeight: 17, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
  kicker: { fontSize: 11, letterSpacing: 1.1, fontWeight: '800', color: colors.deepGreen },
  pageTitle: { fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.6 },
  split: { fontSize: 13, lineHeight: 19, fontWeight: '800', color: colors.text },
  copy: { fontSize: 13, lineHeight: 19, color: colors.textMuted, fontWeight: '600' },
  auraHint: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: colors.primary },
  total: { ...SCOREBOARD_DIGITS, fontSize: 44, color: colors.text },
  tipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, customBlock: { gap: 8 },
  input: { minHeight: 48, borderRadius: MENU_METRICS.controlRadius, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface, color: colors.text, fontSize: 20, fontWeight: '800', paddingHorizontal: 14 },
  tipBlock: { gap: 10, padding: 14, backgroundColor: colors.background, borderRadius: MENU_METRICS.cardRadius, borderWidth: 1, borderColor: colors.border },
  tipTitle: { fontSize: 14, fontWeight: '800', color: colors.text }, tipChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tipChip: { flexGrow: 1, minWidth: 60, minHeight: 44, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  tipChipOn: { borderColor: colors.text, backgroundColor: colors.text }, tipChipText: { fontSize: 14, fontWeight: '700', color: colors.text }, tipChipTextOn: { color: colors.background },
  breakdown: { fontSize: 13, lineHeight: 19, fontWeight: '700', color: colors.text }, disclaimer: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.textMuted },
  testNotice: { backgroundColor: KIT.warnSoft, padding: 12, borderRadius: MENU_METRICS.controlRadius },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, borderTopWidth: 1, borderColor: colors.border },
  back: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 18, borderRadius: KIT.controlRadius, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, backText: { fontSize: 15, fontWeight: '800', color: colors.text },
  next: { flex: 1, minHeight: 52, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: KIT.controlRadius, backgroundColor: colors.primary, paddingHorizontal: 14, ...KIT.shadowSoft }, nextText: { color: colors.onAccent, fontSize: 16, fontWeight: '800' }, disabled: { opacity: 0.45 },
});
