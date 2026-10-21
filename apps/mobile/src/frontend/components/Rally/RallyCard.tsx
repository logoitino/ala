import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { CreateRallySheet } from '@/components/Rally/CreateRallySheet';
import { RallyFillMoment } from '@/components/Rally/RallyFillMoment';
import { ShareQrModal } from '@/components/Profile/ShareQrModal';
import { ThanksPicker } from '@/components/Thanks/ThanksPicker';
import { MaloTipModal } from '@/components/TipSheetModal';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { maloAthleteCta } from '@/data/malo';
import type { Player } from '@/data/players';
import { useRally } from '@/hooks/useRally';
import { thanksText, type ThanksKey } from '@/lib/donationThanks';
import { giftQrTarget } from '@/lib/share';
import type { TipEntry } from '@/lib/finance';
import {
  approveRally,
  closeRally,
  costKindLabel,
  rallyProgress,
  rallyStatusLine,
  thankRally,
  type Rally,
} from '@/lib/rallies';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL, SPRING_CARD } from '@/theme/motion';

type ClipChoice = { id: string; title: string };

type RallyCardProps = {
  player: Player;
  athleteName: string;
  username?: string | null;
  /** Athlete's own profile or their guardian: start, close and thank. */
  manage?: boolean;
  /** Guardian (Parent HQ): may approve a Rally the athlete started. */
  guardian?: boolean;
  tipEntry?: TipEntry;
  /** The athlete's own confirmed clips, for the "what it paid for" thank-you. */
  clips?: ClipChoice[];
  /** Opens a clip (the thank-you clip) for fans. */
  onOpenClip?: (reelId: string) => void;
};

/**
 * @purpose Rally goal on the athlete profile (ROADMAP M2): the named cost, the story, a progress bar,
 *   Donate and Share for fans; Start / Approve / Close / Say thanks for the family. A full-screen
 *   moment when a donation fills it. Hides itself for fans when there is no Rally (or before the SQL is applied).
 * @sideEffects `useRally`; Rally RPCs; donate sheet with `rally_id`.
 */
