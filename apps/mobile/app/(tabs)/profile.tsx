import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScrollFxParallax, ScrollFxScrollView } from '@/components/Effects/ScrollFx';
import { SuggestionSheet } from '@/components/Feedback/SuggestionSheet';
import { LegalModal } from '@/components/Legal/LegalModal';
import { TabScreen } from '@/components/TabScreen';
import { AthleteProfileView } from '@/components/Profile/AthleteProfileView';
import { EditProfileModal } from '@/components/Profile/EditProfileModal';
import { PayoutSetupCard } from '@/components/Profile/PayoutSetupCard';
import { ProfileMenuSheet } from '@/components/Profile/ProfileMenuSheet';
import { RoleSwitcherModal } from '@/components/Profile/RoleSwitcherModal';
import { CLAIM_VERIFY_CTA, VerifyAthleteModal } from '@/components/Profile/VerifyAthleteModal';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { useAuth } from '@/context/AuthContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { markExclusiveClips } from '@/data/exclusive';
import { displayValue, type Player } from '@/data/players';
import { useAthleteSubscription } from '@/hooks/useAthleteSubscription';
import { useAthleteStats } from '@/hooks/useAthleteStats';
import { countStoredCheerVotes } from '@/hooks/useCheerPoll';
import { useRoster } from '@/hooks/useRoster';
import { readMaloDroppedCount, useTipCheckout } from '@/hooks/useTipCheckout';
import { useSurfaceUsage } from '@/hooks/useSurfaceUsage';
import { loadFavoritePlayerIds } from '@/lib/favorites';
import { fetchReelsForPlayer, playerFromReel, reelToClip, sortClipsNewestFirst } from '@/lib/reels';
import { formatCapabilityLine } from '@/lib/roles';
import { handleFromName, resolveAuraPoints, subscribePlayerAura } from '@/lib/aura';
import { formatTeamBadge, classYearLabel, type SchoolTeam } from '@/data/teams';
import { LEGAL_MENU_LABEL } from '@/data/legal';
import { resolveVerificationStatus } from '@/data/verification';
import { readAthleteOnboarding } from '@/lib/teams';
import { userProfileHref } from '@/lib/navigation';
import { setPlayerVaultLocked } from '@/lib/vault';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { FOCAL } from '@/theme/motion';
import type { ReelWithPlayer, TipLedgerEntry } from '@/types/database';

const FAN_SELF_PREFIX = 'fan-self';

/**
 * @purpose Own Profile tab uses the same `AthleteProfileView` as `/user/[id]` — hamburger overlays the sheet instead of a YOUR HUB heading; Mālo / Subscribe only when this is not your claimed row. Pull past the top stretches the hero (`ScrollFxParallax`).
 * @sideEffects Soft-Wall sign-in; Stripe PaymentSheet; `RoleSwitcherModal`; `LegalModal`; `VerifyAthleteModal`; `PayoutSetupCard`; receipts; vault lock; roster claim map.
 */
