/**
 * Spotlight → Boards: tabbed leaderboards (hype, views, highlights, schools, fans, filmers) with loading,
 * error + Retry, "open athlete", and a share of the current board's leader. Data arrives as props from
 * `hooks/useLeaderboards`; no money amounts are shown on any board.
 */

import { useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, View } from 'react-native';

import { ScrollFxItem } from '@/components/Effects/ScrollFx';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { EmptyState } from '@/components/UI/EmptyState';
import { cardShadow, colors, radii, space, SCOREBOARD_DIGITS } from '@/constants/theme';
import type { Leaderboards } from '@/lib/leaderboards';
import { boardShareMessage } from '@/lib/shareCard';
import { FOCAL, TAB_ACCENTS } from '@/theme/motion';

export type LeaderboardsTab = 'hype' | 'views' | 'highlights' | 'schools' | 'fans' | 'filmers';

const TABS: { id: LeaderboardsTab; label: string }[] = [
  { id: 'hype', label: 'Most hyped' },
  { id: 'views', label: 'Most viewed' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'schools', label: 'Schools' },
  { id: 'fans', label: 'Fans' },
  { id: 'filmers', label: 'Top Filmers 🎥' },
];

const EMPTY_COPY: Record<LeaderboardsTab, string> = {
  hype: 'No hype yet this week. Seki, Aura or Flex a Highlight to put an athlete on the board.',
  views: 'No views counted yet this week. Watch a few Highlights ⚡ and check back.',
  highlights: 'No Highlight has been watched this week yet.',
  schools: 'No school has scored yet this week. Hype your school’s Highlights to climb.',
  fans: 'No fans on the board yet. Tag a clip or hype a play to get on it.',
  filmers: 'No filmers yet this week. Film a teammate’s play, tag them, and climb when they confirm it.',
};

type Row = {
  key: string;
  title: string;
  subtitle: string;
  metric: string;
  onPress?: () => void;
};

function count(value: number, one: string, many: string): string {
  return `${value.toLocaleString()} ${value === 1 ? one : many}`;
}

function rowsFor(tab: LeaderboardsTab, boards: Leaderboards, onOpenAthlete: (playerId: string) => void): Row[] {
  switch (tab) {
    case 'hype':
      return boards.playersHype.map((row) => ({
        key: row.playerId,
        title: row.name,
        subtitle: [row.schoolName, `Seki ${row.seki} · Aura ${row.aura} · Flex ${row.flex}`].filter(Boolean).join(' · '),
        metric: count(row.hype, 'hype', 'hype'),
        onPress: () => onOpenAthlete(row.playerId),
      }));
    case 'views':
      return boards.playersViews.map((row) => ({
        key: row.playerId,
        title: row.name,
        subtitle: row.schoolName,
        metric: count(row.views, 'view', 'views'),
        onPress: () => onOpenAthlete(row.playerId),
      }));
    case 'highlights':
      return boards.highlights.map((row) => ({
        key: row.reelId,
        title: row.title,
        subtitle: [row.name, row.schoolName].filter(Boolean).join(' · '),
        metric: count(row.views, 'view', 'views'),
        onPress: row.playerId ? () => onOpenAthlete(row.playerId) : undefined,
      }));
    case 'schools':
      return boards.schools.map((row) => ({
        key: row.schoolName,
        title: row.schoolName,
        subtitle: `${count(row.hype, 'hype', 'hype')} · ${count(row.highlights, 'Highlight', 'Highlights')} · ${count(row.fans, 'fan', 'fans')}`,
        metric: `${row.score.toLocaleString()} pts`,
      }));
    case 'fans':
      return boards.fans.map((row) => ({
        key: row.profileId,
        title: row.name,
        subtitle: `${count(row.clipsTagged, 'clip', 'clips')} posted · ${count(row.hypeGiven, 'hype', 'hype')} given`,
        metric: `${row.score.toLocaleString()} pts`,
      }));
    case 'filmers':
      return (boards.filmers ?? []).map((row) => ({
        key: row.profileId,
        title: `🎥 ${row.name}`,
        subtitle: `${count(row.views, 'view', 'views')} · ${count(row.hype, 'hype', 'hype')} · ${count(row.props, 'Props', 'Props')}`,
        metric: `${row.score.toLocaleString()} pts`,
      }));
  }
}

type LeaderboardsBoardProps = {
  boards: Leaderboards | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenAthlete: (playerId: string) => void;
  onTabChange?: (tab: LeaderboardsTab) => void;
};

