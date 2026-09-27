import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';

import { ScrollFxParallax, ScrollFxScrollView } from '@/components/Effects/ScrollFx';
import { AthleteProfileView } from '@/components/Profile/AthleteProfileView';
import { TabScreen } from '@/components/TabScreen';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { useOptionalUploadSheet } from '@/context/UploadSheetContext';
import { markExclusiveClips } from '@/data/exclusive';
import { displayValue, type Player } from '@/data/players';
import { useAthleteStats } from '@/hooks/useAthleteStats';
import { useAthleteSubscription } from '@/hooks/useAthleteSubscription';
import { useRoster } from '@/hooks/useRoster';
import { useTipCheckout } from '@/hooks/useTipCheckout';
import { fetchReelsForPlayer, playerFromReel, reelToClip, sortClipsNewestFirst, type ReelHype } from '@/lib/reels';
import { hydratePlayerHype } from '@/lib/hype';
import { handleFromName, isAuraUuid, resolveAuraPoints, subscribePlayerAura } from '@/lib/aura';
import { userProfileHref } from '@/lib/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { fetchPlayerVerification } from '@/lib/verification';
import type { Reel, ReelWithPlayer, ProfilePublic } from '@/types/database';

// 2026-09 fix: this used to be shown directly (`{error}`) in the "Couldn't load athlete" screen,
// leaking a developer-facing setup instruction to end users whenever Supabase wasn't configured.
// The raw detail is still logged for debugging; only this friendly copy ever reaches the UI now
// (see the matching fix in `useLiveScores.ts` for the Local tab's equivalent leak).
const CONFIG_ERROR =
  'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart Expo.';
const FRIENDLY_CONFIG_ERROR = 'This app isn’t connected right now. Please try again later.';

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
 * @purpose Public athlete sheet from any name tap — same `AthleteProfileView` as the Profile tab (back instead of hamburger).
 * @sideEffects Loads player + reels + career stats + claimed avatar; Stripe PaymentSheet for Mālo / exclusive; `add_user_aura` +100. Ignores non-UUID ids (Spotlight used to pass `spotlight-{award.id}`).
 */
export default function UserAthleteProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const rawId = Array.isArray(id) ? id[0] : id;
  const playerId = rawId && isAuraUuid(rawId) ? rawId : undefined;
  const [player, setPlayer] = useState<Player | null>(null);
  const [reels, setReels] = useState<ReelWithPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'unverified' | 'pending' | 'verified'>('unverified');
  const [schoolClaimed, setSchoolClaimed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [publicProfile, setPublicProfile] = useState<ProfilePublic | null>(null);
  const { stats, loading: statsLoading } = useAthleteStats(playerId, player);
  const { subscribed, grant } = useAthleteSubscription(playerId);
  const { startCheckout, busy } = useTipCheckout();
  const { live } = useAppRuntime();
  const { isAthlete } = useAuth();
  const { requireAuth } = useSoftWall();
  const { players: rosterPlayers, applyBackerCount } = useRoster();
  const uploadSheet = useOptionalUploadSheet();

  const load = useCallback(async () => {
    if (!playerId) {
      setError(
        rawId
          ? 'This Spotlight highlight is not linked to an athlete profile yet. Watch the clip from Spotlight instead.'
          : 'Missing athlete id.',
      );
      setLoading(false);
      return;
    }

    setError(null);

    if (!isSupabaseConfigured) {
      console.warn('[UserAthleteProfileScreen]', CONFIG_ERROR);
      setError(FRIENDLY_CONFIG_ERROR);
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
    const verification = await fetchPlayerVerification(playerId, nextPlayer.name);
    setVerificationStatus(verification.status);
    setSchoolClaimed(verification.schoolClaimed);
    setAvatarUrl(verification.avatarUrl);
    const { data: publicRow } = await supabase
      .from('profiles_public')
      .select('*')
      .eq('player_id', playerId)
      .maybeSingle();
    setPublicProfile((publicRow as ProfilePublic | null) ?? null);
    setLoading(false);
  }, [playerId, rawId, uploadSheet?.lastUploaded]);

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

  const dropMalo = () => {
    if (!player) return;
    const amount = live.catalog.maloAmounts[0] ?? 5;
    requireAuth({
      kind: 'malo',
      athleteName: player.name,
      athleteId: player.id,
      resume: () => {
        void startCheckout({
          player,
          tipAmount: amount,
          coverFees: false,
          onBacked: (nextCount) => {
            applyBackerCount(player.id, nextCount);
            setPlayer((current) => (current ? { ...current, backer_count: nextCount } : current));
          },
        });
      },
    });
  };

  const unlockExclusive = () => {
    if (!player) return;
    requireAuth({
      kind: 'signin',
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
      <TabScreen>
        <View style={styles.missing}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.missingText}>Loading athlete…</Text>
        </View>
      </TabScreen>
    );
  }

  if (error || !player) {
    return (
      <TabScreen>
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
      </TabScreen>
    );
  }

  const displayName = displayValue(player.name);
  const schoolVisible = publicProfile?.school_visible ?? true;
  const bio = [displayValue(player.position), schoolVisible ? displayValue(player.school_name) : null]
    .filter((part) => part && part !== '—')
    .join(' · ');

  return (
    <TabScreen>
      <ScrollFxScrollView contentContainerStyle={styles.content}>
        <ScrollFxParallax factor={0} fadeOver={0}>
        <AthleteProfileView
          player={player}
          clips={clips}
          stats={stats}
          statsLoading={statsLoading}
          name={displayName}
          username={handleFromName(displayName)}
          jersey={player.jersey_number}
          bio={bio || undefined}
          aboutBio={publicProfile?.bio}
          socialLinks={publicProfile?.social_links}
          role="athlete"
          roles={['athlete']}
          auraPoints={resolveAuraPoints(player)}
          teamName={schoolVisible ? player.school_name : undefined}
          subscriberCrest={subscribed}
          totalTipsReceived={player.backer_count ?? 0}
          sekiCount={player.seki_count ?? 0}
          subscribed={subscribed}
          vaultLocked={player.vault_locked}
          tipping={busy}
          vaultBusy={busy}
          rosterPlayers={rosterPlayers}
          showClaimBadges={isAthlete}
          verificationStatus={verificationStatus}
          schoolClaimed={schoolClaimed}
          avatarUrl={avatarUrl}
          onBack={() => router.back()}
          onDropMalo={dropMalo}
          onSubscribe={unlockExclusive}
          onOpenAthlete={(nextId) => router.push(userProfileHref(nextId))}
          onHypeChange={applyHype}
          onBacked={(nextCount) => {
            applyBackerCount(player.id, nextCount);
            setPlayer((current) => (current ? { ...current, backer_count: nextCount } : current));
          }}
          onUnlockVault={unlockExclusive}
        />
        </ScrollFxParallax>
      </ScrollFxScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
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