export default function MyHubTab() {
  const router = useRouter();
  const { profile, role, roles, isAthlete, isAdmin, activeRole, isGuest, signOut } = useAuth();
  const { live } = useAppRuntime();
  const { requireAuth } = useSoftWall();
  const { players, applyBackerCount, applyVaultLocked } = useRoster();
  const { startCheckout, busy } = useTipCheckout();
  const { onScroll, trackFeature } = useSurfaceUsage('profile');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [tips, setTips] = useState<TipLedgerEntry[]>([]);
  const [taggedRows, setTaggedRows] = useState<ReelWithPlayer[]>([]);
  const [auraById, setAuraById] = useState<Record<string, number>>({});
  const [tipsDropped, setTipsDropped] = useState(0);
  const [pollVotes, setPollVotes] = useState(0);
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [flipOpen, setFlipOpen] = useState(false);
  const [vaultLockBusy, setVaultLockBusy] = useState(false);
  const [localOnboardTeam, setLocalOnboardTeam] = useState<SchoolTeam | null>(null);

  useEffect(() => {
    void loadFavoritePlayerIds().then(setFavoriteIds);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void supabase
      .from('tips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40)
      .then(({ data }) => setTips((data as TipLedgerEntry[] | null) ?? []));
  }, []);

  useEffect(() => {
    return subscribePlayerAura((playerId, auraPoints) => {
      setAuraById((current) => ({ ...current, [playerId]: auraPoints }));
    });
  }, []);

  const rosterAthlete = useMemo(() => {
    if (profile?.player_id) {
      const claimed = players.find((player) => player.id === profile.player_id);
      if (claimed) return claimed;
    }
    const named = players.find(
      (player) => player.name.trim().toLowerCase() === (profile?.full_name ?? '').trim().toLowerCase(),
    );
    if (named) return named;
    const favorite = players.find((player) => favoriteIds.includes(player.id));
    if (favorite) return favorite;
    // 2026-09 fix: this used to fall back to `players[0]` (a real, unrelated athlete's roster row —
    // whichever one happens to sort first) or a hardcoded "Marcus Rivera" demo object. Either way, a
    // plain fan with no claimed or name-matched athlete saw someone else's jersey, stats, backer
    // count, and Vault lock state presented as their own Hub. Synthesizing a lightweight placeholder
    // from the fan's own profile instead — represents "you, with no athlete claimed yet," not a
    // stand-in for a real (or fake celebrity) athlete. The `FAN_SELF_PREFIX` id keeps the
    // demo-id / dev-id skip below from trying to fetch reels for this synthetic row.
    return {
      id: `${FAN_SELF_PREFIX}-${profile?.user_id ?? 'guest'}`,
      name: profile?.full_name?.trim() || 'Fan',
      jersey_number: 0,
      position: '',
      height: '',
      school_name: '',
      backer_count: 0,
      vault_locked: false,
    } satisfies Player;
  }, [favoriteIds, players, profile?.full_name, profile?.player_id, profile?.user_id]);

  const athlete = useMemo(() => {
    const base = rosterAthlete;
    const override = auraById[base.id];
    return typeof override === 'number' ? { ...base, aura_points: override } : base;
  }, [auraById, rosterAthlete]);

  const { stats, loading: statsLoading } = useAthleteStats(athlete.id, athlete);
  const { subscribed, grant } = useAthleteSubscription(athlete.id);

  const hubAuraPoints = useMemo(() => {
    if (typeof profile?.aura_points === 'number') return profile.aura_points;
    return resolveAuraPoints(athlete);
  }, [athlete, profile?.aura_points]);

  useFocusEffect(
    useCallback(() => {
      void readMaloDroppedCount().then(setTipsDropped);
      void countStoredCheerVotes().then(setPollVotes);
      void readAthleteOnboarding().then((onboard) => setLocalOnboardTeam(onboard?.team ?? null));
      if (
        !athlete.id ||
        athlete.id.startsWith('demo-') ||
        athlete.id.startsWith('dev-') ||
        athlete.id.startsWith(FAN_SELF_PREFIX)
      ) {
        setTaggedRows([]);
        return;
      }
      void fetchReelsForPlayer(athlete.id).then(setTaggedRows);
    }, [athlete.id]),
  );

  const taggedReels = useMemo(
    () =>
      sortClipsNewestFirst(
        markExclusiveClips(
          taggedRows.map((reel) => reelToClip(reel, playerFromReel(reel, [athlete]))),
        ),
      ),
    [athlete, taggedRows],
  );

  const malosReceived = useMemo(() => {
    const forAthlete = tips.filter((tip) => tip.player_id === athlete.id);
    if (forAthlete.length > 0) return forAthlete.length;
    return athlete.backer_count ?? 0;
  }, [athlete.backer_count, athlete.id, tips]);

  const hubName = displayValue(athlete.name, profile?.full_name?.trim() || 'My Hub');
  const hubUsername = profile?.username || handleFromName(hubName);
  const hubBio = [
    displayValue(athlete.position),
    displayValue(athlete.school_name),
    profile?.athlete_sport,
    profile?.athlete_class_year ? `Class ${classYearLabel(profile.athlete_class_year)}` : null,
  ]
    .filter((part) => part && part !== '—')
    .join(' · ');

  const cardTeam = profile?.team ?? localOnboardTeam;
  const cardTeamName = cardTeam?.name ?? athlete.school_name;
  const cardMascot = cardTeam?.mascot ?? null;
  const cardDivision = cardTeam ? formatTeamBadge(cardTeam) : null;
  const cardJersey = profile?.athlete_jersey || athlete.jersey_number;
  const verifyStatus = resolveVerificationStatus(profile);
  const schoolClaimed = Boolean(cardTeam);
  const showVarsityChrome = isAthlete || schoolClaimed || verifyStatus !== 'unverified';

  const subscribe = () => {
    requireAuth({
      kind: 'signin',
      athleteName: athlete.name,
      athleteId: athlete.id,
      resume: () => {
        void startCheckout({
          player: athlete,
          tipAmount: live.catalog.exclusiveDollars,
          coverFees: false,
          auraPoints: live.catalog.exclusiveAura,
          skipBacker: true,
          onPaid: grant,
        });
      },
    });
  };

  const dropMalo = () => {
    const amount = live.catalog.maloAmounts[0] ?? 5;
    requireAuth({
      kind: 'malo',
      athleteName: athlete.name,
      athleteId: athlete.id,
      resume: () => {
        void startCheckout({
          player: athlete,
          tipAmount: amount,
          coverFees: false,
          origin: 'profile',
          entry: 'in_app',
          onBacked: (nextCount) => {
            applyBackerCount(athlete.id, nextCount);
            void readMaloDroppedCount().then(setTipsDropped);
          },
        });
      },
    });
  };

  const openReceipts = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Simulator / web may not expose haptics.
    }
    trackFeature('receipts');
    router.push('/receipts' as Href);
  };

  const menuItems = useMemo(() => {
    const items: {
      id: string;
      label: string;
      hint?: string;
      danger?: boolean;
      onPress: () => void;
    }[] = [];
    if (isGuest) {
      items.push({
        id: 'signin',
        label: 'Sign in',
        hint: 'Email + password · Demo Fan · Apple · Google',
        onPress: () =>
          requireAuth({
            kind: 'signin',
            resume: () => undefined,
          }),
      });
    } else {
      items.push({
        id: 'signout',
        label: 'Sign out',
        hint: profile?.full_name?.trim() || profile?.username || 'Return to guest browse',
        danger: true,
        onPress: () => {
          void signOut();
        },
      });
    }
    if (isAdmin) {
      items.push({
        id: 'admin',
        label: 'Admin portal',
        hint: 'Publish, moderate, and preview production',
        onPress: () => router.push('/admin' as Href),
      });
    }
    if (!isGuest) {
      items.push({
        id: 'edit-profile',
        label: 'Edit Profile',
        hint: 'Bio, social links, and what other users can see',
        onPress: () => setEditProfileOpen(true),
      });
    }
    items.push({
      id: 'capability',
      label: 'Account Capability',
      hint: formatCapabilityLine(roles),
      onPress: () => setRoleSheetOpen(true),
    });
    items.push({
      id: 'legal',
      label: LEGAL_MENU_LABEL,
      hint: 'ToS, high-school NIL, minor safety',
      onPress: () => {
        trackFeature('legal_terms');
        setLegalOpen(true);
      },
    });
    if (!isGuest) {
      items.push({
        id: 'verify',
        label: CLAIM_VERIFY_CTA,
        hint:
          resolveVerificationStatus(profile) === 'verified'
            ? '⚡ VERIFIED VARSITY'
            : 'Team code or coach/parent — profile stays public',
        onPress: () => {
          trackFeature('athlete_verify');
          setVerifyOpen(true);
        },
      });
    }
    if (live.profile.showCard) {
      items.push({
        id: 'flip',
        label: 'Flip Aura card',
        hint: '3D trading card',
        onPress: () => setFlipOpen(true),
      });
    }
    if (live.buttons.suggest) {
      items.push({
        id: 'suggest',
        label: 'Send a suggestion',
        hint: 'Improve Tapua\'i — goes to admin Feedback',
        onPress: () => {
          trackFeature('suggestion');
          setSuggestOpen(true);
        },
      });
    }
    if (live.layouts.receipts) {
      items.push({
        id: 'receipts',
        label: 'Tip History & Receipts',
        hint: live.copy.receiptsKicker,
        onPress: openReceipts,
      });
    }
    return items;
  }, [
    isAdmin,
    isGuest,
    live.buttons.suggest,
    live.copy.receiptsKicker,
    live.layouts.receipts,
    live.profile.showCard,
    profile,
    requireAuth,
    roles,
    router,
    signOut,
    trackFeature,
  ]);

  return (
    <TabScreen>
      <ScrollFxScrollView contentContainerStyle={styles.content} onScroll={onScroll}>
        <ScrollFxParallax factor={0} fadeOver={0}>
        <AthleteProfileView
          player={athlete}
          clips={taggedReels}
          stats={stats}
          statsLoading={statsLoading}
          name={hubName}
          username={hubUsername}
          jersey={cardJersey}
          bio={hubBio || undefined}
          aboutBio={profile?.bio}
          socialLinks={profile?.social_links}
          role={role}
          roles={roles}
          auraPoints={hubAuraPoints}
          teamName={cardTeamName}
          mascot={cardMascot}
          divisionBadge={cardDivision}
          subscriberCrest={subscribed}
          totalTipsReceived={malosReceived}
          totalTipsDropped={tipsDropped}
          pollVotes={pollVotes}
          sekiCount={athlete.seki_count ?? 0}
          subscribed={subscribed}
          manageVault={isAthlete && activeRole === 'athlete'}
          vaultLocked={athlete.vault_locked}
          vaultLockBusy={vaultLockBusy}
          tipping={busy}
          vaultBusy={busy}
          rosterPlayers={players}
          showClaimBadges={isAthlete}
          auraCardOpen={flipOpen}
          onAuraCardOpenChange={setFlipOpen}
          verificationStatus={showVarsityChrome ? verifyStatus : 'unverified'}
          schoolClaimed={schoolClaimed}
          onClaimVerification={
            !showVarsityChrome
              ? undefined
              : isGuest
                ? () =>
                    requireAuth({
                      kind: 'signin',
                      resume: () => setVerifyOpen(true),
                    })
                : () => setVerifyOpen(true)
          }
          avatarUrl={profile?.avatar_url}
          canEditAvatar={!isGuest}
          headerRight={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open account settings"
              haptic="selection"
              onPress={() => setMenuOpen(true)}
              style={styles.menuHit}
            >
              <Ionicons name="menu-outline" size={26} color={FOCAL.jadeInk} />
            </Pressable>
          }
          onDropMalo={dropMalo}
          onSubscribe={subscribe}
          onOpenAthlete={(playerId) => router.push(userProfileHref(playerId))}
          onBacked={(nextCount) => applyBackerCount(athlete.id, nextCount)}
          onUnlockVault={subscribe}
          onVaultLockChange={(locked) => {
            applyVaultLocked(athlete.id, locked);
            setVaultLockBusy(true);
            void setPlayerVaultLocked(athlete.id, locked).finally(() => setVaultLockBusy(false));
          }}
          onVaultChange={(reelId, vaultOnly) => {
            setTaggedRows((current) =>
              current.map((reel) =>
                reel.id === reelId
                  ? { ...reel, is_vault_only: vaultOnly, is_exclusive: vaultOnly }
                  : reel,
              ),
            );
          }}
          onFlashUnlock={(reelId, until) => {
            setTaggedRows((current) =>
              current.map((reel) => (reel.id === reelId ? { ...reel, flash_unlock_until: until } : reel)),
            );
          }}
          onHypeChange={(reelId, hype) => {
            setTaggedRows((current) =>
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
          }}
        />
        </ScrollFxParallax>
      </ScrollFxScrollView>
      <ProfileMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={menuItems}
        footer={
          isAthlete && activeRole === 'athlete' ? (
            <View style={styles.menuFooter}>
              <PayoutSetupCard />
            </View>
          ) : null
        }
      />
      <RoleSwitcherModal visible={roleSheetOpen} onClose={() => setRoleSheetOpen(false)} />
      <LegalModal visible={legalOpen} onClose={() => setLegalOpen(false)} />
      <VerifyAthleteModal visible={verifyOpen} onClose={() => setVerifyOpen(false)} />
      <EditProfileModal visible={editProfileOpen} onClose={() => setEditProfileOpen(false)} />
      <SuggestionSheet visible={suggestOpen} surface="profile" onClose={() => setSuggestOpen(false)} />
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
  menuHit: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FOCAL.mistJade,
    borderWidth: 1,
    borderColor: 'rgba(0,115,60,0.18)',
  },
  menuFooter: {
    marginTop: 4,
  },
});
