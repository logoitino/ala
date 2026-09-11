import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DashboardPanel } from '@/components/DashboardPanel';
import { TabScreen } from '@/components/TabScreen';
import { colors, radii } from '@/constants/theme';
import { SHOP_CATEGORY_LABELS, SHOP_ITEMS, type ShopItem } from '@/data/shop';

const CATEGORIES: ShopItem['category'][] = ['gear', 'apparel', 'badge'];

export default function LockerRoomTab() {
  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Marketplace</Text>
        <Text style={styles.heading}>Locker Room</Text>
        {CATEGORIES.map((category) => (
          <DashboardPanel key={category} title={SHOP_CATEGORY_LABELS[category]}>
            <View style={styles.grid}>
              {SHOP_ITEMS.filter((item) => item.category === category).map((item) => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.price}>{item.priceLabel}</Text>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.blurb}>{item.blurb}</Text>
                </View>
              ))}
            </View>
          </DashboardPanel>
        ))}
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  kicker: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
  },
  grid: {
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    padding: 14,
    gap: 4,
  },
  price: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.accent,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  blurb: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
