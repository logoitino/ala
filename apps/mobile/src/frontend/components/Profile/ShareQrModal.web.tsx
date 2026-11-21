/** UX-13 readable shared type preserves every action and required notice. Existing athlete support screen/helper: visible money copy names personal gifts; identifiers and financial behavior stay unchanged. */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View, ScrollView, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { radii } from '@/constants/theme';
import { useSheetFrame } from '@/hooks/useSheetFrame';
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
import { TYPE, figtree } from '@/theme/fonts';

type ShareQrModalProps = {
  visible: boolean;
  onClose: () => void;
  athleteName: string;
  username?: string | null;
  /** `players.id`; the link uses it when the athlete has no username, so the scan still finds them. */
  playerId?: string | null;
};

/**
 * @purpose Web Share & Fund sheet — gift URL without `react-native-qrcode-svg` (that package crashes Expo web SSR).
 * @param visible Opens from Athlete Profile or a Locker Room Wishlist card.
 * @sideEffects `expo-clipboard`; `Share.share`; telemetry `share_qr`.
 */
export function ShareQrModal({ visible, onClose, athleteName, username, playerId }: ShareQrModalProps) {
  const frame = useSheetFrame();
  const { height: windowHeight } = useWindowDimensions();
  const celebration = useOptionalCelebration();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'copy' | 'share' | null>(null);
  const target = giftQrTarget(athleteName, username, playerId);

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
        <View pointerEvents="box-none" style={frame.dock}>
        <View style={[styles.sheet, frame.card, { maxHeight: windowHeight * 0.85 }]}>
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
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
                'Gift link copied.',
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

          </ScrollView>
          <Pressable accessibilityRole="button" onPress={dismiss} style={styles.close}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
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
  url: {
    alignSelf: 'center',
    ...TYPE.body,
    ...figtree('700'),
    color: FOCAL.neonJade,
    textAlign: 'center',
  },
  hint: {
    ...TYPE.caption,
    ...figtree('600'),

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
