import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { VaultLockedCard } from '@/components/ExclusivePaywall';
import { AthleteReelManager } from '@/components/Profile/AthleteReelManager';
import { AthleteStatsTab } from '@/components/Profile/AthleteStatsTab';
import { AuraTradingCard } from '@/components/Profile/AuraTradingCard';
import { SubscriberQnA } from '@/components/Profile/SubscriberQnA';
import { VaultLockCard } from '@/components/Profile/VaultLockCard';
import { TaggedReelGrid } from '@/components/TaggedReelGrid';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { FilterPills } from '@/components/UI/FilterPills';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useAuth } from '@/context/AuthContext';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import {
  CREW_COUNTER_LABEL,
  IN_CREW_LABEL,
  JOIN_CREW_LABEL,
  JOIN_CREW_SIGN_IN,
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
import type { AthleteStatsBundle } from '@/data/athleteStats';
import { useCrew } from '@/hooks/useCrew';
import { formatCompactCount } from '@/lib/hype';
import type { Player, UserRole } from '@/types/database';
import type { ReelHype } from '@/lib/reels';
import { isVaultSealed } from '@/lib/vault';
import { FOCAL } from '@/theme/motion';

export type AthleteProfileTab = 'highlights' | 'stats' | 'vault';

const PROFILE_TABS: { id: AthleteProfileTab; label: string }[] = [
  { id: 'highlights', label: HIGHLIGHT_TAB_LABEL },
  { id: 'stats', label: STATS_TAB_LABEL },
  { id: 'vault', label: VAULT_TAB_LABEL },
];

type AthleteProfileViewProps = {
  player: Player;
  clips: HighlightClip[];
  stats: AthleteStatsBundle;
  statsLoading?: boolean;
  name: string;
  username?: string | null;
  jersey?: string | number;
  bio?: string;
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
  /** Owner Athlete Management: long-press vault placement. */
  manageVault?: boolean;
  tipping?: boolean;
  vaultBusy?: boolean;
  /** `players.vault_locked`. Default sealed (fans must subscribe). */
  vaultLocked?: boolean | null;
  vaultLockBusy?: boolean;
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
 * @purpose Unified athlete sheet: 3D Aura trading card, The Crew ⚡ / Your Squad 🛡️, Highlights ⚡ / Stats 📊 / Vault 🔒. Shared by own Profile and `/user/[id]`.
 * @param player Roster identity for grids, Mālo, and Stats.
 * @param clips Tagged `reels` (public + vault); tabs split them.
 * @param stats Combine + career + game log for Stats 📊 and the card back-face preview.
 * @param manageVault When true, vault tiles stay playable and long-press moves clips. Shows Lock Vault 🔒 and Flash Unlock.
 * @param vaultLocked Master seal. When true, non-subscribers see the subscribe wall on Vault 🔒.
 * @param leading / actions / trailing Own-profile chrome (heading, Mālo, Account Settings).
 * @returns Card + Crew counters + Join Crew / Teammates + segmented tabs + the active pane. Parent owns the ScrollView.
 * @sideEffects Child grids / vault manager / Q&A / `useCrew` hit Supabase and Stripe via their own hooks.
 */
export function AthleteProfileView({
  player,
  clips,
  stats,
  statsLoading = false,
  name,
  username,
  jersey,
  bio,
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
  const { live } = useAppRuntime();
  const [tab, setTab] = useState<AthleteProfileTab>('highlights');
  const publicClips = useMemo(() => clips.filter((clip) => !isClipVaultOnly(clip)), [clips]);
  const vaultClips = useMemo(() => clips.filter((clip) => isClipVaultOnly(clip)), [clips]);
  const sealed = isVaultSealed(vaultLocked);
  const vaultUnlocked = manageVault || subscribed || !sealed;
  const tabs = PROFILE_TABS.filter((item) => {
    if (item.id === 'vault') return live.buttons.vault && live.profile.showVault;
    if (item.id === 'stats') return live.profile.showStats;
    return true;
  });

  useEffect(() => {
    if (tab === 'vault' && (!live.buttons.vault || !live.profile.showVault)) setTab('highlights');
    if (tab === 'stats' && !live.profile.showStats) setTab('highlights');
  }, [live.buttons.vault, live.profile.showStats, live.profile.showVault, tab]);

  useEffect(() => {
    if (live.profile.statsFirst && live.profile.showStats) setTab('stats');
  }, [live.profile.showStats, live.profile.statsFirst]);

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
      />
    ) : (
      <TaggedReelGrid
        clips={rows}
        player={player}
        tipping={tipping}
        subscribed={opts?.lock ? vaultUnlocked : true}
        showVaultBadge={opts?.vaultBadge}
        onLockedPress={onUnlockVault}
        onOpenAthlete={onOpenAthlete}
        onHypeChange={onHypeChange}
        onBacked={onBacked}
      />
    );

  return (
    <View style={styles.root}>
      {leading}
      {live.profile.actionsOnTop ? actions : null}
      {live.profile.showCard ? (
      <AuraTradingCard
        name={name}
        username={username}
        role={role}
        roles={roles}
        jersey={jersey}
        auraPoints={auraPoints}
        subscriberCrest={subscriberCrest}
        bio={bio}
        teamName={teamName}
        mascot={mascot}
        divisionBadge={divisionBadge}
        gamesPlayed={stats.career.gamesPlayed}
        highlightReels={publicClips.length}
        reelsUploaded={clips.length}
        totalTipsReceived={totalTipsReceived}
        totalTipsDropped={totalTipsDropped}
        pollVotes={pollVotes}
        seasonPoints={auraPoints}
        sekiCount={sekiCount}
        highlightViews={player.view_count ?? 0}
        careerPreview={stats.topThree}
      />
      ) : null}
      {live.profile.showCrew ? <CrewStatsBar player={player} /> : null}
      {live.profile.actionsOnTop ? null : actions}
      {trailing}
      {manageVault && live.buttons.vault ? (
        <VaultLockCard locked={sealed} busy={vaultLockBusy} onToggle={(next) => onVaultLockChange?.(next)} />
      ) : null}
      <FilterPills
        items={tabs}
        value={tab}
        onChange={(id) => setTab(id ?? 'highlights')}
        accessibilityLabel="Athlete profile sections"
      />
      {tab === 'highlights' ? (
        publicClips.length === 0 ? (
          <Text style={styles.empty}>No Highlights ⚡ tagged yet.</Text>
        ) : (
          grid(publicClips)
        )
      ) : null}
      {tab === 'stats' ? <AthleteStatsTab stats={stats} loading={statsLoading} /> : null}
      {tab === 'vault' && live.buttons.vault && live.profile.showVault ? (
        <View style={styles.vault}>
          {manageVault ? (
            <Text style={styles.empty}>
              Long-press a clip on Highlights ⚡ or here to move it into the Vault. Lock the Vault so fans
              subscribe to watch.
            </Text>
          ) : sealed && !subscribed ? (
            <VaultLockedCard busy={vaultBusy} onUnlock={() => onUnlockVault?.()} />
          ) : subscribed ? (
            <SubscriberQnA athleteId={player.id} athleteName={player.name} />
          ) : null}
          {vaultClips.length === 0 ? (
            <Text style={styles.empty}>
              {manageVault ? 'No Vault 🔒 clips yet. Long-press a Highlight to vault it.' : 'No Vault 🔒 clips yet.'}
            </Text>
          ) : (
            grid(vaultClips, { vaultBadge: true, lock: sealed })
          )}
        </View>
      ) : null}
    </View>
  );
}

/**
 * @purpose The Crew ⚡ / Your Squad 🛡️ counters plus Join Crew ⚡ or a glowing Teammates 🤝 badge.
 * @param player Athlete whose Crew graph we load.
 * @returns Two counters and a follow CTA (hidden on your own sheet).
 * @sideEffects `useCrew` RPC; toast when a guest taps Join Crew.
 */
function CrewStatsBar({ player }: { player: Player }) {
  const { profile } = useAuth();
  const { live } = useAppRuntime();
  const celebration = useOptionalCelebration();
  const crew = useCrew(player.id);
  const isOwn =
    Boolean(profile?.full_name?.trim()) &&
    player.name.trim().toLowerCase() === profile!.full_name.trim().toLowerCase();

  const onJoin = () => {
    if (!crew.signedIn) {
      celebration?.showToast(JOIN_CREW_SIGN_IN);
      return;
    }
    void crew.toggle();
  };

  return (
    <View style={styles.crewBlock}>
      <View style={styles.crewCounts}>
        <View style={styles.crewStat} accessibilityRole="text" accessibilityLabel={`${CREW_COUNTER_LABEL} ${crew.crew_count}`}>
          <Text style={styles.crewValue}>{formatCompactCount(crew.crew_count)}</Text>
          <Text style={styles.crewLabel}>{CREW_COUNTER_LABEL}</Text>
        </View>
        <View style={styles.crewDivider} />
        <View style={styles.crewStat} accessibilityRole="text" accessibilityLabel={`${SQUAD_COUNTER_LABEL} ${crew.squad_count}`}>
          <Text style={styles.crewValue}>{formatCompactCount(crew.squad_count)}</Text>
          <Text style={styles.crewLabel}>{SQUAD_COUNTER_LABEL}</Text>
        </View>
      </View>
      {!live.buttons.crew || isOwn ? null : crew.mutual ? (
        <TeammatesBadge onPress={onJoin} disabled={crew.busy} />
      ) : (
        <AnimatedButton
          accessibilityRole="button"
          accessibilityLabel={crew.following ? IN_CREW_LABEL : JOIN_CREW_LABEL}
          accessibilityState={{ disabled: crew.busy, selected: crew.following }}
          disabled={crew.busy}
          haptic="medium"
          onPress={onJoin}
          contentStyle={[styles.joinCrew, crew.following && styles.inCrew]}
        >
          <Text style={[styles.joinCrewLabel, crew.following && styles.inCrewLabel]}>
            {crew.following ? IN_CREW_LABEL : JOIN_CREW_LABEL}
          </Text>
        </AnimatedButton>
      )}
    </View>
  );
}

function TeammatesBadge({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
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
      contentStyle={styles.teammatesHit}
    >
      <Reanimated.View pointerEvents="none" style={[styles.teammatesGlow, glowStyle]} />
      <View style={styles.teammatesBadge}>
        <Text style={styles.teammatesLabel}>{TEAMMATES_BADGE}</Text>
      </View>
    </AnimatedButton>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
  },
  vault: {
    gap: 12,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 18,
  },
  crewBlock: {
    gap: 10,
  },
  crewCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  crewStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  crewValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  crewLabel: {
    color: FOCAL.neonJade,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  crewDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  joinCrew: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  joinCrewLabel: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '800',
  },
  inCrew: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: FOCAL.neonJade,
  },
  inCrewLabel: {
    color: FOCAL.neonJade,
  },
  teammatesWrap: {
    alignSelf: 'stretch',
  },
  teammatesHit: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teammatesGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0,230,118,0.28)',
  },
  teammatesBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FOCAL.neonJade,
    backgroundColor: 'rgba(0,230,118,0.16)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  teammatesLabel: {
    color: FOCAL.neonJade,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
