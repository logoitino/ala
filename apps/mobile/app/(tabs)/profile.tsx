import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SuggestionSheet } from '@/components/Feedback/SuggestionSheet';
import { LegalModal } from '@/components/Legal/LegalModal';
import { ScreenHeading } from '@/components/ScreenHeading';
import { TabScreen } from '@/components/TabScreen';
import { AthleteProfileView } from '@/components/Profile/AthleteProfileView';
import { PayoutSetupCard } from '@/components/Profile/PayoutSetupCard';
import { ProfileMenuSheet } from '@/components/Profile/ProfileMenuSheet';
import { RoleSwitcherModal } from '@/components/Profile/RoleSwitcherModal';
import { CLAIM_VERIFY_CTA, VerifyAthleteModal } from '@/components/Profile/VerifyAthleteModal';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { cardShadow, colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { markExclusiveClips } from '@/data/exclusive';
import { displayValue, type Player } from '@/data/players';
import { useHasSubscriberPass } from '@/hooks/useAthleteSubscription';
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
import { FOCAL, TAB_ACCENTS } from '@/theme/motion';
import type { ReelWithPlayer, TipLedgerEntry } from '@/types/database';

const SUB_KEY = 'tapuai.exclusiveSub';

const FALLBACK_ATHLETE: Player = {
  id: 'demo-marcus-rivera',
  name: 'Marcus Rivera',
  jersey_number: 7,
  position: 'Quarterback',
  height: "6'2\"",
  school_name: 'ALA Hawks',
  backer_count: 14,
  view_count: 1280,
  vault_locked: true,
};

/**
 * @purpose Profile hub: hero avatar, slim Crew/Squad, Highlights collage, Active Team Roster; settings in hamburger.
 * @sideEffects Soft-Wall sign-in; `RoleSwitcherModal`; `LegalModal`; `VerifyAthleteModal`; `PayoutSetupCard`; receipts; vault lock; roster claim map.
 */
export default function MyHubTab() {
  const router = useRouter();
  const { profile, role, roles, isAthlete, isAdmin, activeRole, isGuest, signOut } = useAuth();
  const { live } = useAppRuntime();
  const { requireAuth } = useSoftWall();
  const { players, applyBackerCount, applyVaultLocked } = useRoster();
  const { startCheckout, busy } = useTipCheckout();
  const { onScroll, trackFeature } = useSurfaceUsage('profile');
  const hasSubscriberPass = useHasSubscriberPass();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [tips, setTips] = useState<TipLedgerEntry[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [taggedRows, setTaggedRows] = useState<ReelWithPlayer[]>([]);
  const [auraById, setAuraById] = useState<Record<string, number>>({});
  const [tipsDropped, setTipsDropped] = useState(0);
  const [pollVotes, setPollVotes] = useState(0);
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [flipOpen, setFlipOpen] = useState(false);
  const [vaultLockBusy, setVaultLockBusy] = useState(false);
  const [localOnboardTeam, setLocalOnboardTeam] = useState<SchoolTeam | null>(null);

  useEffect(() => {
    void loadFavoritePlayerIds().then(setFavoriteIds);
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(SUB_KEY).then((value) => {
      if (value === '1') setSubscribed(true);
    });
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
    return players[0] ?? FALLBACK_ATHLETE;
  }, [favoriteIds, players, profile?.full_name, profile?.player_id]);

  const athlete = useMemo(() => {
    const base = rosterAthlete;
    const override = auraById[base.id];
    return typeof override === 'number' ? { ...base, aura_points: override } : base;
  }, [auraById, rosterAthlete]);

  const { stats, loading: statsLoading } = useAthleteStats(athlete.id, athlete);

  const hubAuraPoints = useMemo(() => {
    if (typeof profile?.aura_points === 'number') return profile.aura_points;
    return resolveAuraPoints(athlete);
  }, [athlete, profile?.aura_points]);

  useFocusEffect(
    useCallback(() => {
      void readMaloDroppedCount().then(setTipsDropped);
      void countStoredCheerVotes().then(setPollVotes);
      void readAthleteOnboarding().then((onboard) => setLocalOnboardTeam(onboard?.team ?? null));
      if (!athlete.id || athlete.id.startsWith('demo-') || athlete.id.startsWith('dev-')) {
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
    setSubscribed(true);
    void AsyncStorage.setItem(SUB_KEY, '1');
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
      <ScrollView contentContainerStyle={styles.content} onScroll={onScroll} scrollEventThrottle={400}>
        <AthleteProfileView
          player={athlete}
          clips={taggedReels}
          stats={stats}
          statsLoading={statsLoading}
          name={hubName}
          username={hubUsername}
          jersey={cardJersey}
          bio={hubBio || undefined}
          role={role}
          roles={roles}
          auraPoints={hubAuraPoints}
          teamName={cardTeamName}
          mascot={cardMascot}
          divisionBadge={cardDivision}
          subscriberCrest={hasSubscriberPass || subscribed}
          totalTipsReceived={malosReceived}
          totalTipsDropped={tipsDropped}
          pollVotes={pollVotes}
          sekiCount={athlete.seki_count ?? 0}
          subscribed={hasSubscriberPass || subscribed}
          manageVault={isAthlete && activeRole === 'athlete'}
          vaultLocked={athlete.vault_locked}
          vaultLockBusy={vaultLockBusy}
          tipping={busy}
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
          leading={
            <View style={styles.headingRow}>
              <View style={styles.headingCopy}>
                <ScreenHeading
                  compact
                  kicker={live.copy.profileKicker}
                  title="Profile"
                  accent={TAB_ACCENTS.profile.color}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open account settings"
                haptic="selection"
                onPress={() => setMenuOpen(true)}
                style={styles.menuHit}
              >
                <Ionicons name="menu-outline" size={26} color={FOCAL.jadeInk} />
              </Pressable>
            </View>
          }
          actions={
            activeRole === 'fan' && (live.buttons.malo || live.buttons.subscribe) ? (
              <View style={styles.actionRow}>
                {live.buttons.malo ? (
                  <AnimatedButton
                    accessibilityLabel={`Drop ${live.catalog.maloAmounts[0] ?? 5} dollar Mālo`}
                    disabled={busy}
                    haptic="medium"
                    onPress={dropMalo}
                    style={styles.actionFlex}
                    contentStyle={[styles.primaryAction, busy && styles.disabled]}
                  >
                    <Text style={styles.primaryActionLabel}>Drop ${live.catalog.maloAmounts[0] ?? 5} Mālo</Text>
                  </AnimatedButton>
                ) : null}
                {live.buttons.subscribe ? (
                  <AnimatedButton
                    accessibilityLabel={
                      subscribed
                        ? 'Subscribed to exclusive feed'
                        : `Subscribe for ${live.catalog.exclusiveDollars.toFixed(2)} a month`
                    }
                    disabled={subscribed}
                    onPress={subscribe}
                    style={styles.actionFlex}
                    contentStyle={[styles.secondaryAction, subscribed && styles.secondaryActionOn]}
                  >
                    <Text style={[styles.secondaryActionLabel, subscribed && styles.secondaryActionLabelOn]}>
                      {subscribed ? 'Subscribed' : `Subscribe ($${live.catalog.exclusiveDollars.toFixed(2)}/mo)`}
                    </Text>
                  </AnimatedButton>
                ) : null}
              </View>
            ) : null
          }
        />
      </ScrollView>
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
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingCopy: {
    flex: 1,
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
  actionFlex: {
    flex: 1,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 16,
    ...cardShadow,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.photoPlaceholder,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
  },
  identityCopy: {
    flex: 1,
    gap: 4,
  },
  jersey: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  school: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  position: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  maloBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  maloCount: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  maloCaption: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  settingsBlock: {
    gap: 8,
  },
  capabilityRow: {
    minHeight: 56,
    borderRadius: radii.md,
    backgroundColor: FOCAL.mistGold,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  capabilityCopy: {
    flex: 1,
    gap: 2,
  },
  capabilityLabel: {
    color: FOCAL.goldInk,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  capabilityValue: {
    color: FOCAL.emberInk,
    fontSize: 15,
    fontWeight: '800',
  },
  primaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: FOCAL.goldInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  primaryActionLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: FOCAL.mistEmber,
    borderWidth: 1.5,
    borderColor: FOCAL.ember,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  secondaryActionOn: {
    backgroundColor: FOCAL.mistGold,
  },
  secondaryActionLabel: {
    color: FOCAL.emberInk,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryActionLabelOn: {
    color: FOCAL.goldInk,
  },
  switcher: {
    flexDirection: 'row',
    backgroundColor: FOCAL.mistGold,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    padding: 4,
    gap: 4,
  },
  switchTab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTabOn: {
    backgroundColor: FOCAL.goldInk,
  },
  switchLabel: {
    color: FOCAL.goldInk,
    fontSize: 13,
    fontWeight: '800',
  },
  switchLabelOn: {
    color: '#FFFFFF',
  },
  exclusiveWrap: {
    minHeight: 420,
    position: 'relative',
  },
  exclusiveDim: {
    opacity: 0.28,
  },
  exclusiveCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
    marginBottom: 10,
  },
  exclusiveKind: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  exclusiveTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  exclusiveBlurb: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  lockCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 20,
    gap: 10,
    alignItems: 'center',
    ...cardShadow,
  },
  lockTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  lockBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  unlockButton: {
    minHeight: 48,
    alignSelf: 'stretch',
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 6,
  },
  unlockLabel: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.55,
  },
});
