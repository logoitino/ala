/** Web discovery complements the current page, groups existing shortcuts, and mounts data panels only when shown. Native uses its existing screens. */
import { type Href, usePathname, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useLiveScores } from '@/hooks/useLiveScores';
import { useAuraBoosters } from '@/hooks/useAuraBoosters';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { colors, space } from '@/constants/theme';
import { FONT, TYPE } from '@/theme/fonts';
import type { Game } from '@/types/database';

type Navigate = (href: Href) => void;

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

/** Only an eligible, visible panel subscribes to the existing scoreboard source. */
function LiveMatchupsPanel({ navigate, excludeGameId }: { navigate: Navigate; excludeGameId?: string }) {
  const { visibleGames, loading, error, refresh } = useLiveScores();
  const games = visibleGames.filter(game => game.id !== excludeGameId).slice(0, 3);
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.panelTitle}>Live matchups</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Loading matchups" color={colors.primary} /> : null}
    {error ? <>
      <Text accessibilityRole="alert" style={styles.muted}>{error}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry scoreboard" disabled={loading}
        accessibilityState={{ disabled: loading }} onPress={() => void refresh()} style={styles.linkBtn}>
        <Text style={styles.linkText}>Try again</Text>
      </Pressable>
    </> : null}
    {!loading && !error && games.length === 0 ? <Text style={styles.muted}>{excludeGameId ? 'No other live or upcoming games to show.' : 'No live or upcoming games to show.'}</Text> : null}
    {!error ? games.map(game => <Pressable key={game.id} onPress={() => navigate(`/local/game/${game.id}` as Href)}
      accessibilityRole="link" accessibilityLabel={`${teamPair(game)}. ${scoreLine(game)}. Open game.`} style={styles.row}>
      <Text style={styles.rowMain}>{teamPair(game)}</Text>
      <Text style={styles.rowMeta}>{scoreLine(game)}</Text>
    </Pressable>) : null}
    <Pressable onPress={() => navigate('/local')} accessibilityRole="link" accessibilityLabel="Open Local" style={styles.linkBtn}>
      <Text style={styles.linkText}>See more in Local</Text>
    </Pressable>
  </View>;
}

/** The existing community source retains its own loading and fallback contract. */
function CommunityPanel() {
  const { boosters, loading } = useAuraBoosters();
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.panelTitle}>Top Aura Boosters</Text>
    <Text style={styles.muted}>Aura is earned by posting, cheering and showing up — never by giving money.</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Loading boosters" color={colors.primary} /> : null}
    {!loading && boosters.length === 0 ? <Text style={styles.muted}>No boosters to show yet.</Text> : null}
    {boosters.slice(0, 5).map((booster, index) => <View key={booster.id} style={styles.row}>
      <Text style={styles.rowMain}>{index + 1}. {booster.full_name}</Text>
      <Text style={styles.rowMeta}>{booster.aura_points} pts</Text>
    </View>)}
  </View>;
}

/** Existing destinations share one discoverable group instead of repeating card titles and button labels. */
export function DesktopRightRail({ drawer = false, onNavigate }: { drawer?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { live } = useAppRuntime();
  const localHub = pathname === '/local' || pathname === '/local/index';
  const profilePage = pathname === '/profile' || pathname.startsWith('/profile/')
    || pathname.startsWith('/user/') || pathname.startsWith('/athlete/');
  const showLocalSummaries = live.tabs.local !== false && !localHub;
  const showMatchups = showLocalSummaries && live.layouts.liveMatches !== false;
  const showBoosters = showLocalSummaries && live.layouts.topBoosters !== false;
  const vaultOn = live.buttons.vault !== false;
  const gameId = pathname.startsWith('/local/game/') ? pathname.slice('/local/game/'.length).split('/')[0] : undefined;
  const navigate: Navigate = href => { router.push(href); onNavigate?.(); };
  const shortcuts = [
    ...(live.tabs.profile !== false && !profilePage ? [{ label: vaultOn ? 'Profile and Vault' : 'Profile', hint: vaultOn ? 'Exclusive clips live on athlete profiles.' : 'Your profile and posts.', href: '/profile' as Href, accessibilityLabel: vaultOn ? 'Open Profile for Vault' : 'Open Profile', icon: 'lock-closed-outline' as const }] : []),
    ...(!/^\/booster(?:\/|$)/.test(pathname) ? [{ label: 'Booster program', hint: 'Program donations are web checkout only.', href: '/booster' as Href, accessibilityLabel: 'Open Booster HQ', icon: 'business-outline' as const }] : []),
    ...(live.tabs.drip !== false && !/^\/(drip|shop)(?:\/|$)/.test(pathname) ? [{ label: 'Drip', hint: 'Browse the collection.', href: '/drip' as Href, accessibilityLabel: 'Open Drip', icon: 'shirt-outline' as const }] : []),
  ];
  return <View style={[styles.root, drawer && styles.drawerRoot]} accessibilityLabel="Extras">
    <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.lede}>Stay close to the action.</Text>
      {showMatchups ? <LiveMatchupsPanel navigate={navigate} excludeGameId={gameId} /> : null}
      {showBoosters ? <CommunityPanel /> : null}
      {shortcuts.length ? <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.panelTitle}>More from Tapua’i</Text>
        {shortcuts.map(shortcut => <Pressable key={shortcut.href as string} accessibilityRole="link"
          accessibilityLabel={shortcut.accessibilityLabel} onPress={() => navigate(shortcut.href)} style={styles.shortcut}>
          <Ionicons name={shortcut.icon} size={20} color={colors.primary} accessible={false} />
          <View style={styles.shortcutCopy}>
            <Text style={styles.rowMain}>{shortcut.label}</Text>
            <Text style={styles.muted}>{shortcut.hint}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} accessible={false} />
        </Pressable>)}
      </View> : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  drawerRoot: { width: '100%', flex: 1 },
  shortcut: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  shortcutCopy: { flex: 1, minWidth: 0, gap: 4 },
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
    minWidth: 0,
    fontFamily: FONT.medium,
    ...TYPE.body,
    color: colors.text,
  },
  rowMeta: {
    flexShrink: 1,
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
});
