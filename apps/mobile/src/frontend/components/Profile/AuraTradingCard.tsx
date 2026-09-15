import { type ReactNode, useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { GlowingCardWrapper } from '@/components/Profile/GlowingCardWrapper';
import { SubscriberCrest } from '@/components/Profile/SubscriberCrest';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { formatCompactCount } from '@/lib/hype';
import {
  auraBadgeLabel,
  auraProgressTowardNext,
  auraTierForPoints,
  type AuraTier,
} from '@/lib/aura';
import type { UserRole } from '@/types/database';
import { FOCAL, SPRING_FLIP } from '@/theme/motion';

const TICK = 16;
const PERSPECTIVE = 1000;

export type TradingCardBadge = {
  emoji: string;
  label: string;
  earned: boolean;
};

export type AuraTradingCardProps = {
  name: string;
  username?: string | null;
  roleTag?: 'Athlete' | 'Fan' | 'Booster' | string;
  role?: UserRole;
  /** Dual badges, e.g. `['fan', 'athlete']`. */
  roles?: string[] | null;
  auraPoints?: number;
  /** Highlight views — shown on Profile, not on the feed overlay. */
  highlightViews?: number;
  jersey?: string | number;
  subscriberCrest?: boolean;
  bio?: string;
  gamesPlayed?: number;
  highlightReels?: number;
  totalTipsReceived?: number;
  totalTipsDropped?: number;
  pollVotes?: number;
  seasonPoints?: number;
  reelsUploaded?: number;
  auraRank?: string;
  sekiCount?: number;
  badges?: TradingCardBadge[];
  teamName?: string | null;
  mascot?: string | null;
  divisionBadge?: string | null;
  /** Compact Games / scoring / volume preview on the back face (Stats 📊). */
  careerPreview?: { label: string; value: string | number }[];
  /** Force the Skia sweep on (Celestial Prism). Defaults to Aura tier 7. */
  isAuraMaxed?: boolean;
  /** Locker Room item fully funded — same pulse as max Aura. */
  wishlistFulfilled?: boolean;
};

export type RoleBadge = {
  emoji: string;
  label: string;
};

/**
 * @purpose Map app roles onto the three trading-card tags (Athlete / Fan / Booster).
 * @param role Current `UserRole` from auth.
 * @returns Face chip copy.
 */
export function tradingCardRoleTag(role: UserRole | null | undefined): 'Athlete' | 'Fan' | 'Booster' {
  if (role === 'athlete') return 'Athlete';
  if (role === 'booster') return 'Booster';
  return 'Fan';
}

/**
 * @purpose Fan ⚡ and Athlete 🏆 chips when both roles are active.
 * @param roles Dual `roles` list from auth.
 * @param fallbackRole Single role when `roles` is empty.
 */
export function tradingCardRoleBadges(
  roles?: string[] | null,
  fallbackRole?: UserRole | string | null,
): RoleBadge[] {
  const set = new Set((roles ?? []).map((item) => item.toLowerCase()));
  if (set.size === 0 && fallbackRole) set.add(String(fallbackRole).toLowerCase());
  const badges: RoleBadge[] = [];
  if (set.has('fan')) badges.push({ emoji: '⚡', label: 'Fan' });
  if (set.has('athlete')) badges.push({ emoji: '🏆', label: 'Athlete' });
  if (set.has('booster') && badges.length === 0) badges.push({ emoji: '⚡', label: 'Booster' });
  if (badges.length === 0) badges.push({ emoji: '⚡', label: 'Fan' });
  return badges;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

function fireMidFlipHaptic() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Simulator / web may not expose haptics.
  }
}

