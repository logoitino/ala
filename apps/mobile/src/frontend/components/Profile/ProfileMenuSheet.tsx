/**
 * Account settings sheet opened from the Profile hamburger (sign in / out, role, receipts, legal). Nested sheets
 * open only after this one has fully dismissed, to avoid overlapping native modals (see STATE.md, 2026-09-29).
 * Rows are grouped into short categories and the list scrolls inside the sheet so long menus stay reachable.
 */

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, MENU_METRICS } from '@/constants/theme';
import { useSheetFrame, SHEET_BLUR_INTENSITY } from '@/hooks/useSheetFrame';
import { FOCAL, SPRING_SHEET } from '@/theme/motion';

export type ProfileMenuSectionId = 'account' | 'activity' | 'money' | 'support';

export type ProfileMenuItem = {
  id: string;
  label: string;
  hint?: string;
  danger?: boolean;
  /** Which heading this row sits under. Defaults to Account when omitted. */
  section?: ProfileMenuSectionId;
  onPress: () => void;
};

type ProfileMenuSheetProps = {
  visible: boolean;
  onClose: () => void;
  items: ProfileMenuItem[];
  footer?: ReactNode;
};

const SECTION_META: { id: ProfileMenuSectionId; title: string }[] = [
  { id: 'account', title: 'Account' },
  { id: 'activity', title: 'Play & shop' },
  { id: 'money', title: 'Money & staff' },
  { id: 'support', title: 'Support & legal' },
];

/**
 * @purpose Hamburger Account Settings sheet — categorized, scrollable rows so Profile stays clean.
 * @param items Menu rows with optional `section`. Nested modals open only after this sheet's native Modal has dismissed.
 * @returns Blur bottom sheet matching RoleSwitcher / SoftWall chrome.
 */
const SHEET_TRAVEL = 420;
/** iOS `onDismiss` is the real signal; this covers Android and a missed callback. */
const DISMISS_FALLBACK_MS = Platform.OS === 'ios' ? 650 : 280;

export function ProfileMenuSheet({ visible, onClose, items, footer }: ProfileMenuSheetProps) {
  const frame = useSheetFrame();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  const translateY = useSharedValue(SHEET_TRAVEL);
  const backdropOpacity = useSharedValue(0);
  const afterRef = useRef<(() => void) | undefined>(undefined);
  const closingToken = useRef<number | null>(null);
  const gen = useRef(0);

  const sections = useMemo(() => {
    return SECTION_META.map((meta) => ({
      ...meta,
      items: items.filter((item) => (item.section ?? 'account') === meta.id),
    })).filter((section) => section.items.length > 0);
  }, [items]);

  // Reserve chrome (handle, titles, close, safe area) so the row list is what scrolls.
  const listMaxHeight = Math.max(180, Math.min(windowHeight * 0.52, windowHeight - insets.top - insets.bottom - 210));

  useEffect(() => {
    if (!visible) return;
    gen.current += 1;
    closingToken.current = null;
    afterRef.current = undefined;
    setMounted(true);
    translateY.value = withSpring(0, SPRING_SHEET);
    backdropOpacity.value = withTiming(1, { duration: 200 });
  }, [backdropOpacity, translateY, visible]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const finishDismiss = (token: number) => {
    if (closingToken.current !== token) return;
    closingToken.current = null;
    const after = afterRef.current;
    afterRef.current = undefined;
    setMounted(false);
    after?.();
  };

  if (!mounted && !visible) return null;

  const dismiss = (after?: () => void) => {
    const token = ++gen.current;
    closingToken.current = token;
    afterRef.current = after;
    translateY.value = withTiming(SHEET_TRAVEL, { duration: 180 });
    backdropOpacity.value = withTiming(0, { duration: 160 });
    onClose();
    setTimeout(() => finishDismiss(token), DISMISS_FALLBACK_MS);
  };

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={() => dismiss()}
      onDismiss={() => {
        if (closingToken.current != null) finishDismiss(closingToken.current);
      }}
    >
      <View style={styles.root}>
        <Pressable haptic="none" style={styles.backdrop} onPress={() => dismiss()}>
          <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <BlurView intensity={SHEET_BLUR_INTENSITY} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          </Animated.View>
        </Pressable>
        <View pointerEvents="box-none" style={frame.dock}>
          <Animated.View style={[styles.sheet, frame.card, { maxHeight: windowHeight - insets.top - 16 }, sheetStyle]}>
            <MenuBackdrop accent="violet" />
            <SheetHandle onDismiss={() => dismiss()} />
            <Text style={styles.kicker}>Account</Text>
            <Text style={styles.title}>Settings</Text>
            <ScrollView
              style={{ maxHeight: listMaxHeight }}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              bounces
            >
              {sections.map((section) => (
                <View key={section.id} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {section.items.map((item) => (
                    <AnimatedButton
                      key={item.id}
                      accessibilityLabel={item.label}
                      haptic="selection"
                      onPress={() => {
                        // iOS only presents one Modal. Opening SoftWall (or Role / Legal) in the same
                        // turn this sheet unmounts drops the second presentation: React still has
                        // `visible` true, but the native sheet never stays on screen. `after` runs from
                        // `onDismiss` (or the platform fallback) once this Modal is actually gone.
                        dismiss(() => item.onPress());
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
              ))}
              {footer}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => dismiss()} style={styles.close}>
              <Text style={styles.closeLabel}>Close</Text>
            </Pressable>
          </Animated.View>
        </View>
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
    gap: 10,
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
    gap: 14,
    paddingBottom: 4,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.primary,
    marginTop: 2,
  },
  row: {
    minHeight: 54,
    borderRadius: MENU_METRICS.controlRadius,
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
