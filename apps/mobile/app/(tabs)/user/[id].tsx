/** Public profiles commit subject/session-bound reads and preview only the privacy-filtered photo. Sport chips use privacy-filtered participation,
 * recorded Highlight tags and independent Stats while the manually chosen primary field remains stable.
 * Pending reads keep matching Highlight captions confirmed before the profile can render them. */
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { FilmerCard } from '@/components/Filmers/FilmerCard';
import { useFilmerStats } from '@/hooks/useFilmerStats';
import { markExclusiveClips } from '@/data/exclusive';
import { displayValue, type Player } from '@/data/players';
import { useAthleteStats } from '@/hooks/useAthleteStats';
import { useAthleteSubscription } from '@/hooks/useAthleteSubscription';
import { useRoster } from '@/hooks/useRoster';
import { useTipCheckout } from '@/hooks/useTipCheckout';
import { beginExclusiveUnlock } from '@/lib/exclusiveCheckout';
import { fetchReelsForPlayer, playerFromReel, reelToClip, sortClipsNewestFirst, type ReelHype } from '@/lib/reels';
import { applyReelCaptionChange, subscribeReelCaptionChanges, trackReelCaptionRead } from '@/lib/postCaptions';
import { hydratePlayerHype } from '@/lib/hype';
import { fetchGuestPlayer, fetchPublicProfileForPlayer } from '@/lib/roster';
import { handleFromName, isAuraUuid, resolveAuraPoints, subscribePlayerAura } from '@/lib/aura';
import { userProfileHref } from '@/lib/navigation';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchPlayerVerification } from '@/lib/verification';
import type { Reel, ReelWithPlayer, ProfilePublic } from '@/types/database';
import { fetchAthleteSports, type AthleteSportsSnapshot } from '@/lib/athleteSports';

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
    // A fetched/confirmed caption is newer than the original upload receipt.
    return rows.map((row) => (row.id === uploaded.id ? { ...row, ...next, title: row.title } : row));
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
  const { id, entry } = useLocalSearchParams<{ id: string; entry?: string | string[] }>();
  const fromQr = (Array.isArray(entry) ? entry[0] : entry) === 'qr';
  const rawId = Array.isArray(id) ? id[0] : id;
  const playerId = rawId && isAuraUuid(rawId) ? rawId : undefined;
  const currentId = useRef(playerId);
  currentId.current = playerId;
  const loadRequest = useRef(0);
  const captionRead = useRef<ReturnType<typeof trackReelCaptionRead> | null>(null);
  const [loadedId, setLoadedId] = useState<string | undefined>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [reels, setReels] = useState<ReelWithPlayer[]>([]);
  useEffect(() => subscribeReelCaptionChanges(change =>
    setReels(rows => applyReelCaptionChange(rows, change))), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'unverified' | 'pending' | 'verified'>('unverified');
  const [schoolClaimed, setSchoolClaimed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [publicProfile, setPublicProfile] = useState<ProfilePublic | null>(null);
  const [sportsSnapshot, setSportsSnapshot] = useState<AthleteSportsSnapshot | null>(null);
  const [sportSelection, setSportSelection] = useState<{ playerId: string | undefined; sport: string | null }>({ playerId, sport: null });
  const displaySport = sportSelection.playerId === playerId && sportsSnapshot?.sports.some(entry => entry.sport === sportSelection.sport) ? sportSelection.sport : null;
  const primarySport = sportsSnapshot?.primarySport ?? (publicProfile?.player_id === playerId ? publicProfile?.athlete_sport : undefined);
  const { stats, loading: statsLoading } = useAthleteStats(playerId, player, displaySport || primarySport);
  const { subscribed, grant } = useAthleteSubscription(playerId);
  const { startCheckout, busy } = useTipCheckout();
  const { live } = useAppRuntime();
  const { isAthlete, user, isSessionCurrent } = useAuth();
  const actor = user?.id ?? 'guest';
  const activeActor = useRef(actor); activeActor.current = actor;
  const [loadedActor, setLoadedActor] = useState<string | null>(null);
  const [loadedGuard, setLoadedGuard] = useState<{ guard: typeof isSessionCurrent } | null>(null);
  const { requireAuth } = useSoftWall();
  const { players: rosterPlayers, applyBackerCount } = useRoster();
  const uploadSheet = useOptionalUploadSheet();
  const { stats: filmerStats } = useFilmerStats(publicProfile?.id);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    captionRead.current?.close();
    captionRead.current = null;
    const current = () => loadRequest.current === request && currentId.current === playerId
      && activeActor.current === actor && (!isSessionCurrent || isSessionCurrent());
    setLoading(true);
    setError(null);
    setPublicProfile(null);
    setSportsSnapshot(null);
    if (!playerId) {
      setError(rawId ? 'This Spotlight highlight is not linked to an athlete profile yet. Watch the clip from Spotlight instead.' : 'Missing athlete id.');
      setLoadedId(playerId);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      console.warn('[UserAthleteProfileScreen]', CONFIG_ERROR);
      setError(FRIENDLY_CONFIG_ERROR);
      setLoadedId(playerId);
      setLoading(false);
      return;
    }
    let read: ReturnType<typeof trackReelCaptionRead> | undefined;
    try {
      const loaded = await fetchGuestPlayer(playerId);
      if (!current()) return;
      if (loaded.error || !loaded.player) {
        setPlayer(null); setReels([]);
        setError(loaded.error === 'Player not found.' ? 'Athlete not found.' : (loaded.error ?? 'Athlete not found.'));
        setLoadedId(playerId); setLoading(false);
        return;
      }
      const nextPlayer = await hydratePlayerHype(loaded.player);
      if (!current()) return;
      read = trackReelCaptionRead();
      captionRead.current = read;
      const [tagged, verification, publicProfileRow] = await Promise.all([
        fetchReelsForPlayer(playerId), fetchPlayerVerification(playerId, nextPlayer.name),
        fetchPublicProfileForPlayer(playerId),
      ]);
      if (!current()) return;
      let nextSports: AthleteSportsSnapshot | null = null;
      // A denied or unavailable secondary read retains the existing legacy display without widening privacy.
      if (publicProfileRow && publicProfileRow.player_id === playerId) {
        try { nextSports = await fetchAthleteSports(publicProfileRow.id); } catch { /* SDK records a fixed failure code. */ }
        if (nextSports?.profileId !== publicProfileRow.id) nextSports = null;
      }
      // Commit the whole sheet together: no old profile or late result can replace the active athlete.
      if (!current()) return;
      setPlayer(nextPlayer);
      setReels(read.reconcile(mergeUploadedReel(tagged, uploadSheet?.lastUploaded, playerId, nextPlayer)));
      setVerificationStatus(verification.status); setSchoolClaimed(verification.schoolClaimed);
      setAvatarUrl(verification.avatarUrl);
      setPublicProfile(publicProfileRow);
      setSportsSnapshot(nextSports); setLoadedActor(actor); setLoadedGuard({ guard: isSessionCurrent });
      setLoadedId(playerId); setLoading(false);
    } catch {
      if (!current()) return;
      setError('Please try again.'); setLoadedId(playerId); setLoading(false);
    } finally {
      read?.close();
      if (captionRead.current === read) captionRead.current = null;
    }
  }, [actor, isSessionCurrent, playerId, rawId, uploadSheet?.lastUploaded]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => {
      loadRequest.current += 1;
      captionRead.current?.close();
      captionRead.current = null;
    };
  }, [load]));

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
          origin: fromQr ? 'qr' : 'profile',
          entry: fromQr ? 'qr_link' : 'in_app',
          onBacked: (nextCount) => {
            applyBackerCount(player.id, nextCount);
            setPlayer((current) => (current?.id === player.id ? { ...current, backer_count: nextCount } : current));
          },
        });
      },
    });
  };

  const unlockExclusive = () => {
    if (!player) return;
    beginExclusiveUnlock({
      player,
      tipAmount: live.catalog.exclusiveDollars,
      auraPoints: live.catalog.exclusiveAura,
      requireAuth,
      startCheckout,
      onPaid: grant,
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

  if (loading || loadedId !== playerId || (!error && (loadedActor !== actor || loadedGuard?.guard !== isSessionCurrent
    || (isSessionCurrent && !isSessionCurrent())))) {
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
          key={player.id}
          player={player}
          schoolVisible={schoolVisible}
          clips={clips}
          stats={stats}
          statsLoading={statsLoading}
          primarySport={primarySport}
          displaySport={displaySport}
          sportEntries={sportsSnapshot?.sports}
          onDisplaySportChange={sport => setSportSelection({ playerId, sport })}
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
          tipEntry={fromQr ? 'qr_link' : 'in_app'}
          verificationStatus={verificationStatus}
          schoolClaimed={schoolClaimed}
          avatarUrl={avatarUrl}
          viewerProfile
          previewAvatar={Boolean(avatarUrl && publicProfile?.player_id === playerId
            && publicProfile?.verification_status !== undefined && publicProfile?.avatar_url?.trim() === avatarUrl)}
          onBack={() => router.back()}
          onDropMalo={dropMalo}
          onOpenAthlete={(nextId) => router.push(userProfileHref(nextId))}
          onHypeChange={applyHype}
          onBacked={(nextCount) => {
            applyBackerCount(player.id, nextCount);
            setPlayer((current) => (current?.id === player.id ? { ...current, backer_count: nextCount } : current));
          }}
          onUnlockVault={unlockExclusive}
        />
        </ScrollFxParallax>
        <FilmerCard stats={filmerStats} />
      </ScrollFxScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
    // The shell already clears the measured fan dock, including enlarged navigation labels.
    paddingBottom: 10,
    gap: 6,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  missingTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  missingText: {
    color: colors.textMuted,
    textAlign: 'center',
  },
  retry: {
    marginTop: 6,
    minHeight: 44,
    paddingHorizontal: 14,
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
