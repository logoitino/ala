/**
 * Short donation pages shared by the fan popup and inline athlete cards.
 * Amount selection never pays: donors review all disclosures before the deliberate final action.
 * @sideEffects Stripe checkout through useTipCheckout; both optional Tapua'i extras default off (LEGAL R).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { FeeCheckbox } from '@/components/FeeCheckbox';
import { TipButton } from '@/components/TipButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { MenuStepIndicator } from '@/components/UI/MenuChrome';
import { colors, MENU_METRICS, radii } from '@/constants/theme';
import { COMPLIANCE_PAYMENT, GIFT_RECORD_NOTICE } from '@/data/legal';
import { PLATFORM_TIP_HINT, PLATFORM_TIP_PERCENTS, PLATFORM_TIP_TITLE, donationBreakdownLine, donationSplitLine, donationWhereItGoes, platformTipCentsFor, platformTipChipLabel } from '@/data/malo';
import { AURA_PER_DOLLAR, MALO_DISCLAIMER, auraPointsForTip, displayValue, type Player } from '@/data/players';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useTipCheckout } from '@/hooks/useTipCheckout';
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
  return Number.isFinite(amount) && amount >= 1 ? Math.round(amount * 100) / 100 : null;
}

/**
 * @purpose Amount → optional extras → review inside one donation surface, with navigation outside the scroll.
 * @sideEffects Opens Stripe only on final Donate; a synchronous ref prevents duplicate payments and early dismissal.
 */
