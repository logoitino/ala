/**
 * The card revealed by swiping a Highlight sideways (video or photo story): who owns the clip, in Island Daylight
 * chrome with a tier-colored header, what the clip is, four stats in a fixed 2 x 2 grid, Join Crew / Donate, and
 * Open full profile. The header (tier pill + Close) and the action footer are pinned outside the scroll area, so the
 * primary action is always on screen; identity, the clip row and stats scroll between them. Fetches lazily, only once the panel has opened. `ReelPage` owns the slide and the card shell
 * (rounded light surface); this file owns everything inside it.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useReducedMotion } from 'react-native-reanimated';

import { VarsityBadge } from '@/components/Profile/VarsityBadge';
import { AnimatedPressable } from '@/components/UI/AnimatedPressable';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, MENU_METRICS } from '@/constants/theme';
import { useSoftWall } from '@/context/SoftWallContext';
import { isPhotoStory, type HighlightClip } from '@/data/highlights';
import { maloAthleteCta } from '@/data/malo';
import { displayValue, type Player } from '@/data/players';
import type { VerificationStatus } from '@/data/verification';
import { useCrew } from '@/hooks/useCrew';
import { auraBadgeLabel, auraTierForPoints, resolveAuraPoints } from '@/lib/aura';
import { formatCompactCount } from '@/lib/hype';
import { formatTipDollars } from '@/lib/reels';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { fetchPlayerVerification } from '@/lib/verification';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';
import type { UsageSurface } from '@/hooks/useSurfaceUsage';
import type { ProfilePublic } from '@/types/database';

/** Fan who posted the clip. `handle` is null when the account has no username; the name is shown instead. */
type Poster = { name: string; handle: string | null; avatarUrl: string | null };

