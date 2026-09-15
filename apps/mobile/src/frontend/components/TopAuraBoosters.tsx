import { useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';
import { useAuraBoosters } from '@/hooks/useAuraBoosters';
import { auraBadgeLabel, type AuraBooster } from '@/lib/aura';

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
      shadowOpacity: strong ? 0.35 : 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: strong ? 8 : 3 },
    default: { boxShadow: `0px 4px 14px ${glow}` },
  });
}

function AuraTicks({ color, size = 14, weight = 1.5 }: { color: string; size?: number; weight?: number }) {
  const tick = { width: size, height: size, borderColor: color, borderWidth: weight };
  return (
    <>
      <View pointerEvents="none" style={[styles.tick, styles.tickTl, tick]} />
      <View pointerEvents="none" style={[styles.tick, styles.tickTr, tick]} />
      <View pointerEvents="none" style={[styles.tick, styles.tickBl, tick]} />
      <View pointerEvents="none" style={[styles.tick, styles.tickBr, tick]} />
    </>
  );
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
  const badge = auraBadgeLabel(tier);
  const rankColor = rank === 1 ? FOCAL.electricGold : tier.color;

  return (
    <AnimatedPressable
      haptic="light"
      scaleTo={0.96}
      overshoot={false}
      accessibilityLabel={`${rank}. ${booster.full_name}, ${badge}, ${booster.aura_points} aura points`}
      onPress={onPress}
      contentStyle={[
        styles.card,
        { backgroundColor: tier.face, borderColor: tier.color, ...auraShadow(tier.color, tier.glow, tier.tier >= 3) },
      ]}
    >
      <AuraTicks color={tier.color} />
      <View style={styles.topRow}>
        <View style={[styles.rank, { borderColor: rankColor, backgroundColor: `${rankColor}22` }]}>
          <Text style={[styles.rankLabel, { color: rank === 1 ? FOCAL.goldInk : tier.ink }]}>#{rank}</Text>
        </View>
        <View style={[styles.badge, { borderColor: tier.color, backgroundColor: `${tier.color}22` }]}>
          <Text style={[styles.badgeLabel, { color: tier.ink }]}>{badge}</Text>
        </View>
      </View>

      <View style={styles.identity}>
        <View style={[styles.avatar, { borderColor: tier.color }]}>
          <Text style={[styles.initials, { color: tier.ink }]}>{initialsFor(booster.full_name)}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {booster.full_name}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          @{booster.username}
        </Text>
      </View>

      <Text style={[styles.points, { color: tier.ink }]}>{booster.aura_points.toLocaleString()} pts</Text>
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
  if (!booster) return null;
  const tier = booster.current_tier;
  const badge = auraBadgeLabel(tier);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          haptic="none"
          accessibilityLabel="Dismiss booster profile"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          accessibilityRole="summary"
          accessibilityLabel={`${booster.full_name} booster profile`}
          style={[
            styles.peek,
            { borderColor: tier.color, backgroundColor: tier.face, ...auraShadow(tier.color, tier.glow, true) },
          ]}
        >
          <AuraTicks color={tier.color} size={18} weight={2} />
          <Text style={styles.peekKicker}>Booster profile</Text>
          <View style={[styles.peekAvatar, { borderColor: tier.color }]}>
            <Text style={[styles.peekInitials, { color: tier.ink }]}>{initialsFor(booster.full_name)}</Text>
          </View>
          <Text style={styles.peekName}>{booster.full_name}</Text>
          <Text style={styles.peekHandle}>@{booster.username}</Text>
          <View style={[styles.peekBadge, { borderColor: tier.color, backgroundColor: `${tier.color}22` }]}>
            <Text style={[styles.peekBadgeLabel, { color: tier.ink }]}>
              #{rank} · {badge}
            </Text>
          </View>
          <Text style={[styles.peekPoints, { color: tier.ink }]}>{booster.aura_points.toLocaleString()} Aura pts</Text>
          <AnimatedButton accessibilityLabel="Close booster profile" onPress={onClose} contentStyle={styles.peekClose}>
            <Text style={styles.peekCloseLabel}>Close</Text>
          </AnimatedButton>
        </View>
      </View>
    </Modal>
  );
}

/**
 * @purpose Horizontal Top Aura Boosters rail with 7-tier light face washes and dynamic borders; tap scales the card and opens a booster peek.
 * @param hideTitle Hide the section heading when the Local hub pill already says Top Boosters.
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

const TICK = 14;

const styles = StyleSheet.create({
  section: {
    gap: 10,
    marginHorizontal: -16,
  },
  sectionFlush: {
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
    paddingHorizontal: 16,
  },
  rail: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  card: {
    width: 196,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    padding: 12,
    gap: 10,
    overflow: 'hidden',
  },
  tick: {
    position: 'absolute',
    zIndex: 2,
  },
  tickTl: {
    top: -1,
    left: -1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
  },
  tickTr: {
    top: -1,
    right: -1,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 10,
  },
  tickBl: {
    bottom: -1,
    left: -1,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
  },
  tickBr: {
    bottom: -1,
    right: -1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rank: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rankLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  badge: {
    flexShrink: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  identity: {
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  handle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  points: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalRoot: {
    flex: 1,
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8, 12, 14, 0.78)',
  },
  peek: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radii.lg,
    borderWidth: 2,
    padding: 22,
    gap: 10,
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 2,
  },
  peekKicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  peekAvatar: {
    width: 88,
    height: 88,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  peekInitials: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  peekName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  peekHandle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  peekBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  peekBadgeLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  peekPoints: {
    fontSize: 20,
    fontWeight: '800',
  },
  peekClose: {
    marginTop: 6,
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: radii.md,
    backgroundColor: colors.deepGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekCloseLabel: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '800',
  },
});