function CardChrome({ tier, children }: { tier: AuraTier; children: ReactNode }) {
  const tick = 1.5;
  return (
    <View
      style={[
        styles.face,
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
      <View style={[styles.tierBadge, { borderColor: tier.color, backgroundColor: `${tier.color}22` }]}>
        <Text style={[styles.tierBadgeLabel, { color: tier.ink }]}>{auraBadgeLabel(tier)}</Text>
      </View>
      {children}
    </View>
  );
}

/**
 * @purpose Interactive 7-tier Aura trading card with a 3D `rotateY` flip (front identity / back season stats). Each band uses a light `face` wash + `ink` so the collectible stays fun on Daylight (Obsidian stays on Highlights ⚡).
 * @param name Display name on the front face.
 * @param username Handle shown as `@username`.
 * @param roleTag Athlete / Fan / Booster chip. Falls back to `role` / `roles` when omitted.
 * @param roles Dual Fan + Athlete badges when both are active.
 * @param auraPoints Drives the dynamic border, progress bar, and default MVP badge.
 * @param teamName / mascot / divisionBadge HS or NCAA identity from `schools_and_teams` (both faces).
 * @param careerPreview Top 3 career stats (Games / Points or Tries / Yards or Tackles) on the back face.
 * @param isAuraMaxed / wishlistFulfilled Lights the Skia neon sweep (`GlowingNeonBorder`) and pulses stroke thickness.
 * @returns Flippable card plus **Flip Card 🔄**. Tap the body or the button to flip.
 * @sideEffects Reanimated `withSpring` `rotateY` 0↔180 (`SPRING_FLIP`, `perspective: 1000`); `Haptics.impactAsync(Medium)` exactly when the rotation crosses 90°; back-face Season Points / Total Tipped fade in with `withDelay`; Skia canvas when the glow is on.
 */
export function AuraTradingCard({
  name,
  username,
  roleTag,
  role,
  roles,
  auraPoints = 0,
  highlightViews = 0,
  jersey,
  subscriberCrest = false,
  bio,
  gamesPlayed = 0,
  highlightReels = 0,
  totalTipsReceived = 0,
  totalTipsDropped = 0,
  pollVotes = 0,
  seasonPoints,
  reelsUploaded,
  auraRank,
  sekiCount = 0,
  badges,
  teamName,
  mascot,
  divisionBadge,
  careerPreview,
  isAuraMaxed,
  wishlistFulfilled = false,
}: AuraTradingCardProps) {
  const tier = auraTierForPoints(auraPoints);
  const progress = auraProgressTowardNext(auraPoints);
  const auraMaxed = isAuraMaxed ?? progress.next == null;
  const rotateY = useSharedValue(0);
  const seasonFade = useSharedValue(0);
  const tippedFade = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);
  const [frontH, setFrontH] = useState(200);
  const [backH, setBackH] = useState(280);
  const spinning = useSharedValue(false);
  const handle = (username ?? '').replace(/^@/, '').trim() || name.trim().split(/\s+/)[0]?.toLowerCase() || 'athlete';
  const roleBadges = tradingCardRoleBadges(roles, role ?? roleTag);
  const isFan = roleBadges.some((item) => item.label === 'Fan');
  const isAthleteFace = roleBadges.some((item) => item.label === 'Athlete');
  const tag = roleTag ?? tradingCardRoleTag(role);
  const rankLabel = auraRank ?? `Tier ${tier.tier}`;
  const athletePoints = seasonPoints ?? auraPoints;
  const uploaded = reelsUploaded ?? highlightReels;
  const bioCopy =
    bio?.trim() ||
    `${isFan && isAthleteFace ? 'Fan and athlete' : tag} on Tapua'i. Back every Friday, chase the next Aura band.`;
  const mascotLabel = mascot?.trim() ?? '';
  const schoolLabel = teamName?.trim() ?? '';
  const teamLine =
    schoolLabel && mascotLabel && !schoolLabel.toLowerCase().includes(mascotLabel.toLowerCase())
      ? `${schoolLabel} · ${mascotLabel}`
      : schoolLabel || mascotLabel;
  const divisionLine = divisionBadge?.trim() ?? '';
  const earnedBadges =
    badges ??
    ([
      { emoji: '⚡', label: 'First Mālo Tip', earned: totalTipsDropped > 0 || totalTipsReceived > 0 },
      { emoji: '🏆', label: 'Season MVP', earned: auraPoints >= 70 },
      { emoji: '🤙', label: 'Seki Contender', earned: sekiCount >= 3 },
    ] satisfies TradingCardBadge[]);

  useAnimatedReaction(
    () => rotateY.value,
    (current, previous) => {
      if (previous == null) return;
      const crossedUp = previous < 90 && current >= 90;
      const crossedDown = previous > 90 && current <= 90;
      if (crossedUp || crossedDown) runOnJS(fireMidFlipHaptic)();
      if (crossedUp) {
        seasonFade.value = 0;
        tippedFade.value = 0;
        seasonFade.value = withDelay(90, withTiming(1, { duration: 280 }));
        tippedFade.value = withDelay(220, withTiming(1, { duration: 280 }));
      }
      if (crossedDown) {
        seasonFade.value = 0;
        tippedFade.value = 0;
      }
    },
  );

  const finishSpin = useCallback(() => {
    spinning.value = false;
  }, [spinning]);

  const flip = useCallback(() => {
    if (spinning.value) return;
    spinning.value = true;
    const showingBack = rotateY.value >= 90;
    const next = showingBack ? 0 : 180;
    rotateY.value = withSpring(next, { ...SPRING_FLIP, overshootClamping: true }, (finished) => {
      if (finished) runOnJS(finishSpin)();
    });
    setFlipped(next === 180);
  }, [finishSpin, rotateY, spinning]);

  const tapToFlip = Gesture.Tap()
    .maxDuration(320)
    .maxDistance(18)
    .onEnd((_event, success) => {
      if (!success) return;
      runOnJS(flip)();
    });

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: PERSPECTIVE }, { rotateY: `${rotateY.value}deg` }],
    opacity: rotateY.value < 90 ? 1 : 0,
    zIndex: rotateY.value < 90 ? 2 : 0,
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: PERSPECTIVE }, { rotateY: `${rotateY.value + 180}deg` }],
    opacity: rotateY.value >= 90 ? 1 : 0,
    zIndex: rotateY.value >= 90 ? 2 : 0,
  }));

  return (
    <View style={styles.wrap}>
      <GlowingCardWrapper isAuraMaxed={auraMaxed} isWishlistFulfilled={wishlistFulfilled}>
        <GestureDetector gesture={tapToFlip}>
        <View
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${auraBadgeLabel(tier)}, ${flipped ? 'season stats' : 'identity'} face. Tap to flip.`}
          collapsable={false}
          style={[styles.stage, { height: flipped ? backH : frontH }]}
        >
          <Animated.View style={[styles.faceLayer, frontStyle, { pointerEvents: flipped ? 'none' : 'auto' }]}>
            <View
              onLayout={(event) => {
                const next = Math.ceil(event.nativeEvent.layout.height);
                setFrontH((prev) => (prev === next ? prev : next));
              }}
            >
              <CardChrome tier={tier}>
                <View style={styles.identity}>
                  <View style={styles.avatarWrap}>
                    <View style={[styles.avatar, { borderColor: tier.color }]}>
                      <Text style={[styles.initials, { color: tier.ink }]}>{initialsFor(name)}</Text>
                    </View>
                    {jersey != null && jersey !== '' ? (
                      <View style={[styles.jerseyChip, { borderColor: tier.color }]}>
                        <Text style={[styles.jerseyLabel, { color: tier.ink }]}>#{jersey}</Text>
                      </View>
                    ) : null}
                    {subscriberCrest ? (
                      <View style={styles.crest}>
                        <SubscriberCrest size={11} />
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.name}>{name}</Text>
                    <Text style={styles.handle}>@{handle}</Text>
                    <View style={styles.roleRow}>
                      {roleBadges.map((badge) => (
                        <View key={badge.label} style={[styles.roleTag, { borderColor: FOCAL.jadeInk }]}>
                          <Text style={[styles.roleTagLabel, { color: FOCAL.jadeInk }]}>
                            {badge.label} {badge.emoji}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {teamLine ? (
                      <View style={styles.teamBlock}>
                        <Text style={styles.teamLine} numberOfLines={1}>
                          {teamLine}
                        </Text>
                        {divisionLine ? <Text style={styles.divisionBadge}>{divisionLine}</Text> : null}
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.progressBlock}>
                  <View style={styles.progressMeta}>
                    <Text style={styles.progressLabel}>
                      {auraPoints.toLocaleString()} Aura · {formatCompactCount(highlightViews)} views
                    </Text>
                    <Text style={[styles.progressHint, { color: tier.ink }]}>
                      {progress.next
                        ? `${Math.round(progress.ratio * 100)}% to ${progress.next.title}`
                        : 'Celestial Prism'}
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${Math.round(progress.ratio * 100)}%`, backgroundColor: tier.color },
                      ]}
                    />
                  </View>
                </View>
              </CardChrome>
            </View>
          </Animated.View>

          <Animated.View style={[styles.faceLayer, backStyle, { pointerEvents: flipped ? 'auto' : 'none' }]}>
            <View
              onLayout={(event) => {
                const next = Math.ceil(event.nativeEvent.layout.height);
                setBackH((prev) => (prev === next ? prev : next));
              }}
            >
              <CardChrome tier={tier}>
                <Text style={styles.backKicker}>
                  {rankLabel}
                  {teamLine ? ` · ${teamLine}` : ''}
                  {divisionLine ? ` · ${divisionLine}` : isFan && isAthleteFace ? ' · Fan + athlete sheet' : ' · Season sheet'}
                </Text>
                <View style={styles.grid}>
                  {careerPreview && careerPreview.length > 0
                    ? careerPreview.slice(0, 3).map((stat, index) => (
                        <StatCell
                          key={stat.label}
                          color={index === 0 ? FOCAL.jadeInk : tier.ink}
                          label={stat.label}
                          value={stat.value}
                          highlight={index === 0}
                          appear={index === 0 ? seasonFade : undefined}
                        />
                      ))
                    : null}
                  <StatCell
                    color={FOCAL.jadeInk}
                    label="Season Points"
                    value={athletePoints}
                    highlight
                    appear={careerPreview?.length ? tippedFade : seasonFade}
                  />
                  <StatCell color={tier.ink} label="Highlights ⚡" value={uploaded} />
                  <StatCell
                    color={FOCAL.jadeInk}
                    label={isFan ? 'Total Tipped' : 'Tips Received'}
                    value={isFan ? totalTipsDropped : totalTipsReceived}
                    highlight
                    appear={tippedFade}
                  />
                  {isFan ? <StatCell color={tier.ink} label="Tips Received" value={totalTipsReceived} /> : null}
                  {isFan ? <StatCell color={tier.ink} label="Poll Votes" value={pollVotes} /> : null}
                  {gamesPlayed > 0 && !(careerPreview && careerPreview.length > 0) ? (
                    <StatCell color={tier.ink} label="Games Played" value={gamesPlayed} />
                  ) : null}
                </View>
                <Text style={styles.bioLabel}>Bio</Text>
                <Text style={styles.bio}>{bioCopy}</Text>
                <Text style={styles.bioLabel}>Earned Badges</Text>
                <View style={styles.badgeRow}>
                  {earnedBadges.map((badge) => (
                    <View
                      key={badge.label}
                      style={[styles.earned, !badge.earned && styles.earnedOff, { borderColor: tier.color }]}
                    >
                      <Text style={styles.earnedEmoji}>{badge.emoji}</Text>
                      <Text style={[styles.earnedLabel, !badge.earned && styles.earnedLabelOff]}>{badge.label}</Text>
                    </View>
                  ))}
                </View>
              </CardChrome>
            </View>
          </Animated.View>
        </View>
        </GestureDetector>
      </GlowingCardWrapper>

      <AnimatedButton
        accessibilityLabel={flipped ? 'Show identity face' : 'Flip card'}
        haptic="none"
        onPress={flip}
        contentStyle={styles.flipBtn}
      >
        <Text style={styles.flipLabel}>Flip Card 🔄</Text>
      </AnimatedButton>
    </View>
  );
}

