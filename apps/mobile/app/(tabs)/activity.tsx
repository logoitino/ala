/** UX-19 groups the updates in one card with hairline dividers and uses the shared section heading.
 * UX-18 gives Activity rows less decoration/padding and a readable14pt primary/12pt metadata hierarchy.
 * Named Figtree faces remain consistent with the inbox; factual history and invitation actions stay separate. */
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
import { colors, radii, SCOREBOARD_DIGITS, space } from '@/constants/theme';
import { SECTION_HEADING, TYPE, figtree } from '@/theme/fonts';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { useActivityFeed, type ActivityItem, type ActivityKind } from '@/hooks/useActivityFeed';
import { useSurfaceUsage } from '@/hooks/useSurfaceUsage';
import { userProfileHref } from '@/lib/navigation';
import { FOCAL } from '@/theme/motion';
import { FriendRequestsCard } from '@/components/Activity/FriendRequestsCard';
import { ChallengeInbox } from '@/components/Challenges/ChallengeInbox';

const KIND_META: Record<ActivityKind, { icon: keyof typeof Ionicons.glyphMap; tint: string; ink: string; mist: string }> = {
  malo_received: { icon: 'gift', tint: FOCAL.neonJade, ink: FOCAL.jadeInk, mist: FOCAL.mistJade },
  malo_sent: { icon: 'heart', tint: FOCAL.neonJade, ink: FOCAL.jadeInk, mist: FOCAL.mistJade },
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

function ActivityRow({ item, onPress, divider = false }: { item: ActivityItem; onPress?: () => void; divider?: boolean }) {
  const meta = KIND_META[item.kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.body}`}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider && styles.rowDivider, item.actionable && styles.rowActionable, pressed && styles.rowPressed]}
    >
      <View style={[styles.rowIcon, { backgroundColor: meta.mist, borderColor: meta.tint }]}>
        <Ionicons name={meta.icon} size={16} allowFontScaling={false} color={meta.ink} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        {/* Only sent-gift school/source metadata uses caption size; thanks and confirmation instructions stay body size. */}
        <Text style={[styles.rowLede, item.kind === 'malo_sent' && styles.rowMetadata]}>
          {item.body}
        </Text>
        <View style={styles.rowDetails}>
          <Text style={styles.rowAgo}>{shortAgo(item.at)}</Text>
          {typeof item.amountCents === 'number' ? (
            <Text style={[styles.rowAmount, { color: meta.ink }]}>{formatUsd(item.amountCents)}</Text>
          ) : null}
        </View>
        {item.actionable ? <Text style={[styles.rowCta, { color: FOCAL.jadeInk }]}>Needs your confirmation</Text> : null}
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
              accent={FOCAL.jadeInk}
            />
          </ScrollFxParallax>
          <EmptyState
            compact
            kicker="Activity"
            title="Sign in to see your activity"
            lede="Gifts you receive, gifts you make, and highlights that tag you all land here."
            actionLabel="Sign in"
            onAction={() => requireAuth({ kind: 'signin', resume: () => undefined })}
            accent={FOCAL.jadeInk}
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
            tintColor={FOCAL.jadeInk}
            colors={[FOCAL.jadeInk]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <ScrollFxParallax>
          <ScreenHeading
            kicker={live.copy.activityKicker}
            title="Activity"
            lede={live.copy.activityLede}
            accent={FOCAL.jadeInk}
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
            <ActivityIndicator color={FOCAL.jadeInk} />
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
            accent={FOCAL.jadeInk}
          />
        ) : null}

        {!loading && items.length === 0 && !error ? (
          <EmptyState
            compact
            kicker="Activity"
            title="Nothing yet"
            lede="When a fan gives to you, an athlete thanks you, or a highlight tags you, it shows up here."
            accent={FOCAL.jadeInk}
          />
        ) : null}

        {items.length > 0 ? <Text accessibilityRole="header" style={styles.sectionTitle}>Your updates</Text> : null}
        {items.length > 0 ? <View testID="activity-updates-group" style={styles.group}>
        {items.map((item, index) => (
          <ScrollFxItem key={item.id} index={index} variant="rise">
            <ActivityRow
              item={item}
              divider={index > 0}
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
        </View> : null}
      </ScrollFxScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
    paddingBottom: 8,
    gap: 8,
  },
  sectionTitle: {
    ...SECTION_HEADING,
    color: colors.text,
    marginTop: 6,
  },
  // UX-19: one card holds every update; rows are separated by hairlines instead of each carrying its own border.
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  boot: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    minHeight: 44,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowActionable: {
    backgroundColor: FOCAL.mistJade,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    color: colors.text,
    ...TYPE.body,
    ...figtree('700'),
    includeFontPadding: false,
  },
  rowAgo: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('700'),
  },
  rowLede: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('400'),
    includeFontPadding: false,
  },
  rowMetadata: {
    ...TYPE.caption,
  },
  rowDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.xs,
  },
  rowCta: {
    ...TYPE.caption,
    ...figtree('800'),
    marginTop: 2,
  },
  rowAmount: {
    ...SCOREBOARD_DIGITS,
    ...TYPE.body,
    includeFontPadding: false,
    flexShrink: 1,
  },
});
