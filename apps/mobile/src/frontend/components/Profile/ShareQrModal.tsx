/** QR flights and close completions belong to one visible account/URL frame; issued OS operations retain their original target. UX-13 readable shared type preserves every action and required notice. Existing athlete support screen/helper: visible money copy names personal gifts; identifiers and financial behavior stay unchanged. */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import QRCode from 'react-native-qrcode-svg';
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import {
  SHARE_COPY_LABEL,
  SHARE_NATIVE_LABEL,
  SHARE_QR_TITLE,
  SHARE_SAVE_LABEL,
  shareQrSubtitle,
} from '@/data/share';
import { useFanSheetMotion } from '@/hooks/useFanSheetMotion';
import {
  copyGiftLink,
  giftQrTarget,
  saveGiftQrToCameraRoll,
  shareGiftLink,
} from '@/lib/share';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

type ShareQrModalProps = {
  visible: boolean;
  onClose: () => void;
  athleteName: string;
  username?: string | null;
  /** `players.id`; the link uses it when the athlete has no username, so the scan still finds them. */
  playerId?: string | null;
};

type QrSvgRef = {
  toDataURL?: (callback: (data: string) => void) => void;
};

/**
 * @purpose Obsidian Share & Fund sheet — flyer QR to `https://tapuai.app/gift/{handle}` so family can support without the app.
 * @param visible Opens from Athlete Profile or a Locker Room Wishlist card.
 * @param athleteName Name interpolated into the scan explainer.
 * @param username Handle encoded in the gift URL (falls back to `playerId`, then a name slug).
 * @param playerId Athlete id used when there is no username.
 * @returns Centered neon-jade QR on Obsidian with save / copy / native share actions.
 * @sideEffects `react-native-qrcode-svg`; `expo-media-library` Camera Roll save; `expo-clipboard`; `Share.share`; haptics; telemetry `share_qr`.
 */
