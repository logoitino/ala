/**
 * The gift popup keeps its header, Close and checkout navigation visible around short pages.
 * Pending family payouts show the existing held notice; Stripe presentation locks every exit.
 * @sideEffects Reads athlete_payout_allowed; child checkout records test gifts through Stripe.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CardShine } from '@/components/Effects/CardShine';
import { TipCheckout } from '@/components/TipCheckout';
import { colors, KIT, radii, space } from '@/constants/theme';
import { useSheetFrame, SHEET_BLUR_INTENSITY } from '@/hooks/useSheetFrame';
import { maloAthleteCta, maloAthleteSheetSubtitle } from '@/data/malo';
import { GIFT_HELD_NOTICE } from '@/data/verification';
import { displayValue, type Player } from '@/data/players';
import type { TipEntry, TipOrigin } from '@/lib/finance';
import { fetchPayoutAllowed } from '@/lib/payoutGate';
import { FOCAL, SPRING_BOUNCE, SPRING_SHEET } from '@/theme/motion';
import { DISPLAY_TEXT } from '@/theme/fonts';

type TipSheetModalProps = {
  player: Player | null;
  reelId?: string;
  origin?: TipOrigin;
  entry?: TipEntry;
  wishlistItemId?: string;
  /** Rally goal this gift counts toward (ROADMAP M2). */
  rallyId?: string;
  sourceLabel?: string;
  onClose: () => void;
  onBacked?: (nextCount: number) => void;
  onTipped?: (amountCents: number) => void;
};

const SHEET_OFF = 640;

/**
 * @purpose Bottom-sheet gift checkout over a blurred feed backdrop. Copy names the athlete who receives the gift (not the uploader).
 * The constrained card keeps navigation outside its changing page; only the short page body scrolls.
 * Shows a "held" line while payouts to this athlete are not unlocked (no school confirmation and no family Stripe ID check yet)
 * (owner decision 2026-09-29; copy flagged for LEGAL).
 * @sideEffects Unmounts `TipCheckout` on dismiss so custom amount / fee state reset; `athlete_payout_allowed` per athlete.
 */