/**
 * @purpose Spotlight "Boards" (ROADMAP M1): this week's most-hyped and most-viewed athletes, most-viewed Highlights, school standings, top fans and Top Filmers. Ranks hype and views only — never Mālo.
 * @param boards Parsed `get_leaderboards` payload (`null` before the first load).
 * @param error Load failure copy; shows a Retry card instead of an empty board.
 * @param onOpenAthlete Athlete / Highlight row tap → profile.
 * @param onTabChange Segment change (telemetry).
 */
export function LeaderboardsBoard({ boards, loading, error, onRetry, onOpenAthlete, onTabChange }: LeaderboardsBoardProps) {
  const [tab, setTab] = useState<LeaderboardsTab>('hype');

  if (error && !boards) {
    return (
      <EmptyState
            compact
        kicker="Boards"
        title="The boards did not load"
        lede={error}
        actionLabel="Retry"
        onAction={onRetry}
        accent={TAB_ACCENTS.spotlight.color}
      />
    );
  }

  const rows = boards ? rowsFor(tab, boards, onOpenAthlete) : [];
  const leader = rows[0];
  const boardLabel = TABS.find((item) => item.id === tab)?.label ?? 'this board';

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.section}>Boards · This week</Text>
        {loading && boards ? <ActivityIndicator size="small" color={FOCAL.goldInk} /> : null}
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((item) => {
          const selected = item.id === tab;
          return (
            <AnimatedButton
              key={item.id}
              haptic="selection"
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              contentStyle={[styles.tab, selected && styles.tabSelected]}
              onPress={() => {
                setTab(item.id);
                onTabChange?.(item.id);
              }}
            >
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{item.label}</Text>
            </AnimatedButton>
          );
        })}
      </View>
      {leader ? (
        <AnimatedButton
          accessibilityLabel={`Share ${boardLabel}`}
          contentStyle={styles.share}
          onPress={() => { void Share.share({ message: boardShareMessage(boardLabel, leader.title) }); }}
        >
          <Text style={styles.shareText}>Share the leader</Text>
        </AnimatedButton>
      ) : null}
      {!boards && loading ? (
        <View style={styles.boot}>
          <ActivityIndicator color={FOCAL.goldInk} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{EMPTY_COPY[tab]}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((row, index) => (
            <ScrollFxItem key={`${tab}:${row.key}`} index={index} variant="rise">
              <AnimatedButton
                haptic={row.onPress ? 'light' : 'none'}
                disabled={!row.onPress}
                accessibilityLabel={`Rank ${index + 1}. ${row.title}. ${row.metric}.`}
                contentStyle={[styles.row, index === 0 && styles.rowFirst]}
                onPress={row.onPress}
              >
                <View style={[styles.rank, index === 0 && styles.rankFirst, index > 0 && index < 3 && styles.rankPodium]}>
                  <Text style={[styles.rankText, index === 0 && styles.rankTextFirst, index > 0 && index < 3 && styles.rankTextPodium]}>{index + 1}</Text>
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.title, index === 0 && styles.titleFirst]} numberOfLines={1}>
                    {row.title}
                  </Text>
                  {row.subtitle ? (
                    <Text style={[styles.subtitle, index === 0 && styles.subtitleFirst]} numberOfLines={1}>
                      {row.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.metric, index === 0 && styles.metricFirst]}>{row.metric}</Text>
              </AnimatedButton>
            </ScrollFxItem>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: {
    color: FOCAL.goldInk,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabSelected: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  tabText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextSelected: {
    color: colors.background,
  },
  boot: {
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    padding: space.md,
    borderRadius: radii.lg,
    backgroundColor: FOCAL.mistGold,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  list: {
    gap: 8,
  },
  share: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  shareText: { color: FOCAL.goldInk, fontWeight: '800' },
  row: {
    minHeight: 44,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  // #1 gets the dark "athlete of the week" card; gold marks the award, never body text on light.
  rowFirst: {
    backgroundColor: colors.videoSurface,
    borderColor: colors.videoSurface,
    paddingVertical: 18,
  },
  rank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FOCAL.mistSlate,
  },
  rankFirst: {
    backgroundColor: FOCAL.electricGold,
  },
  rankText: {
    ...SCOREBOARD_DIGITS,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  rankTextFirst: {
    color: FOCAL.ink,
    fontSize: 16,
  },
  rankPodium: {
    backgroundColor: FOCAL.mistGold,
  },
  rankTextPodium: {
    color: FOCAL.goldInk,
  },
  titleFirst: {
    color: colors.onVideo,
    fontSize: 17,
    fontWeight: '900',
  },
  subtitleFirst: {
    color: colors.onVideoMuted,
  },
  metricFirst: {
    color: FOCAL.electricGold,
    fontSize: 18,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  metric: {
    ...SCOREBOARD_DIGITS,
    color: colors.text,
    fontSize: 15,
  },
});
