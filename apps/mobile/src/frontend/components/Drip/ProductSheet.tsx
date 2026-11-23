/** Paid records retain their initiating account/product; unavailable stock and stale sheet resumes cannot start purchases. */
/** Fan menu presentation uses shared Daylight chrome; feature data and confirmation rules stay with the parent. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, MENU_METRICS } from '@/constants/theme';
import { useSheetFrame, SHEET_BLUR_INTENSITY } from '@/hooks/useSheetFrame';
import {
  DRIP_SIZES,
  dripAuraForOrder,
  dripMaxQty,
  dripPriceLabel,
  type DripItem,
  type DripSize,
} from '@/data/shop';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { useTipCheckout } from '@/hooks/useTipCheckout';
import { recordDripOrder } from '@/lib/finance';
import { assertCurrent } from '@/lib/offlineActor';
import { offlineQueue } from '@/services/OfflineQueue';
import { telemetry } from '@/services/TelemetryManager';
import {
  FOCAL,
  SHEET_BACKDROP_IN_MS,
  SHEET_BACKDROP_OUT_MS,
  SHEET_DISMISS_MS,
  SPRING_BOUNCE,
  SPRING_CARD,
  SPRING_SHEET,
} from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

const SHEET_OFF = 720;

const ICONS: Record<DripItem['icon'], keyof typeof Ionicons.glyphMap> = {
  shirt: 'shirt-outline',
  sparkles: 'sparkles-outline',
  basketball: 'basketball-outline',
};

type ProductSheetProps = {
  item: DripItem | null;
  onClose: () => void;
};

/**
 * @purpose Reanimated Drip checkout sheet: sliding size pills, inventory qty, Aura banner, Stripe Buy Now.
 * @param item Selected catalog row, or `null` to hide.
 * @param onClose Dismiss after a successful pay or backdrop tap (locked while PaymentSheet is open).
 * @returns Modal bottom sheet over an `expo-blur` backdrop.
 * @sideEffects Soft-Wall for guests before Buy; `useTipCheckout` PaymentSheet, `shop_orders` INSERT, `add_user_aura` (order dollars × 10, buyer only), success haptic, Aura toast, Light haptic on size / qty.
 */
