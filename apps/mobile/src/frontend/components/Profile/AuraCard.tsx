import { type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { SubscriberCrest } from '@/components/Profile/SubscriberCrest';
import { auraBadgeLabel, auraTierForPoints } from '@/lib/aura';
import { colors, radii } from '@/constants/theme';

type AuraCardProps = {
  name: string;
  jersey?: string | number;
  school?: string;
  position?: string;
  auraPoints?: number;
  stats?: Array<{ label: string; value: string | number }>;
  /** Neon Jade star on the avatar for exclusive subscribers. */
  subscriberCrest?: boolean;
  children?: ReactNode;
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

/**
 * @purpose Light 7-tier Aura trading card with optional Subscriber Crest on the avatar. Face wash follows `tier.face`.
 * @param subscriberCrest When true, renders a Neon Jade star on the avatar.
 */
export function AuraCard({
  name,
  jersey,
  school,
  position,
  auraPoints = 0,
  stats,
  subscriberCrest = false,
  children,
}: AuraCardProps) {
  const tier = auraTierForPoints(auraPoints);
  const badge = auraBadgeLabel(tier);
  const tick = 1.5;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${name}, ${badge}, ${auraPoints} aura points`}
      style={[
        styles.card,
        {
          backgroundColor: tier.face,
          borderColor: tier.color,
          ...Platform.select({
            ios: {
              shadowColor: tier.color,
              shadowOpacity: tier.tier >= 3 ? 0.35 : 0.12,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
            },
            android: { elevation: tier.tier >= 4 ? 8 : 3 },
            default: { boxShadow: `0px 4px 14px ${tier.glow}` },
          }),
        },
      ]}
    >
      <View pointerEvents="none" style={[styles.tick, styles.tickTl, { borderColor: tier.color, borderWidth: tick }]} />
      <View pointerEvents="none" style={[styles.tick, styles.tickTr, { borderColor: tier.color, borderWidth: tick }]} />
      <View pointerEvents="none" style={[styles.tick, styles.tickBl, { borderColor: tier.color, borderWidth: tick }]} />
      <View pointerEvents="none" style={[styles.tick, styles.tickBr, { borderColor: tier.color, borderWidth: tick }]} />

      <View style={[styles.badge, { borderColor: tier.color, backgroundColor: `${tier.color}22` }]}>
        <Text style={[styles.badgeLabel, { color: tier.ink }]}>{badge}</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { borderColor: tier.color }]}>
            <Text style={[styles.initials, { color: tier.ink }]}>{initialsFor(name)}</Text>
          </View>
          {subscriberCrest ? (
            <View style={styles.crest}>
              <SubscriberCrest size={11} />
            </View>
          ) : null}
        </View>
        <View style={styles.copy}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.meta}>
            {jersey != null && jersey !== '' ? `#${jersey}` : 'Athlete'}
            {position ? ` · ${position}` : ''}
          </Text>
          {school ? <Text style={styles.school}>{school}</Text> : null}
        </View>
      </View>

      {stats && stats.length > 0 ? (
        <View style={styles.stats}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text style={[styles.statValue, { color: tier.ink }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {children}
    </View>
  );
}

const TICK = 16;

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
    padding: 14,
    gap: 12,
    overflow: 'hidden',
  },
  tick: {
    position: 'absolute',
    width: TICK,
    height: TICK,
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
  badge: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 64,
    height: 64,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crest: {
    position: 'absolute',
    right: -5,
    top: -5,
  },
  initials: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  school: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
});
