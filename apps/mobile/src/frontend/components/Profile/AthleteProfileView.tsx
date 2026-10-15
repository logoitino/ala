/**
 * The public athlete page shown at /user/[id]: hero card, Aura trading card, crew and teammate badges, Rally,
 * filmer card, the viewer's "Learn {sport} with {name}" trivia card (QUIZ-03), and direct Highlights / Stats / Goals /
 * Vault / owner Manage navigation.
 * Used by both the fan tab's own profile and any athlete opened from elsewhere. `onOpenClip` lets other
 * components (for example a Rally thank-you) jump to a specific clip in the Highlights tab.
 * @sideEffects Reads athlete, crew, school badge, leaderboard and reel data through hooks / lib.
 */

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSchoolBadge } from '@/hooks/useSchoolBadge';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { VaultLockedCard } from '@/components/Profile/ExclusivePaywall';
import { AthleteReelManager } from '@/components/Profile/AthleteReelManager';
import { AthleteStatsTab } from '@/components/Profile/AthleteStatsTab';
import { AuraTradingCard } from '@/components/Profile/AuraTradingCard';
import { LockerRoomWishlist } from '@/components/Profile/LockerRoomWishlist';
import { AccountTagInbox } from '@/components/Profile/AccountTagInbox';
import { ReceivedMaloPanel } from '@/components/Profile/ReceivedMaloPanel';
import { RallyCard } from '@/components/Rally/RallyCard';
import { ProfileHeroAvatar } from '@/components/Profile/ProfileHeroAvatar';
import { ShareQrModal } from '@/components/Profile/ShareQrModal';
import { SubscriberQnA } from '@/components/Profile/SubscriberQnA';
import { TeamRosterStrip } from '@/components/Profile/TeamRosterStrip';
import { VaultLockCard } from '@/components/Profile/VaultLockCard';
import { TaggedReelGrid } from '@/components/Profile/TaggedReelGrid';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import {
  CREW_COUNTER_LABEL,
  IN_CREW_LABEL,
  JOIN_CREW_LABEL,
  SQUAD_COUNTER_LABEL,
  TEAMMATES_BADGE,
} from '@/data/crew';
import { isClipVaultOnly } from '@/data/exclusive';
import {
  HIGHLIGHT_TAB_LABEL,
  STATS_TAB_LABEL,
  VAULT_TAB_LABEL,
  type HighlightClip,
} from '@/data/highlights';
import { TAGLINE_HEADLINE } from '@/data/malo';
import { SHARE_FUND_CTA } from '@/data/share';
import { applyAthleteStatsPlaybook, emptyAthleteStats, type AthleteStatsBundle } from '@/data/athleteStats';
import { isWishlistFunded } from '@/data/wishlist';
import type { VerificationStatus } from '@/data/verification';
import { useCrew } from '@/hooks/useCrew';
import { useSportConfigs } from '@/hooks/useSportConfigs';
import { formatCompactCount } from '@/lib/hype';
import { fetchAthleteHighlightViews } from '@/lib/leaderboards';
import { nonEmptySocialLinks, resolveSocialLinkUrl, socialLinkLabel } from '@/lib/socialLinks';
import type { Player, ProfileSocialLinks, UserRole } from '@/types/database';
import type { ReelHype } from '@/lib/reels';
import { isVaultSealed } from '@/lib/vault';
import { fetchWishlistItems } from '@/lib/wishlist';
import { FOCAL } from '@/theme/motion';
import { ProfileFriendActions } from '@/components/Profile/ProfileFriendActions';
import { LearnSportCard } from '@/components/SportQuiz/LearnSportCard';

export type AthleteProfileTab = 'highlights' | 'stats' | 'goals' | 'vault' | 'team' | 'manage';

const PROFILE_TABS: { id: AthleteProfileTab; label: string }[] = [
  { id: 'highlights', label: HIGHLIGHT_TAB_LABEL },
  { id: 'stats', label: STATS_TAB_LABEL },
  { id: 'goals', label: 'Goals' },
  { id: 'vault', label: VAULT_TAB_LABEL },
  { id: 'team', label: 'Team' },
  { id: 'manage', label: 'Manage' },
];

