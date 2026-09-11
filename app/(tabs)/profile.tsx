import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { DashboardPanel } from '@/components/DashboardPanel';
import { PlayerListItem } from '@/components/PlayerListItem';
import { TabScreen } from '@/components/TabScreen';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { displayValue } from '@/data/players';
import { useRoster } from '@/hooks/useRoster';
import { loadFavoritePlayerIds, saveFavoritePlayerIds } from '@/lib/favorites';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { TipLedgerEntry } from '@/types/database';

export default function MyHubTab() {
  const router = useRouter();
  const { profile } = useAuth();
  const { players } = useRoster();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [tips, setTips] = useState<TipLedgerEntry[]>([]);

  useEffect(() => {
    void loadFavoritePlayerIds().then(setFavoriteIds);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void supabase
      .from('tips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => setTips((data as TipLedgerEntry[] | null) ?? []));
  }, []);

  const favorites = useMemo(
    () => players.filter((player) => favoriteIds.includes(player.id)),
    [favoriteIds, players],
  );

  const spiritPoints = profile?.spirit_points ?? favorites.length * 10 + tips.length * 5;

  const toggleFavorite = (playerId: string) => {
    setFavoriteIds((current) => {
      const next = current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId];
      void saveFavoritePlayerIds(next);
      return next;
    });
  };

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Fan account</Text>
        <Text style={styles.heading}>My Hub</Text>

        <DashboardPanel title="Spirit Points" body="Earned by watching highlights and backing athletes.">
          <Text style={styles.points}>{spiritPoints} pts</Text>
        </DashboardPanel>

        <DashboardPanel title="Tipping history">
          {tips.length === 0 ? (
            <Text style={styles.muted}>Your $3 / $5 / $10 tips will land here after checkout.</Text>
          ) : (
            tips.map((tip) => {
              const player = players.find((item) => item.id === tip.player_id);
              return (
                <Text key={tip.id} style={styles.row}>
                  ${(tip.amount_cents / 100).toFixed(2)} · {displayValue(player?.name, 'Athlete')}
                </Text>
              );
            })
          )}
        </DashboardPanel>

        <DashboardPanel title="Favorited athletes">
          {favorites.length === 0 ? (
            <Text style={styles.muted}>Star players from a live game roster to pin them here.</Text>
          ) : (
            <View style={styles.list}>
              {favorites.map((player) => (
                <PlayerListItem
                  key={player.id}
                  player={player}
                  favorited
                  onToggleFavorite={() => toggleFavorite(player.id)}
                  onPress={() => router.push(`/player/${player.id}`)}
                />
              ))}
            </View>
          )}
        </DashboardPanel>
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14,
  },
  kicker: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
  },
  points: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  row: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  list: {
    gap: 10,
  },
});
