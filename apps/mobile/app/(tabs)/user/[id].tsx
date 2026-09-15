import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { AthleteProfileView } from '@/components/Profile/AthleteProfileView';
import { ScreenShell } from '@/components/ScreenShell';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { useOptionalUploadSheet } from '@/context/UploadSheetContext';
import { markExclusiveClips } from '@/data/exclusive';
import { displayValue, type Player } from '@/data/players';
import { useAthleteStats } from '@/hooks/useAthleteStats';
import { useAthleteSubscription } from '@/hooks/useAthleteSubscription';
import { useTipCheckout } from '@/hooks/useTipCheckout';
import { fetchReelsForPlayer, playerFromReel, reelToClip, sortClipsNewestFirst, type ReelHype } from '@/lib/reels';
import { hydratePlayerHype } from '@/lib/hype';
import { handleFromName, resolveAuraPoints, subscribePlayerAura } from '@/lib/aura';
import { userProfileHref } from '@/lib/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Reel, ReelWithPlayer } from '@/types/database';

const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';

function mergeUploadedReel(
  rows: ReelWithPlayer[],
  uploaded: Reel | null | undefined,
  playerId: string,
  player: Player | null,
): ReelWithPlayer[] {
  if (!uploaded || uploaded.player_id !== playerId) return rows;
  const next: ReelWithPlayer = {
    ...uploaded,
    players: player,
  };
  if (rows.some((row) => row.id === uploaded.id)) {
    return rows.map((row) => (row.id === uploaded.id ? { ...row, ...next } : row));
  }
  return [next, ...rows].sort((left, right) => {
    const newer = Date.parse(right.created_at || '') || 0;
    const older = Date.parse(left.created_at || '') || 0;
    return newer - older;
  });
}

/**
 * @purpose Public athlete profile from any name tap: 3D trading card, Highlights ⚡ / Stats 📊 / Vault 🔒.
 * @sideEffects Loads player + reels + career stats; Soft-Wall then Stripe PaymentSheet for Vault; `add_user_aura` +100.
 */
export default function UserAthleteProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const playerId = Array.isArray(id) ? id[0] : id;
  const [player, setPlayer] = useState<Player | null>(null);
  const [reels, setReels] = useState<ReelWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { stats, loading: statsLoading } = useAthleteStats(playerId, player);
  const { subscribed, grant } = useAthleteSubscription(playerId);
  const { startCheckout, busy } = useTipCheckout();
  const { requireAuth } = useSoftWall();
  const { live } = useAppRuntime();
  const uploadSheet = useOptionalUploadSheet();

  const load = useCallback(async () => {
    if (!playerId) {
      setError('Missing athlete id.');
      setLoading(false);
      return;
    }

    setError(null);

    if (!isSupabaseConfigured) {
      setError(CONFIG_ERROR);
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase.from('players').select('*').eq('id', playerId).single();
    if (queryError || !data) {
      setPlayer(null);
      setReels([]);
      setError(queryError?.message ?? 'Athlete not found.');
      setLoading(false);
      return;
    }

    const nextPlayer = await hydratePlayerHype(data as Player);
    setPlayer(nextPlayer);
    const tagged = await fetchReelsForPlayer(playerId);
    setReels(mergeUploadedReel(tagged, uploadSheet?.lastUploaded, playerId, nextPlayer));
    setLoading(false);
  }, [playerId, uploadSheet?.lastUploaded]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    return subscribePlayerAura((auraId, auraPoints) => {
      setPlayer((current) =>
        current && current.id === auraId ? { ...current, aura_points: auraPoints } : current,
      );
    });
  }, []);

  useEffect(() => {
    if (!playerId) return;
    const unsubscribe = uploadSheet?.subscribeUploaded((reel) => {
      setReels((current) => mergeUploadedReel(current, reel, playerId, player));
    });
    return unsubscribe;
  }, [player, playerId, uploadSheet]);

  const clips = useMemo(
    () =>
      sortClipsNewestFirst(
        markExclusiveClips(
          reels.map((reel) => reelToClip(reel, playerFromReel(reel, player ? [player] : []))),
        ),
      ),
    [player, reels],
  );

  const unlockExclusive = () => {
    if (!player) return;
    requireAuth({
      kind: 'exclusive',
      athleteName: player.name,
      athleteId: player.id,
      resume: () => {
        void startCheckout({
          player,
          tipAmount: live.catalog.exclusiveDollars,
          coverFees: false,
          auraPoints: live.catalog.exclusiveAura,
          skipBacker: true,
          onPaid: grant,
        });
      },
    });
  };

  const applyHype = (reelId: string, hype: ReelHype) => {
    setReels((current) =>
      current.map((reel) =>
        reel.id === reelId
          ? {
              ...reel,
              seki_count: hype.seki_count,
              aura_count: hype.aura_count,
              flex_count: hype.flex_count,
              total_tips_cents: hype.total_tips_cents,
            }
          : reel,
      ),
    );
  };

  if (loading) {
    return (
      <ScreenShell style={styles.tabInset}>
        <View style={styles.missing}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.missingText}>Loading athlete…</Text>
        </View>
      </ScreenShell>
    );
  }

  if (error || !player) {
    return (
      <ScreenShell style={styles.tabInset}>
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>Couldn’t load athlete.</Text>
          <Text style={styles.missingText}>{error ?? 'Athlete not found.'}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void load()}
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  const displayName = displayValue(player.name);
  const bio = [displayValue(player.position), displayValue(player.school_name)]
    .filter((part) => part && part !== '—')
    .join(' · ');

  return (
    <ScreenShell style={styles.tabInset}>
      <Stack.Screen options={{ title: displayName }} />
      <ScrollView contentContainerStyle={styles.content}>
        <AthleteProfileView
          player={player}
          clips={clips}
          stats={stats}
          statsLoading={statsLoading}
          name={displayName}
          username={handleFromName(displayName)}
          jersey={player.jersey_number}
          bio={bio || undefined}
          role="athlete"
          roles={['athlete']}
          auraPoints={resolveAuraPoints(player)}
          teamName={player.school_name}
          subscriberCrest={subscribed}
          totalTipsReceived={player.backer_count ?? 0}
          sekiCount={player.seki_count ?? 0}
          subscribed={subscribed}
          vaultLocked={player.vault_locked}
          tipping={busy}
          vaultBusy={busy}
          onOpenAthlete={(nextId) => router.push(userProfileHref(nextId))}
          onHypeChange={applyHype}
          onUnlockVault={unlockExclusive}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  tabInset: {
    paddingBottom: 8,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 12,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  missingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  missingText: {
    color: colors.textMuted,
    textAlign: 'center',
  },
  retry: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    color: colors.onAccent,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.88,
  },
});