export type ReelOwnerPeekProps = {
  clip: HighlightClip;
  player: Player | null;
  /** True once the panel has snapped open — network fetches wait for this. */
  open: boolean;
  /** Donation PaymentSheet is allowed for this clip (confirmed athlete tag). */
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

/** Real account handle without a leading @, or null. Never derived from a display name. */
function cleanHandle(value: string | null | undefined): string | null {
  const handle = (value ?? '').replace(/^@/, '').trim();
  return handle || null;
}

/** Plain-words kind line for the "On this clip" row, so a photo story reads differently from a video. */
function clipKindLabel(clip: HighlightClip): string {
  if (!isPhotoStory(clip)) return 'Video highlight';
  const count = clip.photoCount ?? 0;
  if (count <= 0) return 'Photo story';
  return `Photo story · ${count} ${count === 1 ? 'photo' : 'photos'}`;
}

/**
 * @purpose Owner card revealed by swiping a Highlight left or right, identical for a video and a photo story:
 * tier-washed header (Aura tier pill, avatar ring, name, real @username when the athlete has an account, position ·
 * jersey · school, Varsity badge), an "On this clip" row (the tag in quotes, else just the clip kind), a “Posted by”
 * line when a fan other than the athlete posted it, Crew / Donations / Seki / Aura in a 2 x 2 grid, Join Crew and
 * Donate side by side, and Open full profile. One primary action: Donate when the athlete is confirmed on the clip;
 * otherwise (pending tag, or no donate handler) Open full profile takes over the filled style.
 * @param open Gate for the lazy `profiles` / `profiles_public` reads so idle pages cost nothing.
 * @param maloReady From `canDropMaloOnHighlight`; false keeps the button visible as “Tag” and routes to the tag prompt.
 * @returns Card content with a pinned header and footer around a scrolling middle; the parent owns the slide gesture, placement and the card background.
 * @sideEffects `fetchPlayerVerification` (avatar + Varsity), `profiles_public` by `player_id` (username) and by `uploaded_by` (poster), `useCrew` (`get_crew_graph` / `toggle_crew_follow`), Soft-Wall for guests, `TelemetryManager` feature taps.
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
  const { width: windowWidth, fontScale } = useWindowDimensions();
  // Under 380 pt (a 320 / 375 phone) the card slims its header so identity + stats + the pinned actions fit.
  const compact = windowWidth < 380;
  // At large text sizes a pinned footer would take most of the card, so it scrolls with the content instead.
  const largeText = fontScale >= 1.3;
  const reduceMotion = useReducedMotion();
  const nameRef = useRef<Text>(null);
  const { requireAuth } = useSoftWall();
  const crew = useCrew(open ? player?.id : undefined);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [verification, setVerification] = useState<VerificationStatus>('unverified');
  const [handle, setHandle] = useState<string | null>(null);
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
  const tag = (clip.tag ?? '').trim();
  const kind = clipKindLabel(clip);
  const photo = isPhotoStory(clip);

  // Screen readers: when the card opens, move focus onto the athlete's name so the swipe does not leave the reader on
  // the (now hidden) video. Delayed past the slide-in so the target is on screen; a no-op without a screen reader.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const tag = nameRef.current ? findNodeHandle(nameRef.current) : null;
      if (tag != null) AccessibilityInfo.setAccessibilityFocus(tag);
    }, 350);
    return () => clearTimeout(timer);
  }, [open]);

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

  // The real @username of the account linked to this athlete (`profiles.player_id` is server-only, so the link is
  // exact). No linked account means no handle line: a guess built from the name could point at a stranger.
  useEffect(() => {
    if (!open || !player?.id || !isSupabaseConfigured) {
      setHandle(null);
      return;
    }
    let live = true;
    void supabase
      .from('profiles_public')
      .select('username')
      .eq('player_id', player.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        setHandle(cleanHandle((data as Pick<ProfilePublic, 'username'> | null)?.username));
      });
    return () => {
      live = false;
    };
  }, [open, player?.id]);

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
        setPoster({
          name: row.full_name?.trim() || 'Tapua’i fan',
          handle: cleanHandle(row.username),
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
    { label: 'Donations', value: formatTipDollars(totalTipsCents) },
    { label: 'Seki', value: formatCompactCount(player?.seki_count ?? clip.sekiCount ?? 0) },
    { label: 'Aura', value: formatCompactCount(auraPoints) },
  ];
  // A fixed 2 x 2 grid: two tiles per row at every width and text size, never a 3 + 1 wrap.
  const statRows = [stats.slice(0, 2), stats.slice(2, 4)];

  // One filled (primary) action at a time. Donate leads when the athlete is confirmed on this clip; otherwise the
  // profile link takes the filled style so the card always has exactly one obvious next step.
  const donatePrimary = Boolean(onTip) && maloReady;
  const profilePrimary = !donatePrimary && Boolean(onOpenProfile);
  const posterName = poster ? (poster.handle ? `@${poster.handle}` : poster.name) : '';
  // Spoken forms: the middle dot and bullet in the visible text are read aloud as punctuation by some readers.
  const spokenKind = kind.replace(' · ', ', ');
  const spokenMeta = meta.replace(/ · /g, ', ');

  // Pinned footer: the primary action stays on screen whatever the phone height (unpinned at large text sizes).
  const footer = (
    <View style={[styles.footer, compact && styles.footerCompact]}>
      {player || onTip ? (
        <View style={[styles.actions, compact && styles.actionsCompact]}>
          {player ? (
            <AnimatedPressable
              accessibilityLabel={crew.following ? `In Crew, leave ${name} Crew` : `Join Crew, follow ${name}`}
              accessibilityState={{ selected: crew.following, disabled: crew.busy }}
              disabled={crew.busy}
              haptic="medium"
              scaleTo={0.94}
              onPress={joinCrew}
              style={styles.actionHalf}
              contentStyle={[styles.actionFill, compact && styles.actionFillCompact, styles.crewBtn, crew.following && styles.crewBtnOn]}
            >
              {largeText ? null : (
              <Ionicons name={crew.following ? 'checkmark-circle' : 'flash-outline'} size={16} color={FOCAL.jadeInk} />
            )}
              <Text style={styles.crewLabel} numberOfLines={2}>
                {crew.following ? 'In Crew' : 'Join Crew'}
              </Text>
            </AnimatedPressable>
          ) : null}
          {onTip ? (
            <AnimatedPressable
              accessibilityLabel={maloReady ? maloAthleteCta(name) : `Tag: confirm ${name} on this clip before donating`}
              haptic="medium"
              scaleTo={0.94}
              onPress={onTip}
              style={styles.actionHalf}
              contentStyle={[
                styles.actionFill,
                compact && styles.actionFillCompact,
                styles.tipBtn,
                !maloReady && styles.tipBtnPending,
              ]}
            >
              <Text
                style={[styles.tipLabel, !maloReady && styles.tipLabelPending]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {maloReady ? 'Donate' : 'Tag'}
              </Text>
            </AnimatedPressable>
          ) : null}
        </View>
      ) : null}

      <AnimatedPressable
        accessibilityLabel={`Open full profile for ${name}`}
        accessibilityState={{ disabled: !onOpenProfile }}
        disabled={!onOpenProfile}
        haptic="light"
        scaleTo={0.96}
        overshoot={false}
        onPress={onOpenProfile}
        contentStyle={[styles.openBtn, profilePrimary && styles.openBtnPrimary, !onOpenProfile && styles.disabled]}
      >
        <Text style={styles.openLabel} numberOfLines={2}>
          Open full profile
        </Text>
        <Ionicons name="arrow-forward" size={16} color={profilePrimary ? FOCAL.ink : FOCAL.jadeInk} />
      </AnimatedPressable>
    </View>
  );

  return (
    <View
      style={styles.shell}
      // The card is the modal region on iOS. The flag sits on this shell (not the ScrollView) because the pinned
      // header and footer are siblings of the scroll area and must stay reachable.
      accessibilityViewIsModal={open}
      accessibilityLabel={`${name} profile peek`}
    >
      {/* Pinned header: tier pill + Close never scroll away (44-point Close target). */}
      <View style={[styles.topBar, { backgroundColor: tier.face }]}>
        <View pointerEvents="none" style={[styles.orb, { backgroundColor: tier.glow }]} />
        <View style={[styles.tierPill, { borderColor: tier.color }]}>
          <Text
            style={[styles.tierLabel, { color: tier.ink }]}
            numberOfLines={2}
            accessibilityLabel={`Tier ${tier.tier}, ${tier.title}`}
          >
            {auraBadgeLabel(tier)}
          </Text>
        </View>
        <Pressable
          testID="peek-close"
          accessibilityRole="button"
          accessibilityLabel="Close profile peek"
          haptic="selection"
          onPress={onClose}
          style={({ pressed }) => [styles.closeTarget, pressed && styles.pressed]}
        >
          <View style={styles.closeDisc}>
            <Ionicons name="close" size={18} color={FOCAL.ink} />
          </View>
        </Pressable>
      </View>

      <ScrollView
        testID="peek-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[styles.hero, { backgroundColor: tier.face }, compact && styles.heroCompact]}>
          <View style={[styles.avatarWrap, compact && styles.avatarWrapCompact]}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.ring, compact && styles.ringCompact, { borderColor: tier.color, shadowColor: tier.color }]}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={[styles.avatar, compact && styles.avatarCompact]}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={[styles.avatar, compact && styles.avatarCompact, styles.avatarFallback, { backgroundColor: colors.surface }]}
                >
                  <Text style={[styles.initials, compact && styles.initialsCompact, { color: tier.ink }]}>{initials(name)}</Text>
                </View>
              )}
            </View>
            {verification === 'verified' && compact ? (
              <View style={styles.ringBadge}>
                <VarsityBadge status="verified" compact iconOnly />
              </View>
            ) : null}
          </View>
          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <Text
                ref={nameRef}
                accessibilityRole="header"
                style={[styles.name, compact && styles.nameCompact]}
                numberOfLines={2}
              >
                {name}
              </Text>
              {verification === 'verified' && !compact ? <VarsityBadge status="verified" compact /> : null}
            </View>
            {handle ? (
              <Text style={styles.handle} numberOfLines={1}>
                @{handle}
              </Text>
            ) : null}
            {meta ? (
              <Text style={styles.meta} numberOfLines={2} accessibilityLabel={spokenMeta}>
                {meta}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.body, compact && styles.bodyCompact]}>
          {poster ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.delay(120)}
              accessible
              accessibilityLabel={`Posted by ${posterName}`}
              style={styles.posterRow}
            >
              {poster.avatarUrl ? (
                <Image source={{ uri: poster.avatarUrl }} style={styles.posterAvatar} accessibilityIgnoresInvertColors />
              ) : (
                <View style={[styles.posterAvatar, styles.posterFallback]}>
                  <Text style={styles.posterInitials}>{initials(poster.name)}</Text>
                </View>
              )}
              <Text style={styles.posterLabel} numberOfLines={2}>
                Posted by <Text style={styles.posterName}>{posterName}</Text>
              </Text>
            </Animated.View>
          ) : null}

          <View style={styles.stats}>
            {statRows.map((row, rowIndex) => (
              <View key={row[0]!.label} style={styles.statRow}>
                {row.map((stat, colIndex) => {
                  const tile = (
                    <>
                      <Text
                        style={[styles.statValue, compact && styles.statValueCompact]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.5}
                      >
                        {stat.value}
                      </Text>
                      <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                        {stat.label}
                      </Text>
                    </>
                  );
                  const label = `${stat.label} ${stat.value}`;
                  const tileStyle = [styles.stat, compact && styles.statCompact];
                  return open ? (
                    <Animated.View
                      key={stat.label}
                      accessible
                      accessibilityLabel={label}
                      entering={reduceMotion ? undefined : FadeInUp.delay(60 + (rowIndex * 2 + colIndex) * 45).springify()}
                      style={tileStyle}
                    >
                      {tile}
                    </Animated.View>
                  ) : (
                    <View key={stat.label} accessible accessibilityLabel={label} style={tileStyle}>
                      {tile}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

          <View
            testID="peek-clip-row"
            accessible
            accessibilityLabel={tag ? `On this clip: ${tag}. ${spokenKind}` : `On this clip: ${spokenKind}`}
            style={[styles.clipRow, compact && styles.clipRowCompact]}
          >
            <View style={[styles.clipIcon, compact && styles.clipIconCompact, { backgroundColor: tier.face }]}>
              <Ionicons name={photo ? 'images' : 'videocam'} size={compact ? 16 : 18} color={tier.ink} />
            </View>
            <View style={styles.clipText}>
              <Text style={styles.sectionLabel}>On this clip</Text>
              <Text style={styles.clipTag} numberOfLines={2}>
                {tag ? `“${tag}”` : kind}
              </Text>
              {tag ? <Text style={styles.clipKind}>{kind}</Text> : null}
            </View>
          </View>
        </View>
        {largeText ? footer : null}
      </ScrollView>

      {largeText ? null : footer}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: FOCAL.backgroundBase,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  // Pinned header row. The orb stays inside it so the wash never ends in a hard edge against the scrolling hero.
  topBar: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 8,
    paddingTop: 6,
  },
  orb: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    top: -40,
    right: -26,
    opacity: 0.7,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 16,
  },
  heroCompact: {
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  body: {
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  bodyCompact: {
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
  },
  tierPill: {
    flexShrink: 1,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  tierLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  // 44-point touch target (MENU_METRICS.touchTarget) around a smaller visible disc.
  closeTarget: {
    width: MENU_METRICS.touchTarget,
    height: MENU_METRICS.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(15,20,22,0.12)',
  },
  avatarWrap: {
    width: 84,
    height: 84,
  },
  avatarWrapCompact: {
    width: 62,
    height: 62,
  },
  // Compact: the Verified Varsity check sits on the avatar ring (like a verified mark) instead of taking a name row.
  ringBadge: {
    position: 'absolute',
    right: -8,
    bottom: -4,
  },
  ring: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
    backgroundColor: colors.surface,
  },
  ringCompact: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarCompact: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
  initialsCompact: {
    fontSize: 19,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    color: FOCAL.ink,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  nameCompact: {
    fontSize: 17,
    lineHeight: 21,
  },
  // Plain ink, not the tier ink: Island Cyan's ink is near the 4.5:1 line on its own wash (and lower over the corner glow).
  handle: {
    color: FOCAL.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  clipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clipRowCompact: {
    gap: 8,
    padding: 8,
  },
  clipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipIconCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  clipText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  clipTag: {
    color: FOCAL.ink,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  clipKind: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  posterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: FOCAL.mistSlate,
  },
  posterAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FOCAL.mistViolet,
  },
  posterInitials: {
    color: FOCAL.violetInk,
    fontSize: 10,
    fontWeight: '900',
  },
  posterLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  posterName: {
    color: FOCAL.ink,
    fontWeight: '900',
  },
  stats: {
    gap: 6,
  },
  statRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCompact: {
    paddingVertical: 4,
  },
  statValue: {
    color: FOCAL.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  statValueCompact: {
    fontSize: 16,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  // Pinned footer: Donate / Join Crew and Open full profile. Opaque, with a hairline so scrolled content reads as
  // passing behind it.
  footer: {
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: FOCAL.backgroundBase,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerCompact: {
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  actionsCompact: {
    gap: 6,
  },
  // `AnimatedPressable.style` sizes the touch target (the row child); `contentStyle` is the visible, scaled box
  // inside it. Halving the row therefore goes on `style`; the content just grows to fill the stretched target.
  actionHalf: {
    flex: 1,
    minWidth: 0,
  },
  actionFill: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: MENU_METRICS.touchTarget + 4,
    borderRadius: MENU_METRICS.controlRadius,
    paddingHorizontal: 8,
  },
  actionFillCompact: {
    minHeight: MENU_METRICS.touchTarget,
    paddingHorizontal: 6,
    gap: 4,
  },
  crewBtn: {
    borderWidth: 1.5,
    borderColor: FOCAL.jadeInk,
    backgroundColor: colors.surface,
  },
  crewBtnOn: {
    backgroundColor: FOCAL.mistJade,
  },
  crewLabel: {
    flexShrink: 1,
    textAlign: 'center',
    color: FOCAL.jadeInk,
    fontSize: 14,
    fontWeight: '800',
  },
  tipBtn: {
    backgroundColor: FOCAL.neonJade,
  },
  tipBtnPending: {
    backgroundColor: FOCAL.mistGold,
    borderWidth: 1.5,
    borderColor: FOCAL.goldInk,
  },
  tipLabel: {
    flexShrink: 1,
    textAlign: 'center',
    color: FOCAL.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  tipLabelPending: {
    color: FOCAL.goldInk,
  },
  // Secondary link keeps a 1.5 pt jade-ink outline so it reads as a button, not plain text.
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: MENU_METRICS.touchTarget,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1.5,
    borderColor: FOCAL.jadeInk,
    paddingHorizontal: 12,
  },
  openBtnPrimary: {
    backgroundColor: FOCAL.neonJade,
    borderColor: FOCAL.neonJade,
  },
  openLabel: {
    flexShrink: 1,
    textAlign: 'center',
    color: FOCAL.ink,
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
