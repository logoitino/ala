/**
 * Compact Local Boosters rail: ranked fans as short sponsor-style cards (avatar, name, pts, one badge).
 * UX-12 balances readable names with smaller avatars; profile peek scrolls before its fixed Close.
 * Data from `hooks/useAuraBoosters`; tiers and colours from `lib/aura.ts`.
 */

import { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { cardShadow, colors, radii } from '@/constants/theme';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { FOCAL, SPRING_CARD } from '@/theme/motion';
import { figtree, TYPE } from '@/theme/fonts';
import { useAuraBoosters } from '@/hooks/useAuraBoosters';
import { type AuraBooster } from '@/lib/aura';

type TopAuraBoostersProps = {
  hideTitle?: boolean;
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

function auraShadow(color: string, glow: string, strong: boolean) {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOpacity: strong ? 0.28 : 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    android: { elevation: strong ? 5 : 2 },
    default: { boxShadow: `0px 3px 10px ${glow}` },
  });
}

function AuraBoosterCard({
  booster,
  rank,
  onPress,
}: {
  booster: AuraBooster;
  rank: number;
  onPress: () => void;
}) {
  const tier = booster.current_tier;
  const rankColor = rank === 1 ? FOCAL.electricGold : tier.color;

  return (
    <AnimatedPressable
      haptic="light"
      scaleTo={0.96}
      overshoot={false}
      accessibilityLabel={`${rank}. ${booster.full_name}, ${tier.title}, ${booster.aura_points} aura points`}
      onPress={onPress}
      contentStyle={[
        styles.card,
        {
          backgroundColor: tier.face,
          borderColor: rank === 1 ? FOCAL.electricGold : tier.color,
          ...auraShadow(tier.color, tier.glow, tier.tier >= 3),
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { borderColor: tier.color }]}>
          <Text style={[styles.initials, { color: tier.ink }]}>{initialsFor(booster.full_name)}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.name}>
            {booster.full_name}
          </Text>
          <Text style={styles.handle}>
            @{booster.username}
          </Text>
          <Text style={[styles.points, { color: tier.ink }]}>
            {booster.aura_points.toLocaleString()} pts
          </Text>
        </View>
      </View>
      <View style={styles.badgeRow}>
        <View style={[styles.rank, { borderColor: rankColor, backgroundColor: `${rankColor}18` }]}>
          {rank === 1 ? <Ionicons name="star" size={10} color={FOCAL.goldInk} /> : null}
          <Text style={[styles.rankLabel, { color: rank === 1 ? FOCAL.goldInk : tier.ink }]}>#{rank}</Text>
        </View>
        <View style={[styles.badge, { borderColor: tier.color }]}>
          <Text style={[styles.badgeLabel, { color: tier.ink }]}>
            {tier.title}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

function BoosterPeek({
  booster,
  rank,
  onClose,
}: {
  booster: AuraBooster | null;
  rank: number;
  onClose: () => void;
}) {
  const frame = useSheetFrame();
  const intro = useSharedValue(0.9);

  useEffect(() => {
    if (!booster) return;
    intro.value = 0.9;
    intro.value = withSpring(1, SPRING_CARD);
  }, [booster, intro]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + intro.value * 0.5,
    transform: [{ scale: intro.value }],
  }));

  if (!booster) return null;
  const tier = booster.current_tier;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={[styles.modalRoot, frame.dock, { paddingTop: 12 }]}>
        <Pressable
          haptic="none"
          accessibilityLabel="Dismiss booster profile"
          onPress={onClose}
          style={styles.backdrop}
        />
        <Animated.View
          accessibilityRole="summary"
          accessibilityLabel={`${booster.full_name} booster profile`}
          style={[
            frame.card,
            styles.peek,
            { borderColor: tier.color, backgroundColor: colors.surface, ...auraShadow(tier.color, tier.glow, true) },
            cardStyle,
          ]}
        >
          <ScrollView style={styles.peekScroll} contentContainerStyle={styles.peekContent}>
            <Text style={styles.peekKicker}>Booster profile</Text>
            <View style={[styles.peekAvatar, { borderColor: tier.color, backgroundColor: tier.face }]}>
              <Text style={[styles.peekInitials, { color: tier.ink }]}>{initialsFor(booster.full_name)}</Text>
            </View>
            <Text style={styles.peekName}>{booster.full_name}</Text>
            <Text style={styles.peekHandle}>@{booster.username}</Text>
            <View style={[styles.peekBadge, { borderColor: tier.color, backgroundColor: tier.face }]}>
              <Text style={[styles.peekBadgeLabel, { color: tier.ink }]}>
                #{rank} · {tier.title}
              </Text>
            </View>
            <Text style={[styles.peekPoints, { color: tier.ink }]}>
              {booster.aura_points.toLocaleString()} Aura pts
            </Text>
          </ScrollView>
          <AnimatedButton accessibilityLabel="Close booster profile" onPress={onClose} contentStyle={styles.peekClose}>
            <Text style={styles.peekCloseLabel}>Close</Text>
          </AnimatedButton>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * @purpose Horizontal Top Aura Boosters rail — compact Daylight cards matching Team sponsors density.
 * @param hideTitle Hide the section heading when the Local hub already titles the pane.
 * @returns Horizontal booster cards plus an optional profile peek modal.
 * @sideEffects `useAuraBoosters` profile fetch + Aura event bus.
 */
export function TopAuraBoosters({ hideTitle = false }: TopAuraBoostersProps) {
  const { boosters } = useAuraBoosters();
  const [peekIndex, setPeekIndex] = useState<number | null>(null);
  const peeked = peekIndex === null ? null : (boosters[peekIndex] ?? null);

  return (
    <View style={[styles.section, hideTitle && styles.sectionFlush]}>
      {hideTitle ? null : <Text style={styles.sectionTitle}>Top Aura Boosters</Text>}
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {boosters.map((booster, index) => (
          <AuraBoosterCard
            key={booster.id}
            booster={booster}
            rank={index + 1}
            onPress={() => setPeekIndex(index)}
          />
        ))}
      </ScrollView>
      <BoosterPeek booster={peeked} rank={(peekIndex ?? 0) + 1} onClose={() => setPeekIndex(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
    marginHorizontal: -12,
  },
  sectionFlush: {
    marginTop: 2,
  },
  sectionTitle: {
    ...TYPE.section,
    ...figtree('700'),
    color: colors.text,
    marginTop: 4,
    paddingHorizontal: 12,
  },
  rail: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  card: {
    width: 156,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    minHeight: 44,
    padding: 10,
    gap: 6,
    ...cardShadow,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Minimum bounds preserve the normal compact tile while allowing enlarged initials to breathe.
  avatar: {
    minWidth: 32,
    minHeight: 32,
    padding: 3,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...TYPE.body,
    ...figtree('700'),
    letterSpacing: 0.5,
  },
  meta: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  name: {
    color: colors.text,
    ...TYPE.body,
    ...figtree('700'),
  },
  handle: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('500'),
  },
  points: {
    ...TYPE.body,
    ...figtree('700'),
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  rank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  rankLabel: {
    ...TYPE.caption,
    ...figtree('800'),
  },
  badge: {
    flexGrow: 1,
    flexBasis: 80,
    minWidth: 80,
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.background,
  },
  badgeLabel: {
    ...TYPE.caption,
    ...figtree('800'),
  },
  modalRoot: {
    flex: 1,
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8, 12, 14, 0.55)',
  },
  peek: {
    borderWidth: 1.5,
    gap: 8,
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 2,
    maxWidth: 320,
    maxHeight: '85%',
    width: '100%',
  },
  peekScroll: { width: '100%', flexGrow: 0, flexShrink: 1 },
  peekContent: { alignItems: 'center', gap: 6, paddingBottom: 2 },
  peekKicker: {
    color: colors.primary,
    ...TYPE.caption,
    ...figtree('700'),
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  peekAvatar: {
    minWidth: 48,
    minHeight: 48,
    padding: 4,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  peekInitials: {
    ...TYPE.title,
    ...figtree('700'),
    letterSpacing: 1,
  },
  peekName: {
    maxWidth: '100%',
    color: colors.text,
    ...TYPE.title,
    ...figtree('700'),
    textAlign: 'center',
  },
  peekHandle: {
    maxWidth: '100%',
    textAlign: 'center',
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('500'),
  },
  peekBadge: {
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  peekBadgeLabel: {
    textAlign: 'center',
    ...TYPE.caption,
    ...figtree('700'),
  },
  peekPoints: {
    ...TYPE.section,
    ...figtree('700'),
  },
  peekClose: {
    marginTop: 4,
    alignSelf: 'stretch',
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: radii.md,
    backgroundColor: colors.deepGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekCloseLabel: {
    color: colors.onAccent,
    ...TYPE.body,
    ...figtree('700'),
  },
});
