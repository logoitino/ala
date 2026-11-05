/** Compact violet Activity rows keep notifications, factual history and invitation actions separate. */
import { useIsFocused, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { CrewAlertsCard } from '@/components/Activity/CrewAlertsCard';
import { NotificationInbox } from '@/components/Activity/NotificationInbox';
import { AthleteMoneyCard } from '@/components/Custodial/AthleteMoneyCard';
import { AthleteVerificationCard } from '@/components/Verification/AthleteVerificationCard';
import { TeammateVouchCard } from '@/components/Verification/TeammateVouchCard';
import { ScrollFxItem, ScrollFxParallax, ScrollFxScrollView } from '@/components/Effects/ScrollFx';
import { RuntimePaused } from '@/components/RuntimePaused';
import { ScreenHeading } from '@/components/ScreenHeading';
import { TabScreen } from '@/components/TabScreen';
import { EmptyState } from '@/components/UI/EmptyState';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { cardShadow, colors, radii, SCOREBOARD_DIGITS } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { useActivityFeed, type ActivityItem, type ActivityKind } from '@/hooks/useActivityFeed';
import { useSurfaceUsage } from '@/hooks/useSurfaceUsage';
import { userProfileHref } from '@/lib/navigation';
import { FOCAL, TAB_ACCENTS } from '@/theme/motion';
import { FriendRequestsCard } from '@/components/Activity/FriendRequestsCard';
import { ChallengeInbox } from '@/components/Challenges/ChallengeInbox';

const ACCENT = TAB_ACCENTS.activity;

const KIND_META: Record<ActivityKind, { icon: keyof typeof Ionicons.glyphMap; tint: string; ink: string; mist: string }> = {
  malo_received: { icon: 'gift', tint: FOCAL.neonJade, ink: FOCAL.jadeInk, mist: FOCAL.mistJade },
  malo_sent: { icon: 'heart', tint: FOCAL.ember, ink: FOCAL.emberInk, mist: FOCAL.mistEmber },
  tag_pending: { icon: 'pricetag', tint: FOCAL.electricGold, ink: FOCAL.goldInk, mist: FOCAL.mistGold },
  thanks_received: { icon: 'happy', tint: FOCAL.neonJade, ink: FOCAL.jadeInk, mist: FOCAL.mistJade },
};

/** "3m", "5h", "2d" — short enough to sit on one line beside the title. */
function shortAgo(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.round(days / 7)}w`;
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function ActivityRow({ item, onPress }: { item: ActivityItem; onPress?: () => void }) {
  const meta = KIND_META[item.kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.body}`}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, item.actionable && styles.rowActionable, pressed && styles.rowPressed]}
    >
      <View style={[styles.rowIcon, { backgroundColor: meta.mist, borderColor: meta.tint }]}>
        <Ionicons name={meta.icon} size={20} color={meta.ink} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowLede}>
          {item.body}
        </Text>
        <View style={styles.rowDetails}>
          <Text style={styles.rowAgo}>{shortAgo(item.at)}</Text>
          {typeof item.amountCents === 'number' ? (
            <Text style={[styles.rowAmount, { color: meta.ink }]}>{formatUsd(item.amountCents)}</Text>
          ) : null}
        </View>
        {item.actionable ? <Text style={[styles.rowCta, { color: ACCENT.color }]}>Needs your confirmation</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * @purpose Activity — everything that happened to this fan's account recently: Mālo received,
 * Mālo they sent, and highlight tags waiting on a decision, newest first.
 * @remarks Existing factual rows derive from `useActivityFeed`; the separate notification inbox
 * owns read/archive state. Native push is deferred. Rows needing an action sort to the top.
 * @sideEffects `useActivityFeed` refetches its three sources on focus; rows deep-link into
 * the tagged highlight or the receipts screen. CHAL-01 adds actor-isolated accepted-friend workout invitations
 * through its verified admin contract; no free-text replies or money actions.
 */
export default function ActivityTab() {
  const router = useRouter();
  const { live } = useAppRuntime();
  const { user, profile, isAthlete, isGuest } = useAuth();
  const activityFocused = useIsFocused();
  const { requireAuth } = useSoftWall();
  const { onScroll, trackFeature } = useSurfaceUsage('activity');
  const { items, loading, error, refresh } = useActivityFeed();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  if (!live.tabs.activity) {
    return <TabScreen><RuntimePaused title="Activity" lede="Activity is off right now." adminHref="/admin/features" /></TabScreen>;
  }

  if (!user || isGuest) {
    return (
      <TabScreen>
        <ScrollFxScrollView contentContainerStyle={styles.content} onScroll={onScroll}>
          <ScrollFxParallax>
            <ScreenHeading
              kicker={live.copy.activityKicker}
              title="Activity"
              lede={live.copy.activityLede}
              accent={ACCENT.color}
            />
          </ScrollFxParallax>
          <EmptyState
            compact
            kicker="Activity"
            title="Sign in to see your activity"
            lede="Gifts you receive, gifts you make, and highlights that tag you all land here."
            actionLabel="Sign in"
            onAction={() => requireAuth({ kind: 'signin', resume: () => undefined })}
            accent={ACCENT.color}
          />
        </ScrollFxScrollView>
      </TabScreen>
    );
  }

  return (
    <TabScreen>
      <ScrollFxScrollView
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={ACCENT.color}
            colors={[ACCENT.color]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <ScrollFxParallax>
          <ScreenHeading
            kicker={live.copy.activityKicker}
            title="Activity"
            lede={live.copy.activityLede}
            accent={ACCENT.color}
          />
        </ScrollFxParallax>

        <NotificationInbox enabled={activityFocused} />
        {user ? <AthleteVerificationCard isAthlete={isAthlete} /> : null}
        {user ? <TeammateVouchCard /> : null}
        {user ? <FriendRequestsCard /> : null}
        <ChallengeInbox />
        {user ? <CrewAlertsCard /> : null}
        <AthleteMoneyCard playerId={profile?.player_id} />

        {loading && items.length === 0 ? (
          <View style={styles.boot}>
            <ActivityIndicator color={ACCENT.color} />
          </View>
        ) : null}

        {!loading && items.length === 0 && error ? (
          <EmptyState
            compact
            kicker="Activity"
            title="Could not load your activity"
            lede="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => void onRefresh()}
            accent={ACCENT.color}
          />
        ) : null}

        {!loading && items.length === 0 && !error ? (
          <EmptyState
            compact
            kicker="Activity"
            title="Nothing yet"
            lede="When a fan gives to you, an athlete thanks you, or a highlight tags you, it shows up here."
            accent={ACCENT.color}
          />
        ) : null}

        {items.length > 0 ? <Text accessibilityRole="header" style={styles.sectionTitle}>Your updates</Text> : null}
        {items.map((item, index) => (
          <ScrollFxItem key={item.id} index={index} variant="rise">
            <ActivityRow
              item={item}
              onPress={
                item.kind === 'malo_sent'
                  ? () => {
                      trackFeature('activity.receipts');
                      router.push('/receipts');
                    }
                  : item.kind === 'tag_pending'
                    ? () => {
                        trackFeature('activity.tag');
                        router.push('/profile');
                      }
                    : item.kind === 'malo_received'
                      ? () => {
                          // Say-thanks lives with the donor list on the athlete's own profile.
                          trackFeature('activity.thanks');
                          router.push('/profile');
                        }
                      : item.kind === 'thanks_received' && item.playerId
                        ? () => {
                            trackFeature('activity.thanks_received');
                            router.push(userProfileHref(item.playerId as string));
                          }
                        : undefined
              }
            />
          </ScrollFxItem>
        ))}
      </ScrollFxScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  boot: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    minHeight: 44,
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...cardShadow,
  },
  rowActionable: {
    borderColor: ACCENT.color,
    backgroundColor: ACCENT.mist,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  rowAgo: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  rowLede: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  rowDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  rowCta: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  rowAmount: {
    ...SCOREBOARD_DIGITS,
    fontSize: 16,
    lineHeight: 22,
    flexShrink: 1,
  },
});
