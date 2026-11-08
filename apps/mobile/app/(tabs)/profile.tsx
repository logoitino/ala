/** Own profile shares the public sports layout and binds clips/sport reads to the current account and linked athlete.
 * Primary artwork is manually chosen; temporary chips never write it. Account settings retain their current-owner boundary. */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { type Href, useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScrollFxParallax, ScrollFxScrollView } from '@/components/Effects/ScrollFx';
import { SuggestionSheet } from '@/components/Feedback/SuggestionSheet';
import { LegalModal } from '@/components/Legal/LegalModal';
import { TabScreen } from '@/components/TabScreen';
import { FilmerCard } from '@/components/Filmers/FilmerCard';
import { AthleteProfileView } from '@/components/Profile/AthleteProfileView';
import { EditProfileModal } from '@/components/Profile/EditProfileModal';
import { PayoutSetupCard } from '@/components/Profile/PayoutSetupCard';
import { ProfileMenuSheet, type ProfileMenuItem } from '@/components/Profile/ProfileMenuSheet';
import { RoleSwitcherModal } from '@/components/Profile/RoleSwitcherModal';
import { CLAIM_VERIFY_CTA, VerifyAthleteModal } from '@/components/Profile/VerifyAthleteModal';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { useAuth } from '@/context/AuthContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { useOptionalUploadSheet } from '@/context/UploadSheetContext';
import { markExclusiveClips } from '@/data/exclusive';
import { displayValue, type Player } from '@/data/players';
import { useAthleteSubscription } from '@/hooks/useAthleteSubscription';
import { useAthleteStats } from '@/hooks/useAthleteStats';
import { useAthleteSports } from '@/hooks/useAthleteSports';
import { useFilmerStats } from '@/hooks/useFilmerStats';
import { countStoredCheerVotes } from '@/hooks/useCheerPoll';
import { useRoster } from '@/hooks/useRoster';
import { readMaloDroppedCount, useTipCheckout } from '@/hooks/useTipCheckout';
import { useSurfaceUsage } from '@/hooks/useSurfaceUsage';
import { fetchReelsForPlayer, playerFromReel, reelToClip, sortClipsNewestFirst } from '@/lib/reels';
import { formatCapabilityLine } from '@/lib/roles';
import { handleFromName, resolveAuraPoints, subscribePlayerAura } from '@/lib/aura';
import { formatTeamBadge, classYearLabel, type SchoolTeam } from '@/data/teams';
import { LEGAL_MENU_LABEL } from '@/data/legal';
import { resolveVerificationStatus } from '@/data/verification';
import { readAthleteOnboarding } from '@/lib/teams';
import { userProfileHref } from '@/lib/navigation';
import { setPlayerVaultLocked } from '@/lib/vault';
import { fetchRecentTips } from '@/lib/finance';
import { colors } from '@/constants/theme';
import type { ReelWithPlayer, TipLedgerEntry } from '@/types/database';
import { PrivacySettingsSheet } from '@/components/Profile/PrivacySettingsSheet';
import { NotificationSettingsSheet } from '@/components/Profile/NotificationSettingsSheet';
import { ChallengeSettingsSheet } from '@/components/Challenges/ChallengeSettingsSheet';

const FAN_SELF_PREFIX = 'fan-self';

/**
 * @purpose Own Profile tab uses the same `AthleteProfileView` as `/user/[id]` — hamburger opens account settings; compact sections expose owner tools without borrowing another athlete. CHAL-01 own workout settings/private badge/export and enabled Drip access stay on this own-profile route. Pull past the top stretches the hero (`ScrollFxParallax`).
 * @sideEffects Soft-Wall sign-in; Stripe PaymentSheet; `RoleSwitcherModal`; `LegalModal`; `VerifyAthleteModal`; `PayoutSetupCard`; receipts; vault lock; roster claim map.
 */
