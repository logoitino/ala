import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, View } from 'react-native';
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
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { radii } from '@/constants/theme';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import {
  SHARE_COPY_LABEL,
  SHARE_NATIVE_LABEL,
  SHARE_QR_TITLE,
  SHARE_SAVE_LABEL,
  shareQrSubtitle,
} from '@/data/share';
import {
  copyGiftLink,
  giftQrTarget,
  saveGiftQrToCameraRoll,
  shareGiftLink,
} from '@/lib/share';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL, SPRING_CARD } from '@/theme/motion';

const SHEET_TRAVEL = 420;

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
export function ShareQrModal({ visible, onClose, athleteName, username, playerId }: ShareQrModalProps) {
  const frame = useSheetFrame();
  const celebration = useOptionalCelebration();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'save' | 'copy' | 'share' | null>(null);
  const svgRef = useRef<QrSvgRef | null>(null);
  const pulse = useSharedValue(0.45);
  const translateY = useSharedValue(SHEET_TRAVEL);
  const backdropOpacity = useSharedValue(0);
  const target = giftQrTarget(athleteName, username, playerId);

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setBusy(null);
      telemetry.trackFeature('share_qr', 'profile');
      translateY.value = withSpring(0, SPRING_CARD);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [backdropOpacity, translateY, visible]);

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
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!open && !visible) return null;

  const dismiss = () => {
    translateY.value = withTiming(SHEET_TRAVEL, { duration: 180 });
    backdropOpacity.value = withTiming(0, { duration: 160 });
    setBusy(null);
    setTimeout(() => {
      setOpen(false);
      onClose();
    }, 180);
  };

  const run = async (kind: 'save' | 'copy' | 'share', work: () => Promise<void>, ok: string) => {
    setBusy(kind);
    try {
        await work();
      if (kind !== 'share') celebration?.showToast(ok);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not complete that share action.';
      if (!/cancel/i.test(message)) celebration?.showToast(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={dismiss}
      onDismiss={() => setOpen(false)}
    >
      <StatusBar style="light" />
      <View style={styles.root}>
        <Pressable haptic="none" style={styles.backdrop} onPress={dismiss}>
          <Reanimated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <BlurView intensity={48} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          </Reanimated.View>
        </Pressable>
        <View pointerEvents="box-none" style={frame.dock}>
        <Reanimated.View style={[styles.sheet, frame.card, sheetStyle]}>
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
          <Text style={styles.url} numberOfLines={2}>
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
                'Donation link copied.',
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: FOCAL.neonJade,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
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
    fontSize: 12,
    fontWeight: '700',
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
  actionPrimary: {
    backgroundColor: FOCAL.neonJade,
  },
  actionGhost: {
    borderWidth: 1.5,
    borderColor: FOCAL.neonJade,
    backgroundColor: 'rgba(0,230,118,0.08)',
  },
  actionOff: {
    opacity: 0.5,
  },
  actionPrimaryLabel: {
    color: FOCAL.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  actionGhostLabel: {
    color: FOCAL.neonJade,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  close: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(243,250,246,0.62)',
  },
});
