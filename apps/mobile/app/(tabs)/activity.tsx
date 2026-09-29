import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AthleteMoneyCard } from '@/components/Custodial/AthleteMoneyCard';
import { AthleteVerificationCard } from '@/components/Verification/AthleteVerificationCard';
import { TeammateVouchCard } from '@/components/Verification/TeammateVouchCard';
import { ScrollFxItem, ScrollFxParallax, ScrollFxScrollView } from '@/components/Effects/ScrollFx';
import { RuntimePaused } from '@/components/RuntimePaused';
import { ScreenHeading } from '@/components/ScreenHeading';
import { TabScreen } from '@/components/TabScreen';
import { EmptyState } from '@/components/UI/EmptyState';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { cardShadow, colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { useActivityFeed, type ActivityItem, type ActivityKind } from '@/hooks/useActivityFeed';
import { useSurfaceUsage } from '@/hooks/useSurfaceUsage';
import { FOCAL, TAB_ACCENTS } from '@/theme/motion';

const ACCENT = TAB_ACCENTS.activity;

const KIND_META: Record<ActivityKind, { icon: keyof typeof Ionicons.glyphMap; tint: string }> = {
  malo_received: { icon: 'gift', tint: FOCAL.neonJade },
  malo_sent: { icon: 'heart', tint: FOCAL.ember },
  tag_pending: { icon: 'pricetag', tint: FOCAL.electricGold },
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
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, item.actionable && styles.rowActionable, pressed && styles.rowPressed]}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${meta.tint}1F`, borderColor: meta.tint }]}>
        <Ionicons name={meta.icon} size={18} color={meta.tint} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTopLine}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.rowAgo}>{shortAgo(item.at)}</Text>
        </View>
        <Text style={styles.rowLede} numberOfLines={2}>
          {item.body}
        </Text>
        {item.actionable ? <Text style={[styles.rowCta, { color: ACCENT.color }]}>Needs your confirmation</Text> : null}
      </View>
      {typeof item.amountCents === 'number' ? (
        <Text style={[styles.rowAmount, { color: meta.tint }]}>{formatUsd(item.amountCents)}</Text>
      ) : null}
    </Pressable>
  );
}

/**
 * @purpose Activity — everything that happened to this fan's account recently: Mālo received,
 * Mālo they sent, and highlight tags waiting on a decision, newest first.
 * @remarks Derived from existing tables (see `useActivityFeed`), so there is no read/unread
 * state and no push yet. Rows needing an action sort to the top instead.
 * @sideEffects `useActivityFeed` refetches its three sources on focus; rows deep-link into
 * the tagged highlight or the receipts screen.
 */
export default function ActivityTab() {
  const router = useRouter();
  const { live } = useAppRuntime();
  const { user, profile, isAthlete } = useAuth();
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
    return <RuntimePaused title="Activity" lede="Activity is off right now." adminHref="/admin/features" />;
  }

  if (!user) {
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
            kicker="Activity"
            title="Sign in to see your activity"
            lede="Mālo you receive, Mālo you send, and highlights that tag you all land here."
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

        {user ? <AthleteVerificationCard isAthlete={isAthlete} /> : null}
        {user ? <TeammateVouchCard /> : null}
        <AthleteMoneyCard playerId={profile?.player_id} />

        {loading && items.length === 0 ? (
          <View style={styles.boot}>
            <ActivityIndicator color={ACCENT.color} />
          </View>
        ) : null}

        {!loading && items.length === 0 && error ? (
          <EmptyState
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
            kicker="Activity"
            title="Nothing yet"
            lede="When a fan sends you Mālo, or a highlight tags you, it shows up here."
            accent={ACCENT.color}
          />
        ) : null}

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
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  boot: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
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
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  rowAgo: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  rowLede: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  rowCta: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '900',
  },
});