export default function MyHubTab() {
  const router = useRouter();
  const { profile, role, roles, isAthlete, isAdmin, activeRole, isGuest, signOut, user, isSessionCurrent } = useAuth();
  const { stats: filmerStats } = useFilmerStats(isGuest ? null : profile?.id);
  const uploadSheet = useOptionalUploadSheet();
  const { live } = useAppRuntime();
  const { requireAuth } = useSoftWall();
  const { players, applyBackerCount, applyVaultLocked } = useRoster();
  const { startCheckout, busy } = useTipCheckout();
  const { onScroll, trackFeature } = useSurfaceUsage('profile');
  const [tips, setTips] = useState<TipLedgerEntry[]>([]);
  const [taggedRows, setTaggedRows] = useState<ReelWithPlayer[]>([]);
  const [taggedOwner, setTaggedOwner] = useState<{ account: string | null | undefined; playerId: string; guard: typeof isSessionCurrent } | null>(null);
  const [auraById, setAuraById] = useState<Record<string, number>>({});
  const [tipsDropped, setTipsDropped] = useState(0);
  const [pollVotes, setPollVotes] = useState(0);
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [challengesOpen, setChallengesOpen] = useState(false);
  const [flipOpen, setFlipOpen] = useState(false);
  const [vaultLockBusy, setVaultLockBusy] = useState(false);
  const [localOnboardTeam, setLocalOnboardTeam] = useState<SchoolTeam | null>(null);

  const profileOpen = useIsFocused();
  const sports = useAthleteSports(profile?.id, isAthlete && !isGuest && profileOpen);
  const [sportSelection, setSportSelection] = useState<{ profileId: string | undefined; sport: string | null }>({ profileId: profile?.id, sport: null });
  const displaySport = sportSelection.profileId === profile?.id && sports.snapshot?.sports.some(entry => entry.sport === sportSelection.sport)
    ? sportSelection.sport : null;
  const primarySport = sports.snapshot?.primarySport ?? profile?.athlete_sport;

  const rosterAthlete = useMemo(() => {
    if (profile?.player_id) {
      const claimed = players.find((player) => player.id === profile.player_id);
      if (claimed) return claimed;
    }
    // A matching name or a favorite is another athlete, never ownership of this profile.
    // Until the exact claimed row loads, use the owner's own empty identity.
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
  }, [players, profile?.full_name, profile?.player_id, profile?.user_id]);

  const athlete = useMemo(() => {
    const base = rosterAthlete;
    const override = auraById[base.id];
    return typeof override === 'number' ? { ...base, aura_points: override } : base;
  }, [auraById, rosterAthlete]);

  const ownsRoster = Boolean(isAthlete && profile?.player_id && profile.player_id === athlete.id);
  const { stats, loading: statsLoading } = useAthleteStats(athlete.id, athlete, isAthlete && profile?.player_id === athlete.id ? displaySport || primarySport : undefined, profileOpen);
  const { subscribed, grant } = useAthleteSubscription(athlete.id);

  const hubAuraPoints = useMemo(() => {
    if (typeof profile?.aura_points === 'number') return profile.aura_points;
    return resolveAuraPoints(athlete);
  }, [athlete, profile?.aura_points]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const valid = () => !cancelled && (!isSessionCurrent || isSessionCurrent());
      void fetchRecentTips().then((rows) => {
        if (!cancelled) setTips(rows);
      });
      const unsubscribeAura = subscribePlayerAura((playerId, auraPoints) => {
        setAuraById((current) => ({ ...current, [playerId]: auraPoints }));
      });
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
      } else {
        void fetchReelsForPlayer(athlete.id).then((rows) => {
          if (valid()) { setTaggedRows(rows); setTaggedOwner({ account: user?.id ?? profile?.user_id, playerId: athlete.id, guard: isSessionCurrent }); }
        }, () => {
          if (valid()) { setTaggedRows([]); setTaggedOwner(null); }
        });
      }
      return () => {
        cancelled = true;
        unsubscribeAura();
      };
    }, [athlete.id, isSessionCurrent, profile?.user_id, user?.id]),
  );

  const taggedReels = useMemo(
    () =>
      sortClipsNewestFirst(
        markExclusiveClips(
          (taggedOwner?.account === (user?.id ?? profile?.user_id) && taggedOwner?.playerId === athlete.id
            && taggedOwner.guard === isSessionCurrent && (!isSessionCurrent || isSessionCurrent()) ? taggedRows : [])
            .map((reel) => reelToClip(reel, playerFromReel(reel, [athlete]))),
        ),
      ),
    [athlete, isSessionCurrent, profile?.user_id, taggedOwner, taggedRows, user?.id],
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
      kind: 'exclusive',
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
    const items: ProfileMenuItem[] = [];
    if (isGuest) {
      items.push({
        id: 'signin',
        section: 'account',
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
        section: 'account',
        label: 'Sign out',
        hint: profile?.full_name?.trim() || profile?.username || 'Return to guest browse',
        danger: true,
        onPress: () => {
          void signOut();
        },
      });
    }
    if (live.tabs.drip) {
      items.push({
        id: 'drip',
        section: 'activity',
        label: 'Drip',
        hint: 'Browse team gear',
        onPress: () => router.push('/drip' as Href),
      });
    }
    if (isAdmin) {
      items.push({
        id: 'admin',
        section: 'money',
        label: 'Admin portal',
        hint: 'Publish, moderate, and preview production',
        onPress: () => router.push('/admin' as Href),
      });
    }
    if (!isGuest) {
      items.push({
        id: 'sport-quiz',
        section: 'activity',
        label: 'Sport Quiz & private history',
        hint: 'Optional weekly learning · your private badges and corrections',
        onPress: () => router.push('/sport-quiz' as Href),
      });
      items.push({
        id: 'fan-zone',
        section: 'activity',
        label: 'Fan Zone',
        hint: 'Optional fan activities · campaign access and private review checked on the page',
        onPress: () => router.push('/fan-zone' as Href),
      });
      items.push({
        id: 'edit-profile',
        section: 'account',
        label: 'Edit Profile',
        hint: 'Bio, social links, and what other users can see',
        onPress: () => setEditProfileOpen(true),
      });
      items.push({
        id: 'challenges',
        section: 'activity',
        label: 'Workout challenges',
        hint: 'Mute invites, private badges, and your data',
        onPress: () => setChallengesOpen(true),
      });
      items.push({
        id: 'notifications',
        section: 'account',
        label: 'Notifications',
        hint: 'Email choices and your Activity inbox',
        onPress: () => {
          trackFeature('notifications.settings');
          setNotificationsOpen(true);
        },
      });
    }
    items.push({
      id: 'capability',
      section: 'account',
      label: 'Account Capability',
      hint: formatCapabilityLine(roles),
      onPress: () => setRoleSheetOpen(true),
    });
    items.push({
      id: 'legal',
      section: 'support',
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
        section: 'support',
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
    // No 'Flip Aura card' item: `ProfileHeroAvatar` already carries a dedicated flip
    // control next to the card, so a menu entry for it read as a duplicate.
    if (live.buttons.suggest) {
      items.push({
        id: 'suggest',
        section: 'support',
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
        section: 'money',
        label: 'Gift History & Receipts',
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
    live.tabs.drip,
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
          key={`${profile?.id ?? 'guest'}:${athlete.id}`}
          player={athlete}
          clips={taggedReels}
          stats={stats}
          statsLoading={statsLoading}
          primarySport={primarySport}
          displaySport={displaySport}
          sportEntries={sports.snapshot?.sports}
          onDisplaySportChange={sport => setSportSelection({ profileId: profile?.id, sport })}
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
          manageVault={ownsRoster && activeRole === 'athlete'}
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
              <Ionicons name="menu-outline" size={22} color={colors.text} />
            </Pressable>
          }
          onDropMalo={dropMalo}
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
        <FilmerCard stats={filmerStats} own onFilm={uploadSheet ? uploadSheet.openUpload : undefined} />
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
      <EditProfileModal visible={editProfileOpen} onClose={() => setEditProfileOpen(false)} onOpenPrivacy={() => setPrivacyOpen(true)} onSportsSaved={sports.acceptConfirmed} />
      <PrivacySettingsSheet visible={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <NotificationSettingsSheet visible={notificationsOpen && profileOpen && !isGuest} onClose={() => setNotificationsOpen(false)} />
      <SuggestionSheet visible={suggestOpen} surface="profile" onClose={() => setSuggestOpen(false)} />
      <ChallengeSettingsSheet visible={challengesOpen} onClose={() => setChallengesOpen(false)} />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 14,
    paddingTop: 4,
    // TabScreen reserves the measured floating dock; only this small scroll inset is needed here.
    paddingBottom: 10,
    gap: 6,
  },
  menuHit: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuFooter: {
    marginTop: 4,
  },
});
