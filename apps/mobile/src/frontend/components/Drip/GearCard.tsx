/** Compact Drip rack card uses ember recognition while preserving catalog copy, price and earned Aura.
 * The whole tile opens ProductSheet; checkout and purchase disclosures stay in that existing sheet. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { cardShadow, colors, radii } from '@/constants/theme';
import {
  DRIP_CATEGORY_LABELS,
  dripAuraForOrder,
  dripPriceLabel,
  type DripItem,
} from '@/data/shop';
import { FOCAL } from '@/theme/motion';

const ICONS: Record<DripItem['icon'], keyof typeof Ionicons.glyphMap> = {
  shirt: 'shirt-outline',
  sparkles: 'sparkles-outline',
  basketball: 'basketball-outline',
};

type GearCardProps = {
  item: DripItem;
  onPress: (item: DripItem) => void;
};

/**
 * @purpose Drip marketplace tile on an ember-tinted mist with gold price + jade Aura badges and 0.96 press scale.
 * @param item Catalog row from `DRIP_ITEMS`.
 * @param onPress Opens the product sheet.
 * @returns Apparel / card / merch pressable.
 * @sideEffects Light haptic via `AnimatedPressable`.
 */
export function GearCard({ item, onPress }: GearCardProps) {
  const aura = dripAuraForOrder(item, 1);
  return (
    <AnimatedPressable
      accessibilityLabel={`${item.name}, ${dripPriceLabel(item.priceCents)}, plus ${aura} Aura`}
      haptic="light"
      overshoot={false}
      scaleTo={0.96}
      onPress={() => onPress(item)}
      contentStyle={styles.card}
    >
      <View style={styles.top}>
        <View style={styles.iconWrap}>
          <View pointerEvents="none" style={styles.iconGloss} />
          <Ionicons name={ICONS[item.icon]} size={18} color={FOCAL.emberInk} />
        </View>
        <View style={styles.badges}>
          <View style={[styles.badge, styles.priceBadge]}>
            <Text style={[styles.badgeLabel, styles.priceLabel]}>{dripPriceLabel(item.priceCents)}</Text>
          </View>
          <View style={[styles.badge, styles.auraBadge]}>
            <Text style={[styles.badgeLabel, styles.auraLabel]}>+{aura} Aura</Text>
          </View>
        </View>
      </View>
      <Text style={styles.kind}>{DRIP_CATEGORY_LABELS[item.category]}</Text>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.blurb}>{item.blurb}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: FOCAL.mistEmber,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: FOCAL.ember,
    padding: 10,
    gap: 5,
    ...cardShadow,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconGloss: {
    position: 'absolute',
    top: -10,
    left: -8,
    width: 34,
    height: 22,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.6)',
    transform: [{ rotate: '-18deg' }],
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    flex: 1,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priceBadge: {
    borderColor: FOCAL.goldInk,
  },
  auraBadge: {
    borderColor: FOCAL.jadeInk,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  priceLabel: {
    color: FOCAL.goldInk,
  },
  auraLabel: {
    color: FOCAL.jadeInk,
  },
  kind: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  blurb: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
