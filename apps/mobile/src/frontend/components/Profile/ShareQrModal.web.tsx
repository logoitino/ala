import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { radii } from '@/constants/theme';
import { useOptionalCelebration } from '@/context/CelebrationContext';
import {
  SHARE_COPY_LABEL,
  SHARE_NATIVE_LABEL,
  SHARE_QR_TITLE,
  shareQrSubtitle,
} from '@/data/share';
import { copyGiftLink, giftQrTarget, shareGiftLink } from '@/lib/share';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';

type ShareQrModalProps = {
  visible: boolean;
  onClose: () => void;
  athleteName: string;
  username?: string | null;
};

/**
 * @purpose Web Share & Fund sheet — gift URL without `react-native-qrcode-svg` (that package crashes Expo web SSR).
 * @param visible Opens from Athlete Profile or a Locker Room Wishlist card.
 * @sideEffects `expo-clipboard`; `Share.share`; telemetry `share_qr`.
 */
export function ShareQrModal({ visible, onClose, athleteName, username }: ShareQrModalProps) {
  const celebration = useOptionalCelebration();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'copy' | 'share' | null>(null);
  const target = giftQrTarget(athleteName, username);

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setBusy(null);
      telemetry.trackFeature('share_qr', 'profile');
    }
  }, [visible]);

  if (!open && !visible) return null;

  const dismiss = () => {
    setOpen(false);
    setBusy(null);
    onClose();
  };

  const run = async (kind: 'copy' | 'share', work: () => Promise<void>, ok: string) => {
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
    <Modal transparent animationType="fade" visible={visible} onRequestClose={dismiss}>
      <StatusBar style="light" />
      <View style={styles.root}>
        <Pressable haptic="none" style={styles.backdrop} onPress={dismiss}>
          <BlurView intensity={48} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
        </Pressable>
        <View style={styles.sheet}>
          <Text style={styles.kicker}>Family flyer</Text>
          <Text style={styles.title}>{SHARE_QR_TITLE}</Text>
          <Text style={styles.subtitle}>{shareQrSubtitle(target.athleteName)}</Text>
          <Text style={styles.url}>{target.url}</Text>
          <Text style={styles.hint}>Scan the QR from the iOS or Android app. On web, copy or share this link.</Text>

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
                'Web tipping link copied.',
              )
            }
            contentStyle={[styles.action, styles.actionPrimary, busy && styles.actionOff]}
          >
            {busy === 'copy' ? (
              <ActivityIndicator color={FOCAL.ink} />
            ) : (
              <Text style={styles.actionPrimaryLabel}>{SHARE_COPY_LABEL}</Text>
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
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 12,
    borderTopWidth: 1,
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
  url: {
    alignSelf: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: FOCAL.neonJade,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    color: 'rgba(243,250,246,0.55)',
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