export function ShareQrModal(props: ShareQrModalProps) {
  const { user, isSessionCurrent } = useAuth();
  const target = giftQrTarget(props.athleteName, props.username, props.playerId);
  const frame = useRef({ owner: user?.id, guard: isSessionCurrent, visible: props.visible, url: target.url, generation: 0 });
  if (frame.current.owner !== user?.id || frame.current.guard !== isSessionCurrent || frame.current.visible !== props.visible || frame.current.url !== target.url)
    frame.current = { owner: user?.id, guard: isSessionCurrent, visible: props.visible, url: target.url, generation: frame.current.generation + 1 };
  // Remount the sheet and its flight together: a previous target cannot own the new sheet's completion.
  if (isSessionCurrent && !isSessionCurrent()) return null;
  return <OwnedShareQrModal key={frame.current.generation} {...props} />;
}
function OwnedShareQrModal({ visible, onClose, athleteName, username, playerId }: ShareQrModalProps) {
  const { isSessionCurrent } = useAuth();
  const mounted = useRef(true), active = useRef(visible), flight = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && active.current && visible && (isSessionCurrent?.() ?? true);
  const frame = useSheetFrame();
  const { height: windowHeight } = useWindowDimensions();
  const celebration = useOptionalCelebration();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'save' | 'copy' | 'share' | null>(null);
  const svgRef = useRef<QrSvgRef | null>(null);
  const pulse = useSharedValue(0.45);
  const { sheetStyle, backdropStyle, playOpen, playClose } = useFanSheetMotion();
  const target = giftQrTarget(athleteName, username, playerId);

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setBusy(null);
      telemetry.trackFeature('share_qr', 'profile');
      playOpen();
    }
  }, [playOpen, visible]);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(pulse);
      pulse.value = 0.45;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, visible]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.28 + pulse.value * 0.45,
  }));

  if (!open && !visible) return null;

  const dismiss = () => {
    if (!current()) return;
    active.current = false;
    setBusy(null);
    playClose(() => {
      if (!mounted.current || !(isSessionCurrent?.() ?? true)) return;
      setOpen(false);
      onClose();
    });
  };

  const run = async (kind: 'save' | 'copy' | 'share', work: () => Promise<void>, ok: string) => {
    if (!current() || flight.current) return;
    flight.current = true;
    setBusy(kind);
    try {
        await work();
      if (current() && kind !== 'share') celebration?.showToast(ok);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not complete that share action.';
      if (current() && !/cancel/i.test(message)) celebration?.showToast(message);
    } finally {
      flight.current = false;
      if (current()) setBusy(null);
    }
  };

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={dismiss}
      onDismiss={() => { if (mounted.current) setOpen(false); }}
    >
      <StatusBar style="light" />
      <View style={styles.root}>
        <Pressable haptic="none" style={styles.backdrop} onPress={dismiss}>
          <Reanimated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <BlurView intensity={48} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          </Reanimated.View>
        </Pressable>
        <View pointerEvents="box-none" style={frame.dock}>
        <Reanimated.View style={[styles.sheet, frame.card, { maxHeight: windowHeight * 0.85 }, sheetStyle]}>
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.kicker}>Family flyer</Text>
          <Text style={styles.title}>{SHARE_QR_TITLE}</Text>
          <Text style={styles.subtitle}>{shareQrSubtitle(target.athleteName)}</Text>

          <View style={styles.qrStage}>
            <Reanimated.View pointerEvents="none" style={[styles.qrGlow, glowStyle]} />
            <View style={styles.qrFrame}>
              <View style={styles.qrPad}>
                <QRCode
                  value={target.url}
                  size={196}
                  color={FOCAL.videoBase}
                  backgroundColor="#FFFFFF"
                  quietZone={12}
                  ecl="M"
                  getRef={(node) => {
                    svgRef.current = node;
                  }}
                />
              </View>
            </View>
          </View>
          <Text style={styles.url}>
            {target.url}
          </Text>

          <AnimatedButton
            accessibilityLabel={SHARE_SAVE_LABEL}
            disabled={Boolean(busy)}
            haptic="medium"
            onPress={() =>
              void run(
                'save',
                async () => {
                  telemetry.trackFeature('share_qr.save', 'profile');
                  await saveGiftQrToCameraRoll(svgRef.current, target.handle);
                },
                Platform.OS === 'web' ? 'QR flyer downloaded.' : 'QR flyer saved to Camera Roll.',
              )
            }
            contentStyle={[styles.action, styles.actionPrimary, busy && styles.actionOff]}
          >
            {busy === 'save' ? (
              <ActivityIndicator color={FOCAL.ink} />
            ) : (
              <Text style={styles.actionPrimaryLabel}>{SHARE_SAVE_LABEL}</Text>
            )}
          </AnimatedButton>

          <AnimatedButton
            accessibilityLabel={SHARE_COPY_LABEL}
            disabled={Boolean(busy)}
            haptic="selection"
            onPress={() =>
              void run(
                'copy',
                async () => {
                  telemetry.trackFeature('share_qr.copy', 'profile');
                  await copyGiftLink(target.url);
                },
                'Gift link copied.',
              )
            }
            contentStyle={[styles.action, styles.actionGhost, busy && styles.actionOff]}
          >
            {busy === 'copy' ? (
              <ActivityIndicator color={FOCAL.neonJade} />
            ) : (
              <Text style={styles.actionGhostLabel}>{SHARE_COPY_LABEL}</Text>
            )}
          </AnimatedButton>

          <AnimatedButton
            accessibilityLabel={SHARE_NATIVE_LABEL}
            disabled={Boolean(busy)}
            haptic="medium"
            onPress={() =>
              void run(
                'share',
                async () => {
                  telemetry.trackFeature('share_qr.native', 'profile');
                  await shareGiftLink(target);
                },
                'Share sheet opened.',
              )
            }
            contentStyle={[styles.action, styles.actionGhost, busy && styles.actionOff]}
          >
            {busy === 'share' ? (
              <ActivityIndicator color={FOCAL.neonJade} />
            ) : (
              <Text style={styles.actionGhostLabel}>{SHARE_NATIVE_LABEL}</Text>
            )}
          </AnimatedButton>

          </ScrollView>
          <Pressable accessibilityRole="button" onPress={dismiss} style={styles.close}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </Reanimated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bodyScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0, alignSelf: 'stretch' },
  bodyContent: { gap: 10, paddingBottom: 4 },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,20,22,0.55)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    backgroundColor: FOCAL.videoBase,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.35)',
  },
  kicker: {
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: FOCAL.neonJade,
  },
  title: {
    ...TYPE.title,
    ...figtree('800'),
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    ...TYPE.body,
    ...figtree('600'),

    color: 'rgba(243,250,246,0.78)',
  },
  qrStage: {
    alignSelf: 'center',
    marginVertical: 8,
    padding: 14,
  },
  qrGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 28,
    backgroundColor: FOCAL.neonJade,
  },
  qrFrame: {
    borderWidth: 3,
    borderColor: FOCAL.neonJade,
    borderRadius: 22,
    backgroundColor: FOCAL.videoBase,
    padding: 12,
    ...Platform.select({
      ios: {
        shadowColor: FOCAL.neonJade,
        shadowOpacity: 0.95,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  qrPad: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  url: {
    alignSelf: 'center',
    ...TYPE.caption,
    ...figtree('700'),
    color: FOCAL.neonJade,
    textAlign: 'center',
  },
  action: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionPrimary: { minHeight: 44,
    backgroundColor: FOCAL.neonJade,
  },
  actionGhost: { minHeight: 44,
    borderWidth: 1.5,
    borderColor: FOCAL.neonJade,
    backgroundColor: 'rgba(0,230,118,0.08)',
  },
  actionOff: { minHeight: 44,
    opacity: 0.5,
  },
  actionPrimaryLabel: {
    color: FOCAL.ink,
    ...TYPE.body,
    ...figtree('800'),
    textAlign: 'center',
  },
  actionGhostLabel: {
    color: FOCAL.neonJade,
    ...TYPE.body,
    ...figtree('800'),
    textAlign: 'center',
  },
  close: { minHeight: 44,
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeLabel: {
    ...TYPE.body,
    ...figtree('700'),
    color: 'rgba(243,250,246,0.62)',
  },
});
