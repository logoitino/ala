import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MaloTipModal } from '@/components/TipSheetModal';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { cardShadow, colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import { displayValue, type Player } from '@/data/players';
import {
  WISHLIST_EMPTY,
  WISHLIST_EQUIPPED_BADGE,
  WISHLIST_EQUIP_AURA,
  WISHLIST_GIFT_ACTION,
  WISHLIST_LEDE,
  WISHLIST_TITLE,
  WISHLIST_UNLOCKED_TOAST,
  isWishlistFunded,
  wishlistChipInAction,
  wishlistFundedLabel,
  wishlistProgressPct,
} from '@/data/wishlist';
import { emitPlayerAura } from '@/lib/aura';
import { chipInWishlistItem, fetchWishlistItems } from '@/lib/wishlist';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL, SPRING_CARD } from '@/theme/motion';
import type { WishlistItem } from '@/types/database';

const CONFETTI_COLORS = [FOCAL.neonJade, FOCAL.electricGold, '#FFFFFF', colors.primaryMuted];

type LockerRoomWishlistProps = {
  player: Player;
  /** Display name for the Gear Unlocked card. Falls back to `player.name`. */
  athleteName?: string;
  /** Fires once per item the moment it crosses 100%. */
  onEquipped?: (item: WishlistItem) => void;
};

/**
 * @purpose Gamified Locker Room Wishlist on the athlete Stats 📊 tab: horizontal gear cards with a jade funding bar, 🎁 Gift Item Directly, and Chip In using the first Catalogs Mālo preset. Hitting 100% fires confetti, brands the card EQUIPPED ⚡, and pays the athlete +500 Aura.
 * @param player Athlete whose `wishlist_items` load and who receives Mālo + the equip bonus.
 * @param athleteName Name shown on the Gear Unlocked overlay.
 * @param onEquipped Host hook for a newly funded item (refresh stats, log, etc).
 * @returns Horizontal card row plus the Mālo sheet and the full-screen unlock celebration.
 * @sideEffects `get_wishlist_items` on focus; `MaloTipModal` PaymentSheet; `chip_in_wishlist_item` (which calls `add_user_aura`); `expo-web-browser` for retailer links; Success haptic; `feature_tap` / `ui_issue` telemetry; paused by `layouts.wishlist`.
 */
export function LockerRoomWishlist({ player, athleteName, onEquipped }: LockerRoomWishlistProps) {
  const { live } = useAppRuntime();
  const celebration = useOptionalCelebration();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipItem, setTipItem] = useState<WishlistItem | null>(null);
  const [unlocked, setUnlocked] = useState<WishlistItem | null>(null);
  const name = displayValue(athleteName ?? player.name, 'this athlete');
  const chipInLabel = wishlistChipInAction(live.catalog.maloAmounts[0] ?? 5);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchWishlistItems(player.id));
    } finally {
      setLoading(false);
    }
  }, [player.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openRetailer = async (item: WishlistItem) => {
    telemetry.trackFeature('wishlist_gift', 'profile');
    if (!item.buy_url) {
      celebration?.showToast('No retailer link on this item yet.');
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(item.buy_url);
    } catch {
      telemetry.trackIssue('wishlist_gift', 'profile');
      celebration?.showToast('Could not open that store link.');
    }
  };

  const startChipIn = (item: WishlistItem) => {
    telemetry.trackFeature('wishlist_chip_in', 'profile');
    setTipItem(item);
  };

  const creditChipIn = async (amountCents: number) => {
    const target = tipItem;
    if (!target) return;

    const result = await chipInWishlistItem(target, amountCents);
    setItems((current) => current.map((row) => (row.id === result.item.id ? result.item : row)));
    if (!result.newlyEquipped) return;

    // Hand the screen to the unlock celebration instead of stacking it over the Mālo modal.
    celebration?.dismiss();
    setTipItem(null);
    setUnlocked(result.item);
    celebration?.showToast(`${WISHLIST_UNLOCKED_TOAST} ${result.item.title}`);
    if (result.athleteAuraPoints != null) emitPlayerAura(player.id, result.athleteAuraPoints);
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Simulator / web may not expose haptics.
    }
    onEquipped?.(result.item);
  };

  if (!live.layouts.wishlist) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <Text style={styles.title}>{WISHLIST_TITLE}</Text>
          <Text style={styles.lede}>{WISHLIST_LEDE}</Text>
        </View>
        {loading ? <ActivityIndicator color={FOCAL.jadeInk} size="small" /> : null}
      </View>

      {items.length === 0 && !loading ? (
        <Text style={styles.empty}>{WISHLIST_EMPTY}</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          accessibilityLabel={WISHLIST_TITLE}
        >
          {items.map((item) => (
            <WishlistCard
              key={item.id}
              item={item}
              chipping={tipItem?.id === item.id}
              chipInLabel={chipInLabel}
              onGift={() => void openRetailer(item)}
              onChipIn={() => startChipIn(item)}
            />
          ))}
        </ScrollView>
      )}

      <MaloTipModal
        player={tipItem ? player : null}
        onClose={() => setTipItem(null)}
        onTipped={(amountCents) => void creditChipIn(amountCents)}
      />

      <GearUnlockedOverlay
        item={unlocked}
        athleteName={name}
        onClose={() => setUnlocked(null)}
      />
    </View>
  );
}

