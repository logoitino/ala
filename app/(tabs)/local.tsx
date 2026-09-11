import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { DashboardPanel } from '@/components/DashboardPanel';
import { GameCard } from '@/components/GameCard';
import { TabScreen } from '@/components/TabScreen';
import { colors, radii } from '@/constants/theme';
import { displayValue } from '@/data/players';
import { UTAH_REGIONS, gameInRegion, regionForZip, type UtahRegion } from '@/data/regions';
import { useLiveScores } from '@/hooks/useLiveScores';

export default function LocalTab() {
  const router = useRouter();
  const { games, loading, error } = useLiveScores();
  const [zip, setZip] = useState('');
  const [regionId, setRegionId] = useState<string | null>(null);

  const activeRegion: UtahRegion | null = useMemo(() => {
    const fromZip = regionForZip(zip);
    if (fromZip) return fromZip;
    return UTAH_REGIONS.find((region) => region.id === regionId) ?? null;
  }, [regionId, zip]);

  const nearbyGames = useMemo(() => {
    if (!activeRegion) return games;
    const matched = games.filter((game) => gameInRegion(game, activeRegion));
    return matched.length > 0 ? matched : games;
  }, [activeRegion, games]);

  const leaderboard = useMemo(
    () =>
      [...nearbyGames]
        .map((game) => ({
          id: game.id,
          label: `${displayValue(game.home_team)} vs ${displayValue(game.away_team)}`,
          margin: Math.abs((game.home_score ?? 0) - (game.away_score ?? 0)),
          leader:
            (game.home_score ?? 0) >= (game.away_score ?? 0)
              ? displayValue(game.home_team)
              : displayValue(game.away_team),
        }))
        .sort((a, b) => b.margin - a.margin)
        .slice(0, 5),
    [nearbyGames],
  );

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>Utah high school Friday</Text>
        <Text style={styles.heading}>Local</Text>

        <TextInput
          value={zip}
          onChangeText={(value) => {
            setZip(value);
            setRegionId(null);
          }}
          placeholder="ZIP code (e.g. 84043)"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={5}
          style={styles.search}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {UTAH_REGIONS.map((region) => {
            const selected = activeRegion?.id === region.id;
            return (
              <Pressable
                key={region.id}
                accessibilityRole="button"
                onPress={() => {
                  setZip('');
                  setRegionId(region.id);
                }}
                style={[styles.chip, selected && styles.chipOn]}
              >
                <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>{region.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <DashboardPanel
          title={activeRegion ? `${activeRegion.label} scores` : 'Nearby active games'}
          body={
            loading
              ? 'Loading live scores…'
              : error ?? `${nearbyGames.length} games in this area.`
          }
        >
          <View style={styles.list}>
            {nearbyGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onPress={() => router.push(`/game/${game.id}`)}
              />
            ))}
          </View>
        </DashboardPanel>

        <DashboardPanel title="Rivalry leaderboard" body="Biggest live margins in the selected region.">
          {leaderboard.length === 0 ? (
            <Text style={styles.muted}>No rivalry scores yet.</Text>
          ) : (
            leaderboard.map((row, index) => (
              <View key={row.id} style={styles.row}>
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={styles.meta}>
                  <Text style={styles.name}>{row.label}</Text>
                  <Text style={styles.muted}>
                    {row.leader} up by {row.margin}
                  </Text>
                </View>
              </View>
            ))
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
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    minHeight: 52,
    fontSize: 16,
    color: colors.text,
  },
  chips: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  chipLabelOn: {
    color: '#FFFFFF',
  },
  list: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rank: {
    width: 24,
    fontSize: 18,
    fontWeight: '800',
    color: colors.accent,
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
