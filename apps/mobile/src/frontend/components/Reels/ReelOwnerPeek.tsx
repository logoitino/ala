import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { VarsityBadge } from '@/components/Profile/VarsityBadge';
import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useSoftWall } from '@/context/SoftWallContext';
import type { HighlightClip } from '@/data/highlights';
import { maloAthleteCta } from '@/data/malo';
import { displayValue, type Player } from '@/data/players';
import type { VerificationStatus } from '@/data/verification';
import { useCrew } from '@/hooks/useCrew';
import { auraBadgeLabel, auraTierForPoints, handleFromName, resolveAuraPoints } from '@/lib/aura';
import { formatCompactCount } from '@/lib/hype';
import { formatTipDollars } from '@/lib/reels';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { fetchPlayerVerification } from '@/lib/verification';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';
import type { UsageSurface } from '@/hooks/useSurfaceUsage';
import type { ProfilePublic } from '@/types/database';

type Poster = { name: string; handle: string; avatarUrl: string | null };

export type ReelOwnerPeekProps = {
  clip: HighlightClip;
  player: Player | null;
  /** True once the panel has snapped open — network fetches wait for this. */
  open: boolean;
  /** Mālo PaymentSheet is allowed for this clip (confirmed athlete tag). */
  maloReady: boolean;
  totalTipsCents: number;
  surface?: UsageSurface;
  onOpenProfile?: () => void;
  onTip?: () => void;
  onClose: () => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TF';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

/**
 * @purpose Owner card revealed by swiping a Highlight left or right: tagged athlete with Aura-tier ring, school ·
 * position · jersey, Varsity badge, Crew / Mālo / Seki counts, Join Crew, Mālo, and Open profile. When a fan other
 * than the athlete posted the clip, a “Posted by” line names them.
 * @param open Gate for the lazy `profiles` / `profiles_public` reads so idle pages cost nothing.
 * @param maloReady From `canDropMaloOnHighlight`; false keeps Mālo visible but routes to the profile.
 * @returns Glass panel content; the parent owns the slide gesture and placement.
 * @sideEffects `fetchPlayerVerification` (avatar + Varsity), `profiles_public` by `uploaded_by`, `useCrew` (`get_crew_graph` / `toggle_crew_follow`), Soft-Wall for guests, `TelemetryManager` feature taps.
 */
export function ReelOwnerPeek({
  clip,
  player,
  open,
  maloReady,
  totalTipsCents,
  surface = 'home',
  onOpenProfile,
  onTip,
  onClose,
}: ReelOwnerPeekProps) {
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 360;
  const { requireAuth } = useSoftWall();
  const crew = useCrew(open ? player?.id : undefined);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationStatus>('unverified');
  const [poster, setPoster] = useState<Poster | null>(null);

  const name = displayValue(player?.name, clip.athleteName);
  const school = (player?.school_name || clip.school || '').trim();
  const position = displayValue(player?.position);
  const jersey = player?.jersey_number != null && player.jersey_number > 0 ? `#${player.jersey_number}` : null;
  const auraPoints = player
    ? resolveAuraPoints(player)
    : Math.max(0, (clip.auraCount ?? 0) + (clip.sekiCount ?? 0) + (clip.flexCount ?? 0));
  const tier = auraTierForPoints(auraPoints);
  const meta = [position !== '—' ? position : null, jersey, school || null].filter(Boolean).join(' · ');

  useEffect(() => {
    if (!open || !player?.id) return;
    let live = true;
    void fetchPlayerVerification(player.id, player.name).then((result) => {
      if (!live) return;
      setAvatarUrl(result.avatarUrl);
      setVerification(result.status);
    });
    return () => {
      live = false;
    };
  }, [open, player?.id, player?.name]);

  useEffect(() => {
    const uploader = clip.uploadedBy?.trim();
    if (!open || !uploader || !isSupabaseConfigured) return;
    let live = true;
    void supabase
      .from('profiles_public')
      .select('id, player_id, username, full_name, avatar_url')
      // reels.uploaded_by is profiles.id, not the auth user id.
      .eq('id', uploader)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        const row = data as Pick<ProfilePublic, 'id' | 'player_id' | 'username' | 'full_name' | 'avatar_url'> | null;
        if (!row || (player?.id && row.player_id === player.id)) {
          setPoster(null);
          return;
        }
        const fullName = row.full_name?.trim() || 'Tapua’i fan';
        setPoster({
          name: fullName,
          handle: row.username?.trim() || handleFromName(fullName),
          avatarUrl: row.avatar_url?.trim() || null,
        });
      });
    return () => {
      live = false;
    };
  }, [clip.uploadedBy, open, player?.id]);

  const joinCrew = () => {
    if (!player) return;
    telemetry.trackFeature(crew.following ? 'crew.leave' : 'crew.join', surface);
    if (!crew.signedIn) {
      requireAuth({
        kind: 'crew',
        athleteName: player.name,
        athleteId: player.id,
        resume: () => void crew.toggle(),
      });
      return;
    }
    void crew.toggle();
  };

  const stats: { label: string; value: string }[] = [
    { label: 'Crew', value: formatCompactCount(crew.crew_count) },
    { label: 'Mālo', value: formatTipDollars(totalTipsCents) },
    { label: 'Seki', value: formatCompactCount(player?.seki_count ?? clip.sekiCount ?? 0) },
    { label: 'Aura', value: formatCompactCount(auraPoints) },
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.panel,
        compact ? styles.panelCompact : null,
      ]}
      showsVerticalScrollIndicator={false}
      bounces={false}
      accessibilityViewIsModal={open}
      accessibilityLabel={`${name} profile peek`}
    >
      <View style={styles.topRow}>
        <View style={[styles.tierPill, { borderColor: tier.color }]}>
          <Text style={[styles.tierLabel, { color: tier.color }]} numberOfLines={1}>
            {auraBadgeLabel(tier)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close profile peek"
          haptic="selection"
          hitSlop={10}
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={18} color={colors.onVideo} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={[styles.ring, { borderColor: tier.color, shadowColor: tier.color }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: tier.face }]}>
              <Text style={[styles.initials, { color: tier.ink }]}>{initials(name)}</Text>
            </View>
          )}
        </View>
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {verification === 'verified' ? <VarsityBadge status="verified" compact /> : null}
          </View>
          <Text style={styles.handle} numberOfLines={1}>
            @{handleFromName(name)}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={2}>
              {meta}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.stats} accessibilityRole="summary">
        {stats.map((stat, index) =>
          open ? (
            <Animated.View key={stat.label} entering={FadeInUp.delay(60 + index * 45).springify()} style={styles.stat}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Animated.View>
          ) : (
            <View key={stat.label} style={styles.stat}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ),
        )}
      </View>

      {clip.tag ? (
        <Text style={styles.caption} numberOfLines={2}>
          “{clip.tag}”
        </Text>
      ) : null}

      {poster ? (
        <Animated.View entering={FadeInDown.delay(180)} style={styles.posterRow}>
          {poster.avatarUrl ? (
            <Image source={{ uri: poster.avatarUrl }} style={styles.posterAvatar} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.posterAvatar, styles.posterFallback]}>
              <Text style={styles.posterInitials}>{initials(poster.name)}</Text>
            </View>
          )}
          <Text style={styles.posterLabel} numberOfLines={1}>
            Posted by <Text style={styles.posterName}>@{poster.handle}</Text>
          </Text>
        </Animated.View>
      ) : null}

      <View style={styles.actions}>
        {player ? (
          <AnimatedPressable
            accessibilityLabel={crew.following ? `Leave ${name} Crew` : `Join ${name} Crew`}
            accessibilityState={{ selected: crew.following, disabled: crew.busy }}
            disabled={crew.busy}
            haptic="medium"
            scaleTo={0.94}
            onPress={joinCrew}
            contentStyle={[styles.crewBtn, styles.actionHalf, crew.following && styles.crewBtnOn]}
          >
            <Ionicons name={crew.following ? 'flash' : 'flash-outline'} size={16} color={crew.following ? FOCAL.ink : FOCAL.neonJade} />
            <Text style={[styles.crewLabel, crew.following && styles.crewLabelOn]}>
              {crew.following ? 'In Crew' : 'Join Crew'}
            </Text>
          </AnimatedPressable>
        ) : null}
        {onTip ? (
          <AnimatedPressable
            accessibilityLabel={maloReady ? maloAthleteCta(name) : `Confirm ${name} on this clip before Mālo`}
            haptic="medium"
            scaleTo={0.94}
            onPress={onTip}
            contentStyle={[styles.maloBtn, styles.actionHalf, !maloReady && styles.maloBtnPending]}
          >
            <Text style={styles.maloLabel}>{maloReady ? 'Mālo' : 'Tag'}</Text>
          </AnimatedPressable>
        ) : null}
      </View>

      <AnimatedPressable
        accessibilityLabel={`Open ${name} profile`}
        accessibilityState={{ disabled: !onOpenProfile }}
        disabled={!onOpenProfile}
        haptic="light"
        scaleTo={0.96}
        overshoot={false}
        onPress={onOpenProfile}
        contentStyle={[styles.openBtn, { borderColor: tier.color }, !onOpenProfile && styles.disabled]}
      >
        <Text style={styles.openLabel}>Open full profile</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.onVideo} />
      </AnimatedPressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  panel: {
    flexGrow: 1,
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  panelCompact: {
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tierPill: {
    flexShrink: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.videoScrimSoft,
  },
  tierLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.videoScrimSoft,
    borderWidth: 1,
    borderColor: 'rgba(243,251,247,0.18)',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ring: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
    backgroundColor: FOCAL.videoBase,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    color: colors.onVideo,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  handle: {
    color: FOCAL.neonJade,
    fontSize: 13,
    fontWeight: '800',
  },
  meta: {
    color: colors.onVideoMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: 'rgba(243,251,247,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(243,251,247,0.12)',
  },
  statValue: {
    color: colors.onVideo,
    fontSize: 15,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.onVideoMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  caption: {
    color: colors.onVideo,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    opacity: 0.9,
  },
  posterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  posterAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(243,251,247,0.16)',
  },
  posterInitials: {
    color: colors.onVideo,
    fontSize: 9,
    fontWeight: '900',
  },
  posterLabel: {
    flex: 1,
    color: colors.onVideoMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  posterName: {
    color: colors.onVideo,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  actionHalf: {
    flex: 1,
    flexBasis: 0,
  },
  crewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: FOCAL.neonJade,
    backgroundColor: 'rgba(0,230,118,0.10)',
  },
  crewBtnOn: {
    backgroundColor: FOCAL.neonJade,
  },
  crewLabel: {
    color: FOCAL.neonJade,
    fontSize: 14,
    fontWeight: '800',
  },
  crewLabelOn: {
    color: FOCAL.ink,
  },
  maloBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: FOCAL.neonJade,
    paddingHorizontal: 14,
  },
  maloBtnPending: {
    backgroundColor: 'rgba(243,251,247,0.16)',
  },
  maloLabel: {
    color: FOCAL.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1.5,
    backgroundColor: colors.videoScrimSoft,
  },
  openLabel: {
    color: colors.onVideo,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.86,
  },
  disabled: {
    opacity: 0.5,
  },
});