/**
 * @purpose One gear card: photo, title, money line, spring-animated Neon Jade funding bar, and the two fan actions.
 * @param chipping True while this card owns the open Mālo sheet.
 */
function WishlistCard({
  item,
  chipping,
  chipInLabel,
  onGift,
  onChipIn,
}: {
  item: WishlistItem;
  chipping: boolean;
  chipInLabel: string;
  onGift: () => void;
  onChipIn: () => void;
}) {
  const pct = wishlistProgressPct(item);
  const funded = isWishlistFunded(item);
  const fill = useSharedValue(0);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    fill.value = withSpring(pct, SPRING_CARD);
  }, [fill, pct]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(100, fill.value))}%` }));

  return (
    <View
      style={[styles.card, funded && styles.cardFunded]}
      accessibilityRole="summary"
      accessibilityLabel={`${item.title}. ${wishlistFundedLabel(item)}`}
    >
      <View style={styles.photoWrap}>
        {item.photo_url && !photoFailed ? (
          <Image
            source={{ uri: item.photo_url }}
            style={styles.photo}
            resizeMode="cover"
            onError={() => setPhotoFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Ionicons name="bag-handle-outline" size={30} color={FOCAL.jadeInk} />
        )}
        {funded ? <EquippedBadge /> : null}
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={[styles.money, funded && styles.moneyFunded]}>{wishlistFundedLabel(item)}</Text>

      <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ now: pct, min: 0, max: 100 }}>
        <Reanimated.View style={[styles.fill, funded && styles.fillFunded, fillStyle]} />
      </View>

      <AnimatedButton
        haptic="light"
        accessibilityLabel={`${WISHLIST_GIFT_ACTION} — ${item.title}`}
        contentStyle={styles.giftHit}
        onPress={onGift}
      >
        <Text style={styles.giftLabel}>{WISHLIST_GIFT_ACTION}</Text>
      </AnimatedButton>

      {funded ? null : (
        <AnimatedButton
          haptic="medium"
          accessibilityLabel={`${chipInLabel} toward ${item.title}`}
          accessibilityState={{ disabled: chipping }}
          disabled={chipping}
          contentStyle={[styles.chipHit, chipping && styles.chipHitBusy]}
          onPress={onChipIn}
        >
          <Text style={styles.chipLabel}>{chipping ? 'Mālo open…' : chipInLabel}</Text>
        </AnimatedButton>
      )}
    </View>
  );
}

/** @purpose Pulsing EQUIPPED ⚡ badge stamped on a fully funded card. */
function EquippedBadge() {
  const glow = useSharedValue(0.4);

  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View pointerEvents="none" style={styles.equippedWrap}>
      <Reanimated.View style={[styles.equippedGlow, glowStyle]} />
      <View style={styles.equippedBadge}>
        <Text style={styles.equippedLabel}>{WISHLIST_EQUIPPED_BADGE}</Text>
      </View>
    </View>
  );
}

/**
 * @purpose Full-screen confetti + "Gear Unlocked!" card for the contribution that finished a goal.
 * @param item Item that just hit 100%, or null when idle.
 */
function GearUnlockedOverlay({
  item,
  athleteName,
  onClose,
}: {
  item: WishlistItem | null;
  athleteName: string;
  onClose: () => void;
}) {
  const [burstKey, setBurstKey] = useState(0);
  const width = Dimensions.get('window').width;

  useEffect(() => {
    if (item) setBurstKey((current) => current + 1);
  }, [item]);

  return (
    <Modal animationType="fade" transparent visible={Boolean(item)} onRequestClose={onClose}>
      <View style={styles.overlay}>
        {item ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <ConfettiCannon
              key={burstKey}
              count={200}
              origin={{ x: width / 2, y: -14 }}
              fadeOut
              explosionSpeed={430}
              fallSpeed={2700}
              colors={CONFETTI_COLORS}
            />
          </View>
        ) : null}
        <View style={styles.unlockCard}>
          <Text style={styles.unlockKicker}>{WISHLIST_UNLOCKED_TOAST}</Text>
          <Text style={styles.unlockTitle}>{item?.title.toUpperCase()}</Text>
          <Text style={styles.unlockBody}>
            Fully funded by the Crew. {athleteName} takes the field in new gear.
          </Text>
          <View style={styles.unlockBadge}>
            <Text style={styles.unlockBadgeLabel}>{WISHLIST_EQUIPPED_BADGE}</Text>
          </View>
          <Text style={styles.unlockAura}>+{WISHLIST_EQUIP_AURA} Aura to {athleteName} ⚡</Text>
          <AnimatedButton
            haptic="medium"
            accessibilityLabel="Close gear unlocked"
            contentStyle={styles.unlockClose}
            onPress={onClose}
          >
            <Text style={styles.unlockCloseLabel}>Seki! 🤙</Text>
          </AnimatedButton>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  lede: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: 8,
  },
  row: {
    gap: 12,
    paddingRight: 4,
    paddingVertical: 2,
  },
  card: {
    width: 232,
    backgroundColor: FOCAL.mistJade,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
    ...cardShadow,
  },
  cardFunded: {
    borderColor: FOCAL.jadeInk,
  },
  photoWrap: {
    height: 104,
    borderRadius: radii.md,
    backgroundColor: colors.photoPlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  equippedWrap: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  equippedGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    backgroundColor: 'rgba(0,230,118,0.45)',
  },
  equippedBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FOCAL.jadeInk,
    backgroundColor: colors.videoScrim,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  equippedLabel: {
    color: FOCAL.jadeInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  money: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  moneyFunded: {
    color: FOCAL.jadeInk,
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: FOCAL.neonJade,
    borderRadius: 999,
  },
  fillFunded: {
    backgroundColor: FOCAL.electricGold,
  },
  giftHit: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  giftLabel: {
    color: FOCAL.jadeInk,
    fontSize: 13,
    fontWeight: '800',
  },
  chipHit: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  chipHitBusy: {
    opacity: 0.6,
  },
  chipLabel: {
    color: FOCAL.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.videoScrim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  unlockCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: FOCAL.jadeInk,
    paddingHorizontal: 22,
    paddingVertical: 26,
    gap: 10,
    alignItems: 'center',
    ...cardShadow,
  },
  unlockKicker: {
    color: FOCAL.electricGold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  unlockTitle: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  unlockBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  unlockBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FOCAL.jadeInk,
    backgroundColor: 'rgba(0,230,118,0.16)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  unlockBadgeLabel: {
    color: FOCAL.jadeInk,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  unlockAura: {
    color: FOCAL.jadeInk,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  unlockClose: {
    marginTop: 6,
    minHeight: 48,
    minWidth: 170,
    paddingHorizontal: 20,
    borderRadius: radii.md,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockCloseLabel: {
    color: FOCAL.ink,
    fontSize: 15,
    fontWeight: '800',
  },
});
