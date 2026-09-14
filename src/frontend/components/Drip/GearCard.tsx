import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { colors, radii } from '@/constants/theme';
import {
  DRIP_CATEGORY_LABELS,
  dripAuraForOrder,
  dripPriceLabel,
  type DripItem,
} from '@/data/shop';

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
 * @purpose Drip marketplace tile with Obsidian shadow, Neon Jade price / Aura badges, and 0.96 press scale.
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
          <Ionicons name={ICONS[item.icon]} size={22} color={colors.primary} />
        </View>
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{dripPriceLabel(item.priceCents)}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>+{aura} Aura</Text>
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
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#0F1416',
        shadowOpacity: 0.55,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 8 },
      default: { boxShadow: '0px 8px 16px rgba(15, 20, 22, 0.55)' },
    }),
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: '#00E676',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeLabel: {
    color: '#00E676',
    fontSize: 12,
    fontWeight: '800',
  },
  kind: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  blurb: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