export function MaloTipModal({
  player,
  reelId,
  origin,
  entry,
  wishlistItemId,
  rallyId,
  sourceLabel,
  onClose,
  onBacked,
  onTipped,
}: TipSheetModalProps) {
  const frame = useSheetFrame();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Leave a strip of the feed above the card so the title is never off the top of the phone.
  const sheetMax = Math.max(280, windowHeight - insets.top - 16 - (space.xs + insets.bottom));
  const [open, setOpen] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [session, setSession] = useState(0);
  const [verified, setVerified] = useState<boolean | null>(null);
  const lastPlayer = useRef<Player | null>(null);
  if (player && !busyRef.current) lastPlayer.current = player;
  const display = busyRef.current ? lastPlayer.current : player ?? lastPlayer.current;
  const closingRef = useRef(false);
  const sessionPlayerRef = useRef<string | null>(null);
  const playerName = displayValue(display?.name, 'this athlete');
  const headerPop = useSharedValue(1);
  const translateY = useSharedValue(SHEET_OFF);
  const dim = useSharedValue(0);

  const updateBusy = useCallback((value: boolean) => { busyRef.current = value; setBusy(value); }, []);
  const playerId = display?.id ?? null;
  useEffect(() => {
    if (!playerId) return;
    let live = true;
    setVerified(null);
    void fetchPayoutAllowed(playerId).then((result) => {
      if (live) setVerified(result);
    });
    return () => {
      live = false;
    };
  }, [playerId]);

  useEffect(() => {
    if (busyRef.current) return;
    if (player) {
      if (sessionPlayerRef.current === player.id && open) return;
      sessionPlayerRef.current = player.id;
      closingRef.current = false;
      setOpen(true);
      setDelivered(false);
      if (!busyRef.current) setBusy(false);
      setSession((value) => value + 1);
      headerPop.value = 1;
      translateY.value = SHEET_OFF;
      dim.value = 0;
      const frame = requestAnimationFrame(() => {
        translateY.value = withSpring(0, SPRING_SHEET);
        dim.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      });
      return () => cancelAnimationFrame(frame);
    }
    sessionPlayerRef.current = null;
    // Parent cleared `player` without going through our own dismiss() (e.g. swiping to
    // another reel) — still slide the sheet away instead of snapping it out of existence.
    if (open && !closingRef.current) {
      closingRef.current = true;
      dim.value = withTiming(0, { duration: 160 });
      translateY.value = withTiming(
        SHEET_OFF,
        { duration: 200, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setOpen)(false);
        },
      );
    }
    return undefined;
    // Payment settlement replays a deferred external recipient change without replacing an active checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, busy]);

  useEffect(() => {
    if (delivered) {
      headerPop.value = 0.9;
      headerPop.value = withSpring(1, SPRING_BOUNCE);
    }
  }, [delivered, headerPop]);

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: headerPop.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const dismiss = () => {
    if (busyRef.current || busy || closingRef.current || !open) return;
    closingRef.current = true;
    dim.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(
      SHEET_OFF,
      { duration: 220, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setOpen)(false);
          runOnJS(onClose)();
        }
      },
    );
  };

  if (!open && !player) return null;

  return (
    <Modal animationType="none" transparent visible={open} onRequestClose={dismiss}>
      <View style={styles.backdropWrap}>
        <Pressable haptic="none" style={styles.backdrop} onPress={dismiss}>
          <Animated.View style={[styles.blur, backdropStyle]}>
            <BlurView intensity={SHEET_BLUR_INTENSITY} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          </Animated.View>
        </Pressable>
        <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardDock}>
        <View pointerEvents="box-none" style={frame.dock}>
          <Animated.View style={[sheetStyle, styles.sheet, frame.card, { height: Math.min(720, sheetMax), maxHeight: sheetMax }]}>
              <SheetHandle onDismiss={dismiss} />
              <Animated.View style={[styles.header, delivered && styles.headerDelivered, headerStyle]}>
                {delivered ? (
                  <CardShine tint="rgba(0,230,118,0.4)" color="rgba(255,255,255,0.95)" loopMs={2600} />
                ) : null}
                <Text style={[styles.title, delivered && styles.successTitle]}>
                  {delivered ? `Mālo! Your gift to ${playerName} is recorded 🚀` : maloAthleteCta(playerName)}
                </Text>
                <Text style={styles.subtitle}>{maloAthleteSheetSubtitle(playerName)}</Text>
                {verified === false && !delivered ? <Text style={styles.heldNotice}>{GIFT_HELD_NOTICE}</Text> : null}
              </Animated.View>
              {display ? (
                <TipCheckout
                  key={`${display.id}:${session}`}
                  player={display}
                  embedded
                  hideHeader
                  reelId={reelId}
                  origin={origin}
                  entry={entry}
                  wishlistItemId={wishlistItemId}
                  rallyId={rallyId}
                  sourceLabel={sourceLabel}
                  onBusyChange={updateBusy}
                  canInteract={() => !closingRef.current}
                  onBacked={(nextCount) => {
                    setDelivered(true);
                    onBacked?.(nextCount);
                  }}
                  onTipped={onTipped}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={dismiss}
                style={[styles.close, busy && styles.closeDisabled]}
              >
                <Text style={styles.closeLabel}>{busy ? 'Payment in progress…' : delivered ? 'Done' : 'Close'}</Text>
              </Pressable>
          </Animated.View>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  blur: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.border,
  },
  keyboardDock: { maxHeight: '100%' },
  sheet: {
    backgroundColor: colors.surface, gap: 12,
    borderTopLeftRadius: KIT.sheetRadius, borderTopRightRadius: KIT.sheetRadius,
  },
  header: {
    gap: 6,
  },
  headerDelivered: {
    gap: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: FOCAL.neonJade,
    backgroundColor: FOCAL.mistJade,
    paddingHorizontal: 14,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  title: {
    ...DISPLAY_TEXT,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.5,
  },
  successTitle: {
    color: colors.deepGreen,
    fontSize: 18,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.textMuted,
  },
  heldNotice: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.gold,
    backgroundColor: colors.goldSoft,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  close: {
    minHeight: 44,
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.deepGreen,
  },
  closeDisabled: {
    opacity: 0.45,
  },
});