function StatCell({
  color,
  label,
  value,
  highlight = false,
  appear,
}: {
  color: string;
  label: string;
  value: string | number;
  highlight?: boolean;
  appear?: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const t = appear ? appear.value : 1;
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 10 }],
    };
  });

  return (
    <Animated.View style={[styles.stat, highlight && styles.statHot, style]}>
      <Text style={[styles.statValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, highlight && styles.statLabelHot]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    overflow: 'visible',
  },
  stage: {
    position: 'relative',
    width: '100%',
  },
  faceLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backfaceVisibility: 'hidden',
  },
  face: {
    borderRadius: radii.lg,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
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
  tierBadge: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tierBadgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 72,
    height: 72,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyChip: {
    position: 'absolute',
    right: -6,
    bottom: -4,
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  jerseyLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  crest: {
    position: 'absolute',
    right: -5,
    top: -5,
  },
  initials: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  handle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  teamBlock: {
    gap: 4,
    marginTop: 4,
  },
  teamLine: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  divisionBadge: {
    color: FOCAL.jadeInk,
    fontSize: 11,
    fontWeight: '800',
  },
  roleTag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleTagLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  progressBlock: {
    gap: 6,
    marginTop: 4,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  progressLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  progressHint: {
    fontSize: 11,
    fontWeight: '700',
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 999,
  },
  backKicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stat: {
    width: '48%',
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statHot: {
    borderWidth: 1,
    borderColor: FOCAL.jadeInk,
    backgroundColor: FOCAL.mistJade,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabelHot: {
    color: FOCAL.jadeInk,
  },
  bioLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bio: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  earned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: colors.surface,
  },
  earnedOff: {
    opacity: 0.42,
  },
  earnedEmoji: {
    fontSize: 12,
  },
  earnedLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  earnedLabelOff: {
    color: colors.textMuted,
  },
  flipBtn: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    backgroundColor: FOCAL.mistGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipLabel: {
    color: FOCAL.goldInk,
    fontSize: 14,
    fontWeight: '800',
  },
});
