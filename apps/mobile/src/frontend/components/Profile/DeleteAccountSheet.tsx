/**
 * Profile → Delete account (P1-01 request surface). Starts an account-deletion request without claiming automated
 * erasure: counsel still owns what gift/ledger rows must be kept. Records the request in admin Feedback, then signs
 * the person out so the device leaves the account. Destructive auto-wipe stays WORK_QUEUE P1-01.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { KitButton } from '@/components/UI/Kit';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { colors, KIT, MENU_METRICS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSheetFrame, SHEET_BLUR_INTENSITY } from '@/hooks/useSheetFrame';
import { submitAppFeedback } from '@/lib/feedback';
import { TYPE } from '@/theme/fonts';
import { FOCAL, SPRING_SHEET } from '@/theme/motion';

const SHEET_TRAVEL = 420;
const REQUEST_PREFIX = '[account-deletion-request]';

/**
 * @purpose Compact confirmation sheet to request account deletion and leave the session.
 * @param visible Whether the sheet is open.
 * @param onClose Dismiss without requesting.
 * @sideEffects `submit_app_feedback` (kind other, surface profile); `AuthContext.signOut`.
 */
export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const frame = useSheetFrame();
  const { signOut, profile, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);
  const wasVisible = useRef(false);
  const translateY = useSharedValue(SHEET_TRAVEL);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      wasVisible.current = true;
      setError(null);
      setDone(false);
      setBusy(false);
      setOpen(true);
      translateY.value = withSpring(0, SPRING_SHEET);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else if (wasVisible.current) {
      wasVisible.current = false;
      translateY.value = withTiming(SHEET_TRAVEL, { duration: 180 });
      backdropOpacity.value = withTiming(0, { duration: 160 });
      const timer = setTimeout(() => setOpen(false), 180);
      return () => clearTimeout(timer);
    }
  }, [visible, backdropOpacity, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!open && !visible) return null;

  const dismiss = () => {
    if (busy) return;
    onClose();
  };

  const onRequest = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const who = profile?.username || profile?.full_name?.trim() || user?.id || 'signed-in account';
      await submitAppFeedback(
        `${REQUEST_PREFIX} Please delete my Tapua'i account (${who}). I understand gift and bookkeeping records may be kept where the law requires.`,
        'other',
        'profile',
      );
      setDone(true);
      await signOut();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send the deletion request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={dismiss}>
      <View style={styles.root}>
        <Pressable haptic="none" style={styles.backdrop} onPress={dismiss}>
          <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <BlurView intensity={SHEET_BLUR_INTENSITY} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          </Animated.View>
        </Pressable>
        <View pointerEvents="box-none" style={frame.dock}>
          <Animated.View style={[styles.sheet, frame.card, sheetStyle]}>
            <MenuBackdrop accent="ember" />
            <SheetHandle onDismiss={dismiss} />
            <View style={styles.iconTile}>
              <Ionicons name="trash-outline" size={22} color={FOCAL.ember} />
            </View>
            <Text style={styles.kicker}>Account</Text>
            <Text style={styles.title}>Delete account</Text>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollInner}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.body}>
                This sends a deletion request to Tapua&apos;i and signs you out on this device. Gift history and other
                records other people or the books rely on may be kept where required — staff finishes the wipe after
                review.
              </Text>
              <Text style={styles.bodyMuted}>
                You can create a new account later with a different email. This does not take money from anyone.
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {done ? <Text style={styles.notice}>Request sent. Signing you out…</Text> : null}
            </ScrollView>
            <KitButton
              accessibilityLabel="Request account deletion and sign out"
              variant="destructive"
              size="md"
              block
              disabled={busy}
              haptic="medium"
              onPress={() => void onRequest()}
              label={busy ? 'Sending…' : 'Delete my account'}
            />
            {busy ? <ActivityIndicator color={FOCAL.ember} style={styles.spinner} /> : null}
            <Pressable accessibilityRole="button" disabled={busy} onPress={dismiss} style={styles.cancel}>
              <Text style={styles.cancelLabel}>Keep my account</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    backgroundColor: colors.surface,
    gap: 10,
    maxHeight: '88%',
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(232, 93, 58, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: FOCAL.ember,
  },
  title: { ...TYPE.title, color: colors.text, letterSpacing: -0.3 },
  scroll: { maxHeight: 180 },
  scrollInner: { gap: 8, paddingBottom: 4 },
  body: { ...TYPE.body, color: colors.text, fontWeight: '600' },
  bodyMuted: { ...TYPE.caption, color: colors.textMuted, lineHeight: 17 },
  error: { ...TYPE.caption, color: colors.danger, fontWeight: '700' },
  notice: { ...TYPE.caption, color: FOCAL.jadeInk, fontWeight: '700' },
  spinner: { marginTop: -4 },
  cancel: {
    minHeight: MENU_METRICS.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: KIT.controlRadius,
  },
  cancelLabel: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
});