export function TipCheckout({ player, compact = false, hideHeader = false, embedded = false, reelId, origin, entry, wishlistItemId, rallyId, sourceLabel, onBacked, onTipped, onBusyChange, canInteract }: TipCheckoutProps) {
  const [step, setStep] = useState(1);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [coverFees, setCoverFees] = useState(false);
  const [tipPercent, setTipPercent] = useState(0);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [paid, setPaid] = useState(false);
  const paidRef = useRef(false);
  const paymentRef = useRef(false);
  const mountedRef = useRef(true);
  const recipientRef = useRef({ id: player.id, generation: 0 });
  if (recipientRef.current.id !== player.id) {
    recipientRef.current = { id: player.id, generation: recipientRef.current.generation + 1 };
  }
  const busyCallbackRef = useRef(onBusyChange);
  busyCallbackRef.current = onBusyChange;
  const scrollRef = useRef<ScrollView>(null);
  const { startCheckout, busy } = useTipCheckout();
  const { live } = useAppRuntime();
  const { height } = useWindowDimensions();
  const locked = busy || submitting;
  const tipAmounts = live.catalog.maloAmounts.length ? live.catalog.maloAmounts : [5, 10, 25];
  const playerName = displayValue(player.name, 'this athlete');
  const customAmount = useMemo(() => parseCustomTip(customValue), [customValue]);
  const amount = customOpen ? customAmount : selectedAmount;
  const fee = coverFees ? live.catalog.maloFeeDollars : 0;
  const total = amount == null ? 0 : (Math.round(amount * 100) + Math.round(fee * 100) + platformTipCentsFor(amount, tipPercent)) / 100;
  const breakdown = amount == null ? '' : donationBreakdownLine({ athleteName: playerName, donationDollars: amount, feeDollars: fee, tipPercent });

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    // Changing the target must never carry another family's amount or optional extras across.
    setStep(1); setSelectedAmount(null); setCoverFees(false); setTipPercent(0);
    setCustomOpen(false); setCustomValue(''); setComplete(false); setPaid(false); paidRef.current = false;
  }, [player.id]);
  useEffect(() => { busyCallbackRef.current?.(locked); }, [locked]);
  useEffect(() => () => { busyCallbackRef.current?.(false); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [step, complete]);

  const navigate = (next: number) => {
    if (paymentRef.current || paidRef.current || locked || canInteract?.() === false) return;
    Keyboard.dismiss(); setStep(next);
  };
  const pay = async () => {
    if (paymentRef.current || paidRef.current || locked || canInteract?.() === false || amount == null || step !== 3 || complete) return;
    paymentRef.current = true; setSubmitting(true); busyCallbackRef.current?.(true); Keyboard.dismiss();
    const generation = recipientRef.current.generation;
    const isCurrentRecipient = () => mountedRef.current && recipientRef.current.generation === generation;
    try {
      await startCheckout({ player, tipAmount: amount, coverFees, reelId, origin, entry, wishlistItemId, rallyId, sourceLabel, platformTipPercent: tipPercent,
        // Once Stripe succeeds, failures in recording/counters must never offer another charge.
        onPaid: () => { if (isCurrentRecipient()) { paidRef.current = true; setPaid(true); } },
        onBacked: (count) => { if (isCurrentRecipient()) { setComplete(true); onBacked?.(count); } },
        onTipped: (cents) => { if (isCurrentRecipient()) onTipped?.(cents); } });
    } finally {
      paymentRef.current = false;
      if (mountedRef.current) { setSubmitting(false); busyCallbackRef.current?.(false); }
    }
  };

  return (
    <View style={[styles.section, compact && styles.compact, embedded ? styles.embedded : { maxHeight: Math.max(320, Math.min(590, height - 100)) }]}>
      {!compact && !hideHeader ? <Text style={styles.title}>Donate to {playerName}</Text> : null}
      {!complete && !paid ? <MenuStepIndicator labels={['Amount', 'Options', 'Review']} current={step} /> : null}
      <ScrollView ref={scrollRef} style={[styles.body, embedded && styles.embeddedBody]} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
        {complete ? <View style={styles.hero}><Text style={styles.kicker}>MĀLO! ✨</Text><Text style={styles.title}>Thanks for showing up</Text><Text style={styles.copy}>Your donation to {playerName} is on its way.</Text></View> : null}
        {paid && !complete ? <View style={styles.hero}><Text style={styles.title}>Payment received</Text><Text style={styles.copy}>{locked ? 'Finishing your donation…' : 'Your payment went through. Contact support to check your donation before paying again.'}</Text></View> : null}
        {!complete && !paid && step === 1 ? <>
          <View style={styles.hero}><Text style={styles.kicker}>COMMUNITY LOVE 💚</Text><Text style={styles.pageTitle}>Choose your donation</Text><Text style={styles.split}>{donationSplitLine(playerName)}</Text><Text style={styles.copy}>For {playerName}'s sports costs — fees, gear and travel.</Text></View>
          <View style={styles.tipRow}>{tipAmounts.map((value) => <TipButton key={value} amount={value} label={`$${value}`} disabled={locked} selected={!customOpen && selectedAmount === value} onPress={() => { setCustomOpen(false); setSelectedAmount(value); }} />)}<TipButton label="Custom" sublabel="Your amount" disabled={locked} selected={customOpen} onPress={() => setCustomOpen(true)} /></View>
          {customOpen ? <View style={styles.customBlock}><TextInput accessibilityLabel="Custom donation amount" editable={!locked} keyboardType="decimal-pad" onChangeText={setCustomValue} placeholder="Minimum $1.00" placeholderTextColor={colors.textMuted} returnKeyType="done" style={styles.input} value={customValue} /><Text style={styles.copy}>{customAmount == null ? 'Enter $1 or more, with up to two decimal places.' : `+${auraPointsForTip(customAmount)} Aura Points ⚡`}</Text></View> : null}
          <Text style={styles.auraHint}>You and {playerName} each earn {AURA_PER_DOLLAR} Aura Points per $1 ⚡</Text>
          <Text style={styles.disclaimer}>Selecting an amount does not charge you.</Text>
        </> : null}
        {!complete && !paid && step === 2 ? <>
          <View style={styles.hero}><Text style={styles.kicker}>YOUR CHOICE ✨</Text><Text style={styles.pageTitle}>Optional extras</Text><Text style={styles.copy}>Your donation is ${amount?.toFixed(2)}. You can keep both extras off and continue.</Text></View>
          <View style={styles.tipBlock}><Text style={styles.tipTitle}>{PLATFORM_TIP_TITLE}</Text><View style={styles.tipChips} accessibilityRole="radiogroup">{PLATFORM_TIP_PERCENTS.map((percent) => <Pressable key={percent} accessibilityRole="radio" accessibilityLabel={percent === 0 ? "No tip for Tapua'i" : `${percent}% tip for Tapua'i`} accessibilityState={{ selected: tipPercent === percent, disabled: locked }} disabled={locked} onPress={() => setTipPercent(percent)} style={[styles.tipChip, tipPercent === percent && styles.tipChipOn]}><Text style={[styles.tipChipText, tipPercent === percent && styles.tipChipTextOn]}>{platformTipChipLabel(percent)}</Text></Pressable>)}</View><Text style={styles.disclaimer}>{PLATFORM_TIP_HINT}</Text></View>
          <FeeCheckbox playerName={playerName} checked={coverFees} disabled={locked} onChange={setCoverFees} />
          <Text style={styles.breakdown}>{breakdown}</Text>
        </> : null}
        {!complete && !paid && step === 3 ? <>
          <View style={styles.hero}><Text style={styles.kicker}>READY TO REVIEW 💚</Text><Text style={styles.pageTitle}>Your donation to {playerName}</Text><Text style={styles.total}>${total.toFixed(2)}</Text><Text style={styles.copy}>Total you pay</Text><Text style={styles.breakdown}>{breakdown}</Text></View>
          <Text style={styles.disclaimer}>{donationWhereItGoes(playerName)}</Text>
          <Text style={styles.disclaimer}>{MALO_DISCLAIMER}</Text>
          <View style={styles.testNotice}><Text style={styles.disclaimer}>{COMPLIANCE_PAYMENT}</Text></View>
          <Text style={styles.disclaimer}>{GIFT_RECORD_NOTICE}</Text>
        </> : null}
      </ScrollView>
      {!complete && !paid ? <View style={styles.footer}>
        {step > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Back" accessibilityState={{ disabled: locked }} disabled={locked} onPress={() => navigate(step - 1)} style={[styles.back, locked && styles.disabled]}><Text style={styles.backText}>Back</Text></Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={step === 3 ? `Donate $${total.toFixed(2)}` : 'Next'} accessibilityState={{ disabled: locked || amount == null }} disabled={locked || amount == null} onPress={() => { if (step === 3) void pay(); else navigate(step + 1); }} style={[styles.next, (locked || amount == null) && styles.disabled]}>{locked ? <ActivityIndicator color={colors.onAccent} /> : null}<Text style={styles.nextText}>{locked ? 'Opening payment…' : step === 3 ? `Donate $${total.toFixed(2)}` : 'Next →'}</Text></Pressable>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, flexShrink: 1 }, compact: { marginTop: 4 }, embedded: { flex: 1, minHeight: 0 },
  body: { flexShrink: 1 }, embeddedBody: { flex: 1, minHeight: 0 }, bodyContent: { gap: 14, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  hero: { gap: 7, backgroundColor: colors.accentSoft, borderRadius: MENU_METRICS.cardRadius, padding: 16, borderWidth: 1, borderColor: colors.border },
  kicker: { fontSize: 11, letterSpacing: 1.1, fontWeight: '800', color: colors.deepGreen },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  split: { fontSize: 13, lineHeight: 19, fontWeight: '800', color: colors.text },
  copy: { fontSize: 13, lineHeight: 19, color: colors.textMuted, fontWeight: '600' },
  auraHint: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: colors.primary },
  total: { fontSize: 36, fontWeight: '900', color: colors.deepGreen, letterSpacing: -1 },
  tipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, customBlock: { gap: 8 },
  input: { minHeight: 48, borderRadius: MENU_METRICS.controlRadius, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface, color: colors.text, fontSize: 20, fontWeight: '800', paddingHorizontal: 14 },
  tipBlock: { gap: 10, padding: 14, backgroundColor: colors.background, borderRadius: MENU_METRICS.cardRadius, borderWidth: 1, borderColor: colors.border },
  tipTitle: { fontSize: 14, fontWeight: '800', color: colors.text }, tipChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tipChip: { flexGrow: 1, minWidth: 60, minHeight: 44, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  tipChipOn: { borderColor: colors.deepGreen, backgroundColor: colors.accentSoft }, tipChipText: { fontSize: 13, fontWeight: '700', color: colors.textMuted }, tipChipTextOn: { color: colors.deepGreen },
  breakdown: { fontSize: 13, lineHeight: 19, fontWeight: '700', color: colors.text }, disclaimer: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.textMuted },
  testNotice: { backgroundColor: colors.goldSoft, padding: 12, borderRadius: MENU_METRICS.controlRadius },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, borderTopWidth: 1, borderColor: colors.border },
  back: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderRadius: radii.pill, backgroundColor: colors.background }, backText: { fontWeight: '800', color: colors.textMuted },
  next: { flex: 1, minHeight: 50, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill, backgroundColor: colors.deepGreen, paddingHorizontal: 14 }, nextText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' }, disabled: { opacity: 0.45 },
});
