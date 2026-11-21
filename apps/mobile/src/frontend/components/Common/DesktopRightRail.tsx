/** UX-13 readable shared type preserves every action and required notice.
 * Expo web right rail for WEB-DESKTOP-01: live matchups, Top Aura Boosters, Vault pointer,
 * booster / school entry, Drip peek — real data only; no invented athletes or counts.
 */
import { type Href, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useLiveScores } from '@/hooks/useLiveScores';
import { useAuraBoosters } from '@/hooks/useAuraBoosters';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { colors, space } from '@/constants/theme';
import { FONT, TYPE } from '@/theme/fonts';
import type { Game } from '@/types/database';

function scoreLine(game: Game): string {
  const home = game.home_score ?? 0;
  const away = game.away_score ?? 0;
  const status = game.status || '';
  if (status === 'Final') return `${home}–${away} · Final`;
  const clock = game.clock?.trim();
  const quarter = game.quarter?.trim() || status;
  if (clock) return `${home}–${away} · ${quarter} ${clock}`;
  if (quarter) return `${home}–${away} · ${quarter}`;
  return `${home}–${away}`;
}

function teamPair(game: Game): string {
  const home = game.home_team?.trim() || game.home_school?.trim() || 'Home';
  const away = game.away_team?.trim() || game.away_school?.trim() || 'Away';
  return `${home} vs ${away}`;
}

/**
 * @purpose Right “live and close” rail for Expo web desktop / tablet drawer.
 */
export function DesktopRightRail() {
  const router = useRouter();
  const { live } = useAppRuntime();
  const { visibleGames, loading: scoresLoading, error: scoresError } = useLiveScores();
  const { boosters, loading: boostersLoading } = useAuraBoosters();
  const dripOn = live.tabs.drip !== false;

  const games = visibleGames.slice(0, 3);
  const topBoosters = boosters.slice(0, 5);

  return (
    <View style={styles.root} accessibilityLabel="Extras">
    <ScrollView
      style={styles.scrollFlex}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.lede}>Live and close — check between clips without leaving Highlights.</Text>

      <View style={styles.panel} accessibilityRole="summary">
        <Text style={styles.panelTitle}>Live matchups</Text>
        {scoresLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {scoresError ? <Text style={styles.muted}>{scoresError}</Text> : null}
        {!scoresLoading && !scoresError && games.length === 0 ? (
          <Text style={styles.muted}>No live or upcoming games in this read.</Text>
        ) : null}
        {games.map((game) => (
          <Pressable
            key={game.id}
            onPress={() => router.push(`/local/game/${game.id}` as Href)}
            accessibilityRole="link"
            accessibilityLabel={`${teamPair(game)}. ${scoreLine(game)}. Open game.`}
            style={styles.row}
          >
            <Text style={styles.rowMain}>
              {teamPair(game)}
            </Text>
            <Text style={styles.rowMeta}>{scoreLine(game)}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => router.push('/local')}
          accessibilityRole="link"
          accessibilityLabel="Open Local"
          style={styles.linkBtn}
        >
          <Text style={styles.linkText}>Open Local</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Top Aura Boosters</Text>
        <Text style={styles.muted}>
          Aura is earned by posting, cheering and showing up — never by giving money.
        </Text>
        {boostersLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {!boostersLoading && topBoosters.length === 0 ? (
          <Text style={styles.muted}>No boosters in this read yet.</Text>
        ) : null}
        {topBoosters.map((b, i) => (
          <View key={b.id} style={styles.row}>
            <Text style={styles.rowMain}>
              {i + 1}. {b.full_name}
            </Text>
            <Text style={styles.rowMeta}>{b.aura_points} pts</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Vault</Text>
        <Text style={styles.muted}>
          Locked Exclusive clips live on each athlete’s profile. This rail never invents a clip count.
        </Text>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="link"
          accessibilityLabel="Open Profile for Vault"
          style={styles.lockBtn}
        >
          <Ionicons name="lock-closed" size={18} color={colors.surface} />
          <Text style={styles.lockText}>Open Profile → Vault</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Booster program</Text>
        <Text style={styles.muted}>Program donations are web checkout only.</Text>
        <Pressable
          onPress={() => router.push('/booster')}
          accessibilityRole="link"
          accessibilityLabel="Open Booster HQ"
          style={styles.linkBtn}
        >
          <Text style={styles.linkText}>Open Booster</Text>
        </Pressable>
      </View>

      {dripOn ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Drip</Text>
          <Pressable
            onPress={() => router.push('/drip')}
            accessibilityRole="link"
            accessibilityLabel="Open Drip"
            style={styles.linkBtn}
          >
            <Text style={styles.linkText}>Browse Drip</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 320,
    flexShrink: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
    backgroundColor: colors.background,
  },
  scrollFlex: {
    flex: 1,
  },
  scroll: {
    padding: space.md,
    gap: space.md,
    paddingBottom: space.xl,
  },
  lede: {
    fontFamily: FONT.regular,
    ...TYPE.caption,
    color: colors.textMuted,

  },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: space.md,
    gap: space.sm,
  },
  panelTitle: {
    fontFamily: FONT.bold,
    ...TYPE.body,
    color: colors.text,
  },
  muted: {
    fontFamily: FONT.regular,
    ...TYPE.caption,
    color: colors.textMuted,

  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingVertical: 6,
    minHeight: 44,
  },
  rowMain: {
    flex: 1,
    fontFamily: FONT.medium,
    ...TYPE.body,
    color: colors.text,
  },
  rowMeta: {
    fontFamily: FONT.semibold,
    ...TYPE.caption,
    color: colors.primary,
  },
  linkBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    fontFamily: FONT.semibold,
    ...TYPE.body,
    color: colors.primary,
  },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.deepGreen,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: space.md,
    minHeight: 44,
  },
  lockText: {
    fontFamily: FONT.semibold,
    ...TYPE.body,
    color: colors.surface,
  },
});