type AthleteProfileViewProps = {
  player: Player;
  clips: HighlightClip[];
  stats: AthleteStatsBundle;
  statsLoading?: boolean;
  name: string;
  /** Public visibility flag prevents roster fallback/confirmed crest from restoring a hidden school. */
  schoolVisible?: boolean;
  username?: string | null;
  jersey?: string | number;
  bio?: string;
  /** Real, user-authored about-me text (`profiles.bio`) — separate from `bio` above, which is an
   * auto-generated position/school summary line shown only on the flip-card back face. Rendered
   * as an "About" section on the main sheet body when present. */
  aboutBio?: string | null;
  /** `profiles.social_links`, already visibility-filtered by the caller for a public sheet. */
  socialLinks?: ProfileSocialLinks | null;
  role?: UserRole;
  roles?: string[] | null;
  auraPoints: number;
  teamName?: string | null;
  mascot?: string | null;
  divisionBadge?: string | null;
  subscriberCrest?: boolean;
  totalTipsReceived?: number;
  totalTipsDropped?: number;
  pollVotes?: number;
  sekiCount?: number;
  subscribed?: boolean;
  manageVault?: boolean;
  tipping?: boolean;
  vaultBusy?: boolean;
  vaultLocked?: boolean | null;
  vaultLockBusy?: boolean;
  /** School roster for Active Team Roster under Highlights. */
  rosterPlayers?: Player[];
  /** Athletes see Claimed / Unclaimed on the roster. */
  showClaimBadges?: boolean;
  /** Controlled Aura trading-card flip sheet (hamburger / hero control). */
  auraCardOpen?: boolean;
  onAuraCardOpenChange?: (open: boolean) => void;
  verificationStatus?: VerificationStatus;
  schoolClaimed?: boolean;
  onClaimVerification?: () => void;
  avatarUrl?: string | null;
  canEditAvatar?: boolean;
  onAvatarUploaded?: (url: string) => void;
  /** Hide the nested stack title — back chevron on public `/user/[id]`. */
  onBack?: () => void;
  /** Own hub account hamburger. Public sheets omit this. */
  headerRight?: ReactNode;
  onDropMalo?: () => void;
  /** `qr_link` when this sheet was opened from a gift QR, so locker chip-ins keep that arrival. */
  tipEntry?: 'in_app' | 'qr_link';
  leading?: ReactNode;
  actions?: ReactNode;
  trailing?: ReactNode;
  onOpenAthlete?: (playerId: string) => void;
  onHypeChange?: (reelId: string, hype: ReelHype) => void;
  onBacked?: (nextCount: number) => void;
  onVaultChange?: (reelId: string, vaultOnly: boolean) => void;
  onFlashUnlock?: (reelId: string, until: string) => void;
  onUnlockVault?: () => void;
  onVaultLockChange?: (locked: boolean) => void;
};

/**
 * @purpose One athlete sheet for the Profile tab and `/user/[id]`: hero, Crew, compact Donate/Share and direct Highlights / Stats / Goals / Vault / Manage sections.
 * @param onBack Public sheet back control (stack header is hidden so chrome matches the hub).
 * @param headerRight Own-hub account menu.
 * @param onDropMalo Donate — hidden on your own claimed row. One-time Exclusive stays on the Vault tab and a locked Highlight.
 * @sideEffects Child grids / vault / Q&A / `useCrew`; wishlist lights Flip-card glow when opened; `ShareQrModal`; own-hub `ProfileAvatarPicker`.
 */
