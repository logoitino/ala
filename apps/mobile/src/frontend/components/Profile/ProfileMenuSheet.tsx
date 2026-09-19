import { type ReactNode, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { FOCAL, SPRING_CARD } from '@/theme/motion';

export type ProfileMenuItem = {
  id: string;
  label: string;
  hint?: string;
  danger?: boolean;
  onPress: () => void;
};

type ProfileMenuSheetProps = {
  visible: boolean;
  onClose: () => void;
  items: ProfileMenuItem[];
  footer?: ReactNode;
};

/**
 * @purpose Hamburger Account Settings sheet — keeps Profile scroll clean (Sign in/out, Capability, Receipts…).
 * @param items Menu rows; parent closes the sheet before opening nested modals.
 * @returns Blur bottom sheet matching RoleSwitcher / SoftWall chrome.
 */
const SHEET_TRAVEL = 420;

export function ProfileMenuSheet({ visible, onClose, items, footer }: ProfileMenuSheetProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const translateY = useSharedValue(SHEET_TRAVEL);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setOpen(true);
      translateY.value = withSpring(0, SPRING_CARD);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [backdropOpacity, translateY, visible]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!open && !visible) return null;

  const dismiss = () => {
    translateY.value = withTiming(SHEET_TRAVEL, { duration: 180 });
    backdropOpacity.value = withTiming(0, { duration: 160 });
    setTimeout(() => {
      setOpen(false);
      onClose();
    }, 180);
  };

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={dismiss}
      onDismiss={() => setOpen(false)}
    >
      <View style={styles.root}>
        <Pressable haptic="none" style={styles.backdrop} onPress={dismiss}>
          <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <BlurView intensity={40} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          </Animated.View>
        </Pressable>
        <Animated.View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }, sheetStyle]}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>Account</Text>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.list}>
            {items.map((item) => (
              <AnimatedButton
                key={item.id}
                accessibilityLabel={item.label}
                haptic="selection"
                onPress={() => {
                  dismiss();
                  // Let the sheet close before nested modals open.
                  requestAnimationFrame(() => item.onPress());
                }}
                contentStyle={styles.row}
              >
                <View style={styles.copy}>
                  <Text style={[styles.label, item.danger && styles.danger]}>{item.label}</Text>
                  {item.hint ? <Text style={styles.hint}>{item.hint}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </AnimatedButton>
            ))}
          </View>
          {footer}
          <Pressable accessibilityRole="button" onPress={dismiss} style={styles.close}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: FOCAL.goldInk,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  list: {
    gap: 8,
  },
  row: {
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  danger: {
    color: FOCAL.ember,
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  close: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