export function ProductSheet({ item, onClose }: ProductSheetProps) {
  const frame = useSheetFrame();
  const { height: windowHeight } = useWindowDimensions();
  const { requireAuth } = useSoftWall();
  const { user } = useAuth();
  const { startCheckout, busy } = useTipCheckout();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const lifetime = useRef({ id: item?.id, active: Boolean(item) });
  if (lifetime.current.id !== item?.id) lifetime.current = { id: item?.id, active: Boolean(item) };
  const sheet = lifetime.current;
  const selectedItem = useRef(item);
  selectedItem.current = item;
  const current = () => mounted.current && lifetime.current === sheet && sheet.active && Boolean(selectedItem.current);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<DripSize>('M');
  const [qty, setQty] = useState(1);
  const lastItem = useRef<DripItem | null>(null);
  if (item) lastItem.current = item;
  const display = item ?? lastItem.current;
  const translateY = useSharedValue(SHEET_OFF);
  const dim = useSharedValue(0);
  const contentScale = useSharedValue(0.92);
  const contentOpacity = useSharedValue(0);
  const totalBump = useSharedValue(1);
  const qtyBump = useSharedValue(1);
  const sizeLayouts = useRef<Partial<Record<DripSize, { x: number; width: number }>>>({});
  const sizePlaced = useRef(false);
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(0);
  const indicatorOp = useSharedValue(0);

  const maxQty = display ? dripMaxQty(display) : 1;

  const moveSizeIndicator = (next: DripSize, animate: boolean) => {
    const box = sizeLayouts.current[next];
    if (!box) return;
    if (!animate || !sizePlaced.current) {
      indicatorX.value = box.x;
      indicatorW.value = box.width;
      indicatorOp.value = 1;
      sizePlaced.current = true;
      return;
    }
    indicatorX.value = withSpring(box.x, SPRING_CARD);
    indicatorW.value = withSpring(box.width, SPRING_CARD);
    indicatorOp.value = withTiming(1, { duration: 120 });
  };

  useEffect(() => {
    if (!item) return;
    setOpen(true);
    setSize('M');
    setQty(1);
    sizePlaced.current = false;
    translateY.value = SHEET_OFF;
    dim.value = 0;
    contentScale.value = 0.92;
    contentOpacity.value = 0;
    const frame = requestAnimationFrame(() => {
      translateY.value = withSpring(0, SPRING_SHEET);
      dim.value = withTiming(1, {
        duration: SHEET_BACKDROP_IN_MS,
        easing: Easing.out(Easing.cubic),
      });
      contentScale.value = withSpring(1, SPRING_CARD);
      contentOpacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    });
    return () => cancelAnimationFrame(frame);
  }, [contentOpacity, contentScale, dim, item, translateY]);

  useEffect(() => {
    setQty((current) => Math.min(maxQty, Math.max(1, current)));
  }, [maxQty]);

  useEffect(() => {
    qtyBump.value = withSequence(withSpring(1.18, SPRING_BOUNCE), withSpring(1, SPRING_BOUNCE));
  }, [qty, qtyBump]);

  useEffect(() => {
    moveSizeIndicator(size, true);
    // Layout boxes live in a ref; size is the selected pill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, display?.id]);

  const finishClose = () => {
    // Closing marks active=false; only the same mounted sheet may settle its animation.
    if (!mounted.current || lifetime.current !== sheet) return;
    setOpen(false);
    onClose();
  };

  const dismiss = (force = false) => {
    if ((!force && busy) || !open) return;
    sheet.active = false;
    dim.value = withTiming(0, { duration: SHEET_BACKDROP_OUT_MS });
    translateY.value = withTiming(
      SHEET_OFF,
      { duration: SHEET_DISMISS_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      },
    );
  };

  const totalCents = display ? display.priceCents * qty : 0;
  const aura = display && maxQty > 0 ? dripAuraForOrder(display, qty) : 0;
  const buyLabel = maxQty === 0 ? 'Out of stock' : `Buy Now — ${dripPriceLabel(totalCents)}`;

  useEffect(() => {
    totalBump.value = withSequence(withSpring(1.1, SPRING_BOUNCE), withSpring(1, SPRING_BOUNCE));
    // Bump reacts to the derived total, not the shared value itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCents]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: dim.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));

  const qtyValueStyle = useAnimatedStyle(() => ({
    transform: [{ scale: qtyBump.value }],
  }));

  const totalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: totalBump.value }],
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOp.value,
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  const buy = () => {
    if (!item || busy || !current() || maxQty === 0 || qty > maxQty) return;
    const initiatingActor = offlineQueue.captureActor(user?.id);
    if (user?.id && !initiatingActor) return;
    let resumed = false;
    // Guests hit createPaymentIntent as 401 without Soft-Wall; stash Buy and resume after sign-in.
    requireAuth({
      kind: 'signin',
      resume: () => {
        if (resumed || !current() || (initiatingActor && !initiatingActor.isCurrent()) || !selectedItem.current
          || qty > dripMaxQty(selectedItem.current)) return;
        resumed = true;
        telemetry.trackFeature('drip_buy', 'drip');
        void startCheckout({
          tipAmount: totalCents / 100,
          coverFees: false,
          skipBacker: true,
          auraPoints: aura,
          successToast: `Drip secured ⚡ +${aura} Aura Points earned!`,
          onPaid: async ({ actor, client }) => {
            assertCurrent(actor);
            await recordDripOrder({
              productId: item.id,
              amountCents: totalCents,
              qty,
              buyerId: actor.userId,
            }, client);
            assertCurrent(actor);
            if (current()) dismiss(true);
          },
        });
      },
    });
  };

  const sizeHint = useMemo(() => {
    if (!display?.hasSizes) return 'One size';
    return `Size ${size}`;
  }, [display?.hasSizes, size]);

  if (!open && !item) return null;

  const body = (
    <View style={[styles.root, Platform.OS === 'web' ? styles.webRoot : styles.nativeRoot]}>
      <Pressable haptic="none" disabled={busy} onPress={() => dismiss()} style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.dim, backdropStyle]}>
          <BlurView intensity={SHEET_BLUR_INTENSITY} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
        </Animated.View>
      </Pressable>
      <View pointerEvents="box-none" style={frame.dock}>
      <Animated.View style={[styles.sheet, frame.card, { maxHeight: windowHeight * 0.85 }, sheetStyle]}>
        <Pressable haptic="none" onPress={() => undefined} style={{ flexShrink: 1 }}>
          <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={() => dismiss()} />
          {display ? (
            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled"><Animated.View style={[styles.content, contentStyle]}>
              <View style={styles.iconWrap}>
                <View pointerEvents="none" style={styles.iconGloss} />
                <Ionicons name={ICONS[display.icon]} size={18} color={FOCAL.jadeInk} />
              </View>
              <Text style={styles.kicker}>{sizeHint}</Text>
              <Text style={styles.title}>{display.name}</Text>
              <Text style={styles.blurb}>{display.blurb}</Text>

              {display.hasSizes ? (
                <View style={styles.sizeRow}>
                  <Animated.View pointerEvents="none" style={[styles.sizeIndicator, indicatorStyle]} />
                  {DRIP_SIZES.map((option) => {
                    const selected = option === size;
                    return (
                      <View
                        key={option}
                        style={styles.sizeHit}
                        onLayout={(event) => {
                          const { x, width } = event.nativeEvent.layout;
                          sizeLayouts.current[option] = { x, width };
                          if (selected) moveSizeIndicator(option, sizePlaced.current);
                        }}
                      >
                        <AnimatedButton
                          accessibilityLabel={`Size ${option}`}
                          accessibilityState={{ selected }}
                          haptic="light"
                          scaleTo={0.92}
                          onPress={() => setSize(option)}
                          contentStyle={[styles.sizePill, selected ? styles.sizePillOn : styles.sizePillIdle]}
                        >
                          <Text style={[styles.sizeLabel, selected && styles.sizeLabelOn]}>{option}</Text>
                        </AnimatedButton>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.qtyRow}>
                <View style={styles.qtyCopy}>
                  <Text style={styles.qtyCaption}>Quantity</Text>
                  <Text style={styles.qtyStock}>{maxQty === 0 ? 'Out of stock' : `${maxQty} in stock`}</Text>
                </View>
                <View style={styles.qtyControls}>
                  <AnimatedButton
                    accessibilityLabel="Decrease quantity"
                    disabled={qty <= 1}
                    haptic="light"
                    onPress={() => setQty((current) => Math.max(1, current - 1))}
                    contentStyle={[styles.qtyBtn, qty <= 1 && styles.qtyBtnOff]}
                  >
                    <Text style={styles.qtyGlyph}>−</Text>
                  </AnimatedButton>
                  <Animated.Text style={[styles.qtyValue, qtyValueStyle]}>{qty}</Animated.Text>
                  <AnimatedButton
                    accessibilityLabel="Increase quantity"
                    disabled={qty >= maxQty}
                    haptic="light"
                    onPress={() => setQty((current) => Math.min(maxQty, current + 1))}
                    contentStyle={[styles.qtyBtn, qty >= maxQty && styles.qtyBtnOff]}
                  >
                    <Text style={styles.qtyGlyph}>+</Text>
                  </AnimatedButton>
                </View>
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total</Text>
                  <Animated.Text style={[styles.summaryValue, totalStyle]}>
                    {dripPriceLabel(totalCents)}
                  </Animated.Text>
                </View>
                <View style={styles.auraRow}>
                  <Ionicons name="flash" size={13} color={FOCAL.jadeInk} />
                  <Text style={styles.auraCopy}>+{aura} Aura Points with this order</Text>
                </View>
              </View>

              <AnimatedButton
                accessibilityLabel={buyLabel}
                disabled={busy || maxQty === 0}
                haptic="light"
                onPress={buy}
                contentStyle={[styles.buy, (busy || maxQty === 0) && styles.buyOff]}
              >
                <Text style={styles.buyLabel}>{busy ? 'Opening checkout…' : buyLabel}</Text>
              </AnimatedButton>
            </Animated.View></ScrollView>
          ) : null}
        </Pressable>
      </Animated.View>
      </View>
    </View>
  );

  if (Platform.OS === 'web') return body;

  return (
    <Modal
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={open}
      onRequestClose={() => dismiss()}
    >
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    justifyContent: 'flex-end',
  },
  webRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
  },
  nativeRoot: {
    flex: 1,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.border,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: FOCAL.jadeInk,
        shadowOpacity: 0.14,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: -8 },
      },
      android: { elevation: 12 },
      default: { boxShadow: '0px -8px 24px rgba(0, 115, 60, 0.14)' },
    }),
  },
  content: {
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: FOCAL.mistGold,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconGloss: {
    position: 'absolute',
    top: -12,
    left: -10,
    width: 42,
    height: 28,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.6)',
    transform: [{ rotate: '-18deg' }],
  },
  kicker: {
    color: colors.primary,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    ...TYPE.section,
    ...figtree('800'),
  },
  blurb: { ...figtree('400'),
    color: colors.textMuted,
    ...TYPE.body,

  },
  sizeRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  sizeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.primary,
  },
  sizeHit: {
    flex: 1,
    zIndex: 1,
  },
  sizePill: {
    minHeight: 44,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizePillIdle: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  sizePillOn: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  sizeLabel: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('800'),
  },
  sizeLabelOn: {
    color: colors.onAccent,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  qtyCopy: {
    gap: 2,
  },
  qtyCaption: {
    color: colors.text,
    ...TYPE.body,
    ...figtree('800'),
  },
  qtyStock: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('600'),
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qtyBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnOff: {
    opacity: 0.4,
  },
  qtyGlyph: {
    color: colors.primary,
    ...TYPE.title,
    ...figtree('700'),

  },
  qtyValue: {
    color: colors.text,
    ...TYPE.section,
    ...figtree('800'),
    minWidth: 24,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: MENU_METRICS.controlRadius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors.text,
    ...TYPE.body,
    ...figtree('700'),
  },
  summaryValue: {
    color: colors.text,
    ...TYPE.section,
    ...figtree('800'),
    letterSpacing: -0.3,
  },
  auraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  auraCopy: {
    color: colors.primary,
    ...TYPE.body,
    ...figtree('800'),
  },
  buy: {
    minHeight: 48,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyOff: {
    opacity: 0.55,
  },
  buyLabel: {
    color: colors.onAccent,
    ...TYPE.body,
    ...figtree('800'),
  },
});