export function AthleteProfileView({
  player,
  clips,
  stats,
  statsLoading = false,
  name,
  schoolVisible = true,
  username,
  jersey,
  bio,
  aboutBio,
  socialLinks,
  role,
  roles,
  auraPoints,
  teamName,
  mascot,
  divisionBadge,
  subscriberCrest = false,
  totalTipsReceived = 0,
  totalTipsDropped = 0,
  pollVotes = 0,
  sekiCount = 0,
  subscribed = false,
  manageVault = false,
  tipping = false,
  vaultBusy = false,
  vaultLocked,
  vaultLockBusy = false,
  rosterPlayers = [],
  showClaimBadges = false,
  auraCardOpen,
  onAuraCardOpenChange,
  verificationStatus = 'unverified',
  schoolClaimed = false,
  onClaimVerification,
  avatarUrl,
  canEditAvatar = false,
  onAvatarUploaded,
  onBack,
  headerRight,
  onDropMalo,
  tipEntry,
  leading,
  actions,
  trailing,
  onOpenAthlete,
  onHypeChange,
  onBacked,
  onVaultChange,
  onFlashUnlock,
  onUnlockVault,
  onVaultLockChange,
}: AthleteProfileViewProps) {
  const insets = useSafeAreaInsets();
  const frame = useSheetFrame();
  const { live } = useAppRuntime();
  const { profile } = useAuth();
  const { configFor } = useSportConfigs();
  const athleteIdentity = role === 'athlete' || Boolean(roles?.includes('athlete'));
  // Matching display names are not proof that another roster row owns the viewer's credentials.
  const ownCredentials = athleteIdentity && Boolean(profile?.player_id && profile.player_id === player.id);
  const editAvatar = Boolean(canEditAvatar && (ownCredentials || headerRight));
  const ownerTools = ownCredentials || Boolean(headerRight);
  // Stats, hero and Aura use one sport. Old totals cannot become another sport's numbers by relabeling.
  const selectedSport = (ownCredentials ? profile?.athlete_sport?.trim() : '') || stats.career.sport;
  const sportStats = applyAthleteStatsPlaybook(
    selectedSport.trim().toLowerCase() === stats.career.sport.trim().toLowerCase()
      ? stats : emptyAthleteStats(player, selectedSport),
    configFor(selectedSport),
  );
  const maloAmount = live.catalog.maloAmounts[0] ?? 5;
  const showFanSupport = !ownCredentials && !headerRight && Boolean(onDropMalo && live.buttons.malo);
  const showDonateTagline = showFanSupport && athleteIdentity && Boolean(onDropMalo && live.buttons.malo);
  const [tab, setTab] = useState<AthleteProfileTab>('highlights');
  const [openClipId, setOpenClipId] = useState<string | null>(null);
  const [wishlistFulfilled, setWishlistFulfilled] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const schoolBadge = useSchoolBadge(athleteIdentity && schoolVisible ? player.id : null);
  const [highlightViews, setHighlightViews] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    setHighlightViews(null);
    void fetchAthleteHighlightViews(player.id).then((total) => {
      if (alive) setHighlightViews(total);
    });
    return () => {
      alive = false;
    };
  }, [player.id]);
  const [internalFlip, setInternalFlip] = useState(false);
  const flipOpen = auraCardOpen ?? internalFlip;
  const setFlipOpen = onAuraCardOpenChange ?? setInternalFlip;

  const publicClips = useMemo(() => clips.filter((clip) => !isClipVaultOnly(clip)), [clips]);
  const sekiPeak = Math.max(player.seki_count ?? 0, sekiCount, ...publicClips.map((clip) => clip.sekiCount ?? 0));
  const flexPeak = Math.max(player.flex_count ?? 0, ...publicClips.map((clip) => clip.flexCount ?? 0));
  // Rally thank-you can point at one of the athlete's own confirmed clips ("what it paid for").
  const rallyClips = useMemo(
    () =>
      publicClips
        .filter((clip) => clip.playerId === player.id && clip.tagStatus !== 'pending' && clip.tagStatus !== 'rejected')
        .map((clip) => ({ id: clip.id, title: clip.tag })),
    [player.id, publicClips],
  );
  const vaultClips = useMemo(() => clips.filter((clip) => isClipVaultOnly(clip)), [clips]);
  const sealed = isVaultSealed(vaultLocked);
  const vaultUnlocked = manageVault || subscribed || !sealed;
  const schoolLabel = schoolVisible ? teamName?.trim() || player.school_name : '';
  const tabs = PROFILE_TABS.filter((item) => {
    if (item.id === 'vault') return live.buttons.vault && live.profile.showVault;
    if (item.id === 'stats') return athleteIdentity && live.profile.showStats;
    if (item.id === 'goals') return athleteIdentity && (live.layouts.wishlist || live.buttons.malo || ownCredentials);
    if (item.id === 'team') return athleteIdentity && rosterPlayers.some(row => row.school_name?.trim() === schoolLabel?.trim());
    if (item.id === 'manage') return ownerTools;
    return true;
  });

  useEffect(() => {
    if (tab === 'vault' && (!live.buttons.vault || !live.profile.showVault)) setTab('highlights');
    if (!tabs.some(item => item.id === tab)) setTab('highlights');
  }, [live.buttons.vault, live.profile.showStats, live.profile.showVault, live.layouts.wishlist, live.buttons.malo, athleteIdentity, ownerTools, rosterPlayers, schoolLabel, tab]);

  useEffect(() => {
    if (athleteIdentity && live.profile.statsFirst && live.profile.showStats) setTab('stats');
  }, [athleteIdentity, live.profile.showStats, live.profile.statsFirst]);

  useEffect(() => {
    let cancelled = false;
    void fetchWishlistItems(player.id).then((items) => {
      if (cancelled) return;
      setWishlistFulfilled(
        items.some((item) => item.player_id === player.id && isWishlistFunded(item)),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [player.id]);

  const grid = (rows: HighlightClip[], opts?: { vaultBadge?: boolean; lock?: boolean }) =>
    manageVault ? (
      <AthleteReelManager
        clips={rows}
        player={player}
        tipping={tipping}
        onOpenAthlete={onOpenAthlete}
        onHypeChange={onHypeChange}
        onBacked={onBacked}
        onVaultChange={onVaultChange}
        onFlashUnlock={onFlashUnlock}
        openClipId={openClipId}
      />
    ) : (
      <TaggedReelGrid
        clips={rows}
        player={player}
        tipping={tipping}
        subscribed={opts?.lock ? vaultUnlocked : true}
        showVaultBadge={opts?.vaultBadge}
        onLockedPress={live.buttons.subscribe ? onUnlockVault : undefined}
        onOpenAthlete={onOpenAthlete}
        onHypeChange={onHypeChange}
        onBacked={onBacked}
        openClipId={openClipId}
      />
    );

  const tradingCard = live.profile.showCard ? (
    <AuraTradingCard
      name={name}
      username={username}
      role={role}
      roles={roles}
      jersey={jersey}
      auraPoints={auraPoints}
      subscriberCrest={subscriberCrest}
      bio={bio}
      teamName={schoolVisible ? teamName : undefined}
      mascot={schoolVisible ? mascot : undefined}
      divisionBadge={schoolVisible ? divisionBadge : undefined}
      gamesPlayed={athleteIdentity ? sportStats.career.gamesPlayed ?? undefined : undefined}
      highlightReels={publicClips.length}
      reelsUploaded={clips.length}
      totalTipsReceived={totalTipsReceived}
      totalTipsDropped={totalTipsDropped}
      pollVotes={pollVotes}
      seasonPoints={auraPoints}
      sekiCount={sekiCount}
      highlightViews={highlightViews ?? player.view_count ?? 0}
      careerPreview={athleteIdentity ? sportStats.topThree : undefined}
      sport={athleteIdentity ? sportStats.career.sport : undefined}
      wishlistFulfilled={wishlistFulfilled}
      verificationStatus={verificationStatus}
      schoolClaimed={schoolClaimed}
      onClaimVerification={onClaimVerification}
      schoolBadge={schoolVisible ? schoolBadge : null}
    />
  ) : null;

  const fanSupport = showFanSupport ? (
    <View style={styles.actionRow}>
      {live.buttons.malo && onDropMalo ? (
        <AnimatedButton
          accessibilityLabel={`Donate ${maloAmount} dollars to ${name}`}
          disabled={tipping}
          haptic="medium"
          onPress={onDropMalo}
          style={styles.actionFlex}
          contentStyle={[styles.primaryAction, tipping && styles.disabled]}
        >
          <Text style={styles.primaryActionLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            Donate ${maloAmount}
          </Text>
          </AnimatedButton>
      ) : null}
    </View>
  ) : null;

  const quickActions = (
    <>
      <View style={styles.quickActions}>
        {fanSupport}
        <AnimatedButton accessibilityLabel={SHARE_FUND_CTA} haptic="selection"
          onPress={() => setShareOpen(true)} contentStyle={styles.shareHit}>
          <Ionicons name="share-outline" size={17} color={FOCAL.jadeInk} />
          <Text style={styles.shareLabel}>Share</Text>
        </AnimatedButton>
      </View>
      {/* Someone else's profile: friend / block and the private-profile note (PRIV-01). */}
      {!ownerTools ? <ProfileFriendActions playerId={player.id} /> : null}
      {/* QUIZ-03: the viewer's own trivia round about this athlete's sport; nothing reaches the athlete. */}
      {!ownerTools && athleteIdentity ? <LearnSportCard sport={selectedSport} athleteName={name} /> : null}
    </>
  );

  return (
    <View style={styles.root}>
      {onBack || headerRight ? (
        <View style={styles.navRow}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              haptic="selection"
              onPress={onBack}
              style={styles.navBtn}
            >
              <Ionicons name="chevron-back" size={26} color={FOCAL.jadeInk} />
            </Pressable>
          ) : (
            <View style={styles.navHit} />
          )}
          {headerRight ?? <View style={styles.navHit} />}
        </View>
      ) : null}
      {leading}
      <ProfileHeroAvatar
        compact
        name={name}
        school={schoolLabel}
        jersey={jersey}
        athlete={athleteIdentity}
        sport={athleteIdentity ? selectedSport : undefined}
        position={athleteIdentity ? (ownCredentials ? profile?.athlete_position?.trim() || player.position : player.position) : undefined}
        classYear={ownCredentials ? profile?.athlete_class_year : undefined}
        auraPoints={auraPoints}
        subscriberCrest={subscriberCrest}
        showFlipControl={live.profile.showCard}
        onFlipAura={() => setFlipOpen(true)}
        verificationStatus={verificationStatus}
        schoolClaimed={schoolClaimed}
        onClaimVerification={onClaimVerification}
        avatarUrl={avatarUrl}
        canEditAvatar={editAvatar}
        onAvatarUploaded={onAvatarUploaded}
        schoolBadge={schoolVisible ? schoolBadge : null}
        footer={
          <ProfileStatRow
            player={player}
            sekiCount={sekiPeak}
            flexCount={flexPeak}
            showCrew={live.profile.showCrew}
          />
        }
      />
      {live.profile.actionsOnTop ? null : quickActions}
      {/* Brand line (BRAND-01) only where this athlete can actually be donated to; plain text, not a heading. */}
      {showDonateTagline ? <Text style={styles.donateTagline}>{TAGLINE_HEADLINE}</Text> : null}
      <View accessibilityRole="tablist" accessibilityLabel="Athlete profile sections" style={styles.sectionNav}>
        {tabs.map(item => <AnimatedButton key={item.id} accessibilityRole="tab"
          accessibilityLabel={item.label} accessibilityState={{ selected: tab === item.id }}
          haptic="selection" onPress={() => setTab(item.id)} style={styles.sectionItem}
          contentStyle={[styles.sectionButton, tab === item.id && styles.sectionButtonOn]}>
          <Ionicons name={({ highlights: 'flash-outline', stats: 'stats-chart-outline', goals: 'gift-outline',
            vault: 'lock-closed-outline', team: 'people-outline', manage: 'settings-outline' } as const)[item.id]}
            size={16} color={tab === item.id ? colors.onAccent : FOCAL.jadeInk} />
          <Text style={[styles.sectionLabel, tab === item.id && styles.sectionLabelOn]}>
            {item.id === 'highlights' ? 'Highlights' : item.id === 'stats' ? 'Stats' : item.id === 'vault' ? 'Vault' : item.label}
          </Text>
        </AnimatedButton>)}
      </View>
      {/* Look desk "Actions on top" (profile.actionsOnTop): parks Donate / Share under the section tabs. */}
      {live.profile.actionsOnTop ? quickActions : null}

      {tab === 'highlights' ? (
        <View style={styles.highlightsPane}>
          {aboutBio?.trim() || nonEmptySocialLinks(socialLinks).length > 0 ? (
            <View style={styles.about}>
              {aboutBio?.trim() ? <Text style={styles.aboutBio}>{aboutBio.trim()}</Text> : null}
              {nonEmptySocialLinks(socialLinks).length > 0 ? (
                <View style={styles.socialRow}>
                  {nonEmptySocialLinks(socialLinks).map(([platform, value]) => (
                    <Pressable
                      key={platform}
                      accessibilityRole="link"
                      accessibilityLabel={`Open ${socialLinkLabel(platform)}`}
                      haptic="selection"
                      onPress={() => void WebBrowser.openBrowserAsync(resolveSocialLinkUrl(platform, value))}
                      style={styles.socialChip}
                    >
                      <Text style={styles.socialChipLabel}>{socialLinkLabel(platform)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {publicClips.length === 0 ? (
            <Text style={styles.empty}>No Highlights ⚡ tagged yet.</Text>
          ) : (
            grid(publicClips)
          )}

        </View>
      ) : null}

      {tab === 'team' ? <View style={styles.statsPane}>
          <TeamRosterStrip
            schoolName={schoolLabel}
            players={rosterPlayers}
            activePlayerId={player.id}
            showClaimBadges={showClaimBadges}
            onOpenPlayer={(id) => onOpenAthlete?.(id)}
          />
      </View> : null}

      {tab === 'stats' ? (
        <View style={styles.statsPane}>
          <AthleteStatsTab stats={sportStats} loading={statsLoading} config={configFor(selectedSport)} />
        </View>
      ) : null}

      {tab === 'goals' ? (
        <View style={styles.statsPane}>
          <View style={styles.sectionHeading}>
            <Ionicons name="gift-outline" size={22} color={FOCAL.goldInk} />
            <View style={styles.sectionCopy}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Sports goals</Text>
              <Text style={styles.sectionHint}>Wishlist and donations for sports costs.</Text>
            </View>
          </View>
          {live.layouts.wishlist ? <LockerRoomWishlist player={player} athleteName={name}
            username={username} tipEntry={tipEntry} onEquipped={() => setWishlistFulfilled(true)} /> : null}
          {live.buttons.malo || ownCredentials ? <RallyCard player={player} athleteName={name}
            username={username} manage={ownCredentials} tipEntry={tipEntry} clips={rallyClips}
            onOpenClip={(reelId) => { setTab('highlights'); setOpenClipId(reelId); }} /> : null}
        </View>
      ) : null}

      {tab === 'manage' && ownerTools ? (
        <View style={styles.statsPane}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Your locker room</Text>
          {actions}
          {trailing}
          {manageVault && live.buttons.vault ? <VaultLockCard locked={sealed} busy={vaultLockBusy}
            onToggle={(next) => onVaultLockChange?.(next)} /> : null}
          {ownCredentials ? <AccountTagInbox /> : null}
          {ownCredentials ? <ReceivedMaloPanel playerId={player.id} /> : null}
        </View>
      ) : null}

      {tab === 'vault' && live.buttons.vault && live.profile.showVault ? (
        <View style={styles.vault}>
          {manageVault ? (
            <Text style={styles.empty}>
              Long-press a clip on Highlights ⚡ or here to move it into the Vault. Lock the Vault so fans
              subscribe to watch.
            </Text>
          ) : sealed && !subscribed && live.buttons.subscribe ? (
            <VaultLockedCard busy={vaultBusy} onUnlock={() => onUnlockVault?.()} />
          ) : subscribed ? (
            <SubscriberQnA athleteId={player.id} athleteName={player.name} />
          ) : null}
          {vaultClips.length === 0 ? (
            <Text style={styles.empty}>No Vault clips yet.</Text>
          ) : (
            grid(vaultClips, { vaultBadge: true, lock: true })
          )}
        </View>
      ) : null}



      <Modal
        transparent
        animationType="fade"
        visible={flipOpen && Boolean(tradingCard)}
        onRequestClose={() => setFlipOpen(false)}
      >
        {/* A Modal is its own native root: without this the card's tap-to-flip gesture never fires. */}
        <GestureHandlerRootView style={styles.flipGestureRoot}>
        <View
          style={[
            styles.flipRoot,
            {
              paddingHorizontal: frame.dock.paddingHorizontal,
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <Pressable haptic="none" style={styles.flipDim} onPress={() => setFlipOpen(false)} />
          <View style={[styles.flipSheet, frame.card]}>
            <Text style={styles.flipKicker}>Aura card</Text>
            {tradingCard}
            <AnimatedButton
              accessibilityLabel="Close Aura card"
              haptic="selection"
              onPress={() => setFlipOpen(false)}
              contentStyle={styles.flipClose}
            >
              <Text style={styles.flipCloseLabel}>Done</Text>
            </AnimatedButton>
          </View>
        </View>
        </GestureHandlerRootView>
      </Modal>
      <ShareQrModal
        visible={shareOpen}
        athleteName={name}
        username={username}
        onClose={() => setShareOpen(false)}
      />
    </View>
  );
}

/**
 * @purpose Seki, Riding, Crew, and Squad as separate counts. Join sits under Crew only.
 * @param player Athlete whose Crew graph we load.
 * @param sekiCount Peak Seki on this athlete.
 * @param flexCount Peak Flex on this athlete.
 * @param showCrew When false, the Crew column is omitted.
 * @sideEffects `useCrew` RPC; SoftWall on Join.
 */
function ProfileStatRow({
  player,
  sekiCount,
  flexCount,
  showCrew,
}: {
  player: Player;
  sekiCount: number;
  flexCount: number;
  showCrew: boolean;
}) {
  const { profile } = useAuth();
  const { live } = useAppRuntime();
  const { requireAuth } = useSoftWall();
  const crew = useCrew(player.id);
  const isOwn = Boolean(profile?.player_id && profile.player_id === player.id);

  const onJoin = () => {
    requireAuth({
      kind: 'crew',
      athleteName: player.name,
      athleteId: player.id,
      resume: () => {
        void crew.toggle();
      },
    });
  };

  const showJoin = showCrew && live.buttons.crew && !isOwn;

  const join = showJoin ? (
    crew.mutual ? (
      <TeammatesBadge onPress={onJoin} disabled={crew.busy} compact />
    ) : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={crew.following ? IN_CREW_LABEL : JOIN_CREW_LABEL}
        accessibilityState={{ disabled: crew.busy, selected: crew.following }}
        disabled={crew.busy}
        haptic="medium"
        hitSlop={6}
        onPress={onJoin}
        style={[styles.joinIcon, crew.following && styles.joinIconOn]}
      >
        <Ionicons
          name={crew.following ? 'checkmark' : 'flash'}
          size={18}
          color={crew.following ? FOCAL.jadeInk : '#FFFFFF'}
        />
      </Pressable>
    )
  ) : null;

  return (
    <View style={styles.statRow}>
      <ProfileCount value={sekiCount} label="Seki" color={FOCAL.cyanInk} accessibilityLabel={`${formatCompactCount(sekiCount)} Seki`} reserveAction={showJoin} />
      <ProfileCount value={flexCount} label="Riding" color={FOCAL.goldInk} accessibilityLabel={`${formatCompactCount(flexCount)} riding with ${player.name}`} reserveAction={showJoin} />
      {showCrew ? (
        <>
          <ProfileCount
            value={crew.crew_count}
            label="Crew"
            color={FOCAL.jadeInk}
            accessibilityLabel={`${CREW_COUNTER_LABEL} ${crew.crew_count}`}
            action={join}
          />
          <ProfileCount
            value={crew.squad_count}
            label="Squad"
            color={FOCAL.violetInk}
            accessibilityLabel={`${SQUAD_COUNTER_LABEL} ${crew.squad_count}`}
            reserveAction={showJoin}
          />
        </>
      ) : null}
    </View>
  );
}

function ProfileCount({
  value,
  label,
  color,
  accessibilityLabel,
  action,
  reserveAction = false,
}: {
  value: number;
  label: string;
  color: string;
  accessibilityLabel: string;
  action?: ReactNode;
  reserveAction?: boolean;
}) {
  return (
    <View style={styles.stat} accessibilityRole={action ? undefined : 'text'} accessibilityLabel={action ? undefined : accessibilityLabel}>
      <Text style={[styles.statValue, { color }]} accessibilityLabel={action ? accessibilityLabel : undefined}>
        {formatCompactCount(value)}
      </Text>
      {action ?? (reserveAction ? <View style={styles.joinSlot} /> : null)}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TeammatesBadge({
  onPress,
  disabled,
  compact = false,
}: {
  onPress: () => void;
  disabled: boolean;
  compact?: boolean;
}) {
  const pulse = useSharedValue(0.42);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.92 + pulse.value * 0.12 }],
  }));

  return (
    <AnimatedButton
      accessibilityRole="button"
      accessibilityLabel={TEAMMATES_BADGE}
      disabled={disabled}
      haptic="light"
      onPress={onPress}
      style={styles.teammatesWrap}
      contentStyle={[styles.teammatesHit, compact && styles.teammatesHitCompact]}
    >
      {compact ? (
        <View style={styles.joinIcon}>
          <Ionicons name="people" size={18} color="#FFFFFF" />
        </View>
      ) : (
        <>
          <Reanimated.View pointerEvents="none" style={[styles.teammatesGlow, glowStyle]} />
          <View style={styles.teammatesBadge}>
            <Text style={styles.teammatesLabel} numberOfLines={1}>
              {TEAMMATES_BADGE}
            </Text>
          </View>
        </>
      )}
    </AnimatedButton>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
    overflow: 'visible',
  },
  highlightsPane: {
    gap: 16,
  },
  vault: {
    gap: 12,
  },
  statsPane: {
    gap: 16,
  },
  about: {
    gap: 10,
  },
  aboutBio: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.text,
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  socialChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  socialChipLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: FOCAL.jadeInk,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  navHit: {
    width: 44,
    height: 44,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FOCAL.mistJade,
    borderWidth: 1,
    borderColor: 'rgba(0,115,60,0.18)',
  },
  sectionNav: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sectionItem: { flexGrow: 1, minWidth: 78 },
  sectionButton: { minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radii.md, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: FOCAL.mistJade },
  sectionButtonOn: { backgroundColor: FOCAL.jadeInk },
  sectionLabel: { color: FOCAL.jadeInk, fontSize: 12, fontWeight: '800' },
  sectionLabelOn: { color: colors.onAccent },
  donateTagline: { fontSize: 12, lineHeight: 17, fontWeight: '700', color: colors.textMuted },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'stretch' },
  actionRow: { flex: 1, flexDirection: 'row', gap: 8, minWidth: 180 },
  sectionHeading: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  sectionCopy: { flex: 1 },
  sectionTitle: { fontSize: 21, fontWeight: '900', color: colors.text },
  sectionHint: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  actionFlex: {
    flex: 1,
  },
  primaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: FOCAL.goldInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  primaryActionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  shareHit: {
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: FOCAL.neonJade,
    backgroundColor: FOCAL.mistJade,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  shareLabel: {
    color: FOCAL.jadeInk,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 18,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    gap: 8,
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,20,22,0.08)',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    minWidth: 0,
  },
  statValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  joinSlot: {
    width: 36,
    height: 36,
  },
  joinIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FOCAL.jadeInk,
  },
  joinIconOn: {
    backgroundColor: FOCAL.mistJade,
    borderWidth: 1.5,
    borderColor: FOCAL.jadeInk,
  },
  squadHint: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  crewBlock: {
    gap: 0,
  },
  crewCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FOCAL.mistGold,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(138,100,0,0.22)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
  crewStat: {
    flexShrink: 0,
    minWidth: 64,
    alignItems: 'center',
    gap: 0,
    paddingHorizontal: 4,
  },
  crewValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  crewLabel: {
    color: FOCAL.goldInk,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  crewDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(138,100,0,0.22)',
  },
  crewCta: {
    flex: 1,
    marginLeft: 4,
  },
  joinCrew: {
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: FOCAL.electricGold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  joinCrewLabel: {
    color: FOCAL.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  inCrew: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: FOCAL.goldInk,
  },
  inCrewLabel: {
    color: FOCAL.goldInk,
  },
  teammatesWrap: {
    alignSelf: 'stretch',
  },
  teammatesHit: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teammatesHitCompact: {
    minHeight: 44,
  },
  teammatesGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,215,0,0.28)',
  },
  teammatesBadge: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: FOCAL.ember,
    backgroundColor: FOCAL.mistEmber,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  teammatesBadgeCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  teammatesLabel: {
    color: FOCAL.emberInk,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  teammatesLabelCompact: {
    fontSize: 12,
  },
  flipGestureRoot: {
    flex: 1,
  },
  flipRoot: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(15,20,22,0.45)',
  },
  flipDim: {
    ...StyleSheet.absoluteFill,
  },
  flipSheet: {
    backgroundColor: colors.surface,
    gap: 12,
  },
  flipKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: FOCAL.goldInk,
  },
  flipClose: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: FOCAL.jadeInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipCloseLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