export function RallyCard({
  player,
  athleteName,
  username,
  manage = false,
  guardian = false,
  tipEntry,
  clips = [],
  onOpenClip,
}: RallyCardProps) {
  const { live } = useAppRuntime();
  const { requireAuth } = useSoftWall();
  const celebration = useOptionalCelebration();
  const { rally: active, mine, available, loading, refresh } = useRally(player.id, manage);
  const [donateOpen, setDonateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [thanking, setThanking] = useState(false);
  const [thanksClip, setThanksClip] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fillMoment, setFillMoment] = useState(false);
  const lastStatus = useRef<string | null>(null);

  // The family sees their newest Rally (pending included); fans see the open / recently filled one.
  const rally: Rally | null = manage ? (mine.find((row) => row.status !== 'closed') ?? active) : active;

  const fill = useSharedValue(0);
  const fraction = rally ? rallyProgress(rally).fraction : 0;
  useEffect(() => {
    fill.value = withSpring(fraction, SPRING_CARD);
  }, [fill, fraction]);
  const barStyle = useAnimatedStyle(() => ({ width: `${Math.round(fill.value * 100)}%` }));

  useEffect(() => {
    if (!rally) return;
    if (lastStatus.current === 'live' && rally.status === 'filled') {
      setFillMoment(true);
      celebration?.showToast(`Goal reached! ${athleteName}'s community filled "${rally.title}" 🎉`);
    }
    lastStatus.current = rally.status;
  }, [athleteName, celebration, rally]);

  const run = async (action: () => Promise<{ ok: boolean; message?: string }>, done?: string) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      celebration?.showToast(result.message ?? 'Something went wrong.');
      return;
    }
    if (done) celebration?.showToast(done);
    await refresh();
  };

  if (!rally) {
    // Fans never see an empty card; the family sees the invite only once Rallies are live for them.
    if (!manage || loading || !available) return null;
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>Rally</Text>
        <Text style={styles.title}>Raise money for a real sports cost</Text>
        <Text style={styles.story}>
          Season fees, new gear, tournament travel, camps or college prep. Name it, set a goal, and share it with
          the people who watch {athleteName}&apos;s highlights.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            telemetry.trackFeature('rally_create', 'profile');
            setCreateOpen(true);
          }}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>Start a Rally</Text>
        </Pressable>
        <CreateRallySheet
          visible={createOpen}
          playerId={player.id}
          athleteName={athleteName}
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            setCreateOpen(false);
            celebration?.showToast(
              created.status === 'live' ? 'Your Rally is live. Share it!' : 'Sent to your parent or guardian to approve.',
            );
            void refresh();
          }}
        />
      </View>
    );
  }

  const progress = rallyProgress(rally);
  const canDonate = rally.status === 'live' && live.buttons.malo;
  const thanks = thanksText(rally.thanksKey);

  return (
    <View style={styles.card} accessibilityLabel={`Rally: ${rally.title}, ${progress.amountLine}`}>
      <View style={styles.headRow}>
        <Text style={styles.kicker}>Rally · {costKindLabel(rally.costKind)}</Text>
        <Text style={[styles.status, rally.status === 'filled' && styles.statusFilled]}>{rallyStatusLine(rally)}</Text>
      </View>
      <Text style={styles.title}>{rally.title}</Text>
      {rally.story ? <Text style={styles.story}>{rally.story}</Text> : null}

      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress.fraction * 100) }}
      >
        <Animated.View style={[styles.bar, barStyle]} />
      </View>
      <View style={styles.numbers}>
        <Text style={styles.amount}>{progress.amountLine}</Text>
        <Text style={styles.donors}>{progress.donorsLine}</Text>
      </View>

      {thanks ? (
        <View style={styles.thanks}>
          <Text style={styles.thanksText}>
            {athleteName}: {thanks}
          </Text>
          {rally.thanksReelId && onOpenClip ? (
            <Pressable accessibilityRole="button" onPress={() => onOpenClip(rally.thanksReelId as string)}>
              <Text style={styles.link}>▶ Watch what it paid for</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        {canDonate && !manage ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              requireAuth({
                kind: 'malo',
                athleteName,
                athleteId: player.id,
                resume: () => {
                  telemetry.trackFeature('rally_donate', 'profile');
                  setDonateOpen(true);
                },
              })
            }
            style={[styles.primary, styles.flex]}
          >
            <Text style={styles.primaryText}>{maloAthleteCta(athleteName)}</Text>
          </Pressable>
        ) : null}
        {rally.status !== 'pending_guardian' ? (
          <Pressable accessibilityRole="button" onPress={() => setShareOpen(true)} style={[styles.secondary, styles.flex]}>
            <Text style={styles.secondaryText}>Share the Rally</Text>
          </Pressable>
        ) : null}
      </View>

      {manage ? (
        <View style={styles.manage}>
          {rally.status === 'pending_guardian' && guardian ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void run(() => approveRally(rally.id), 'Approved. The Rally is live.')}
              style={[styles.primary, busy && styles.dim]}
            >
              <Text style={styles.primaryText}>Approve this Rally</Text>
            </Pressable>
          ) : null}
          {rally.status === 'filled' && !rally.thankedAt ? (
            thanking ? (
              <View style={styles.thanksBlock}>
                <Text style={styles.manageLabel}>Thank everyone who donated</Text>
                {clips.length > 0 ? (
                  <View style={styles.clipRow}>
                    <Text style={styles.manageHint}>Add a clip of what it paid for (optional):</Text>
                    {clips.slice(0, 6).map((clip) => (
                      <Pressable
                        key={clip.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: thanksClip === clip.id }}
                        onPress={() => setThanksClip((current) => (current === clip.id ? null : clip.id))}
                        style={[styles.clip, thanksClip === clip.id && styles.clipOn]}
                      >
                        <Text style={styles.clipText} numberOfLines={1}>
                          {clip.title || 'Highlight'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <ThanksPicker
                  busy={busy}
                  onCancel={() => setThanking(false)}
                  onPick={(key: ThanksKey) => {
                    setThanking(false);
                    void run(() => thankRally(rally.id, key, thanksClip), 'Thank-you posted on the Rally.');
                  }}
                />
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setThanking(true)} style={styles.primary}>
                <Text style={styles.primaryText}>Say thanks to everyone 🙏</Text>
              </Pressable>
            )
          ) : null}
          {rally.status === 'live' || rally.status === 'pending_guardian' ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void run(() => closeRally(rally.id), 'Rally closed.')}
              style={styles.textButton}
            >
              <Text style={styles.textButtonLabel}>Close this Rally</Text>
            </Pressable>
          ) : null}
          {rally.status === 'pending_guardian' && !guardian ? (
            <Text style={styles.manageHint}>Your parent or guardian approves it from Parent HQ before fans can donate.</Text>
          ) : null}
        </View>
      ) : null}

      <MaloTipModal
        player={donateOpen ? player : null}
        origin="rally"
        entry={tipEntry}
        rallyId={rally.id}
        sourceLabel={rally.title}
        onClose={() => setDonateOpen(false)}
        onTipped={() => void refresh()}
      />
      <ShareQrModal visible={shareOpen} athleteName={athleteName} username={username} playerId={player.id} onClose={() => setShareOpen(false)} />
      <RallyFillMoment
        visible={fillMoment}
        title={rally.title}
        athleteName={athleteName}
        giftUrl={giftQrTarget(athleteName, username, player.id).url}
        onWatch={
          rally.thanksReelId && onOpenClip
            ? () => {
                setFillMoment(false);
                onOpenClip(rally.thanksReelId as string);
              }
            : undefined
        }
        onClose={() => setFillMoment(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    marginTop: 12,
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: FOCAL.mistJade,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  kicker: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.deepGreen,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  statusFilled: {
    color: colors.deepGreen,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  story: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  track: {
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.deepGreen,
  },
  numbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amount: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  donors: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  thanks: {
    gap: 4,
    borderRadius: radii.md,
    backgroundColor: colors.accentSoft,
    padding: 10,
  },
  thanksText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  link: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.deepGreen,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  primary: {
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.deepGreen,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondary: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.deepGreen,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.deepGreen,
  },
  manage: {
    gap: 8,
  },
  manageLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  manageHint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  thanksBlock: {
    gap: 8,
  },
  clipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  clip: {
    maxWidth: 160,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clipOn: {
    borderColor: colors.deepGreen,
    backgroundColor: colors.accentSoft,
  },
  clipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  textButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  textButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  dim: {
    opacity: 0.5,
  },
});
