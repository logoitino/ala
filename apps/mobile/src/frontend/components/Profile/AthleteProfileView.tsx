/**
 * The public athlete page shown at /user/[id]: hero card, Aura trading card, crew and teammate badges, Rally,
 * filmer card, the viewer's "Learn {sport} with {name}" trivia card (QUIZ-03), and direct Highlights / Stats / Goals /
 * Vault / owner Manage navigation. QUIZ-05: the Learn card also receives the athlete's player id (a server-validated
 * hint for that trivia round).
 * Used by both the fan tab's own profile and any athlete opened from elsewhere. `onOpenClip` lets other
 * components (for example a Rally thank-you) jump to a specific clip in the Highlights tab.
 * Story names only the existing caller-visible authored text and social links in that same Highlights pane.
 * R4-03 split (behaviour unchanged): the hero count row lives in `ProfileStatRow.tsx`, the Aura card sheet in `AuraCardFlipModal.tsx`.
 * @sideEffects Reads athlete, crew, school badge, leaderboard and reel data through hooks / lib.
 */

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSchoolBadge } from '@/hooks/useSchoolBadge';
import { useSheetFrame } from '@/hooks/useSheetFrame';

import { VaultLockedCard } from '@/components/Profile/ExclusivePaywall';
import { AthleteReelManager } from '@/components/Profile/AthleteReelManager';
import { AthleteStatsTab } from '@/components/Profile/AthleteStatsTab';
import { AuraCardFlipModal } from '@/components/Profile/AuraCardFlipModal';
import { AuraTradingCard } from '@/components/Profile/AuraTradingCard';
import { LockerRoomWishlist } from '@/components/Profile/LockerRoomWishlist';
import { AccountTagInbox } from '@/components/Profile/AccountTagInbox';
import { ReceivedMaloPanel } from '@/components/Profile/ReceivedMaloPanel';
import { RallyCard } from '@/components/Rally/RallyCard';
import { ProfileHeroAvatar } from '@/components/Profile/ProfileHeroAvatar';
import { ProfileStatRow } from '@/components/Profile/ProfileStatRow';
import { ShareQrModal } from '@/components/Profile/ShareQrModal';
import { SubscriberQnA } from '@/components/Profile/SubscriberQnA';
import { TeamRosterStrip } from '@/components/Profile/TeamRosterStrip';
import { VaultLockCard } from '@/components/Profile/VaultLockCard';
import { TaggedReelGrid } from '@/components/Profile/TaggedReelGrid';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii, space } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
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
import { useSportConfigs } from '@/hooks/useSportConfigs';
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
   * as the "Story" section within Highlights when present. */
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
  // Public callers already filter these fields; a new section must never fall back to viewer or roster data.
  const storyText = aboutBio?.trim();
  const visibleSocialLinks = nonEmptySocialLinks(socialLinks);
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
      {!ownerTools && athleteIdentity ? <LearnSportCard sport={selectedSport} athleteName={name} athletePlayerId={player.id} /> : null}
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
          {storyText || visibleSocialLinks.length > 0 ? (
            <View style={styles.story}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Story</Text>
              {storyText ? <Text style={styles.storyBio}>{storyText}</Text> : null}
              {visibleSocialLinks.length > 0 ? (
                <View style={styles.socialRow}>
                  {visibleSocialLinks.map(([platform, value]) => (
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

          <View style={styles.highlightSection}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Highlights</Text>
            {publicClips.length === 0 ? (
              <Text style={styles.highlightEmpty}>No public Highlights to show here yet.</Text>
            ) : (
              grid(publicClips)
            )}
          </View>

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



      <AuraCardFlipModal
        flipOpen={flipOpen}
        setFlipOpen={setFlipOpen}
        tradingCard={tradingCard}
        insets={insets}
        frame={frame}
      />
      <ShareQrModal
        visible={shareOpen}
        athleteName={name}
        username={username}
        playerId={player.id}
        onClose={() => setShareOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
    overflow: 'visible',
  },
  highlightsPane: {
    gap: space.xl,
  },
  vault: {
    gap: 12,
  },
  statsPane: {
    gap: 16,
  },
  story: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  storyBio: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
  },
  highlightSection: {
    gap: space.sm,
  },
  highlightEmpty: {
    padding: space.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  socialChip: {
    minHeight: 44,
    minWidth: 44,
    maxWidth: '100%',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialChipLabel: {
    fontSize: 14,
    fontWeight: '700',
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
});
