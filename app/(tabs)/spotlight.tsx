import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ScreenHeading } from '@/components/ScreenHeading';
import { SpotlightAwardCard } from '@/components/Spotlight/SpotlightAwardCard';
import { SpotlightModal } from '@/components/Spotlight/SpotlightModal';
import { RuntimePaused } from '@/components/RuntimePaused';
import { TabScreen } from '@/components/TabScreen';
import { MaloTipModal } from '@/components/TipSheetModal';
import { colors } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useRoster } from '@/hooks/useRoster';
import { useSpotlightBoard } from '@/hooks/useSpotlightBoard';
import { userProfileHref } from '@/lib/navigation';
import type { Player, SpotlightAward } from '@/types/database';

/**
 * @purpose Fan-bar Spotlight tab: reopen Player of the Week/Month after the Highlights launch popup is dismissed.
 * @sideEffects `useSpotlightBoard` on focus; `SpotlightModal` replay; `MaloTipModal` PaymentSheet.
 */
export default function SpotlightTab() {
  const router = useRouter();
  const { live } = useAppRuntime();
  const { players, applyBackerCount } = useRoster();
  const { awards, loading, refresh } = useSpotlightBoard(players);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<SpotlightAward | null>(null);
  const [tipTarget, setTipTarget] = useState<{ player: Player; reelId?: string } | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const featured = awards[0] ?? null;
  const rest = awards.slice(1);

  if (!live.tabs.spotlight) {
    return (
      <RuntimePaused title="Spotlight is paused" lede="Turn Spotlight back on in Admin → Features, then Publish to app." />
    );
  }

  return (
    <TabScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <ScreenHeading
          kicker="Player of the Week"
          title="Spotlight"
          lede="Featured athletes from confirmed Game Play hype — week, month, and year."
        />
        {loading && awards.length === 0 ? (
          <View style={styles.boot}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
        {featured ? (
          <SpotlightAwardCard featured award={featured} onPress={() => setSelected(featured)} />
        ) : (
          <Text style={styles.empty}>No Spotlight awards yet. Check back after Friday night.</Text>
        )}
        {rest.length > 0 ? (
          <View style={styles.list}>
            <Text style={styles.section}>Recent Spotlights</Text>
            {rest.map((award) => (
              <SpotlightAwardCard key={award.id} award={award} onPress={() => setSelected(award)} />
            ))}
          </View>
        ) : null}
      </ScrollView>
      <SpotlightModal
        award={selected}
        visible={Boolean(selected)}
        replay
        onDismiss={() => setSelected(null)}
        onSupport={(player, reelId) => {
          setSelected(null);
          setTimeout(() => setTipTarget({ player, reelId }), 320);
        }}
        onWatch={(_reelId, playerId) => {
          const id = playerId || selected?.player_id;
          setSelected(null);
          if (id) {
            setTimeout(() => router.push(userProfileHref(id)), 280);
            return;
          }
          setTimeout(() => router.push('/'), 280);
        }}
      />
      <MaloTipModal
        player={tipTarget?.player ?? null}
        reelId={tipTarget?.reelId}
        onClose={() => setTipTarget(null)}
        onBacked={(nextCount) => {
          if (tipTarget) applyBackerCount(tipTarget.player.id, nextCount);
        }}
      />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 14,
  },
  boot: {
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  list: {
    gap: 10,
  },
  section: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
