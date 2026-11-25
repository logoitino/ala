/** Fan menu uses shared Daylight chrome; the feature retains its identity, validation and data ownership.
 * Web explains app feedback versus clip reports without exposing publishing mechanics; native copy is retained.
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View , useWindowDimensions} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated from 'react-native-reanimated';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, MENU_METRICS } from '@/constants/theme';
import { useFanSheetMotion } from '@/hooks/useFanSheetMotion';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import {
  FEEDBACK_KINDS,
  FEEDBACK_SURFACES,
  submitAppFeedback,
  type AppFeedbackKind,
  type AppFeedbackSurface,
} from '@/lib/feedback';
import { supportSignals } from '@/services/SupportSignalManager';
import { supportFeatureForPath } from '@/services/supportRuntime';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

type SuggestionSheetProps = {
  visible: boolean;
  surface?: AppFeedbackSurface;
  onClose: () => void;
};

/**
 * @purpose Fan suggestion / bug / look note. Kind and place are short scroll menus — not pill grids.
 * @sideEffects `submit_app_feedback`.
 */
export function SuggestionSheet({ visible, surface = 'other', onClose }: SuggestionSheetProps) {
  const frame = useSheetFrame();
  const { height: windowHeight } = useWindowDimensions();
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<AppFeedbackKind>('suggestion');
  const [place, setPlace] = useState<AppFeedbackSurface>(surface);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const { sheetStyle, backdropStyle, playOpen, playClose } = useFanSheetMotion();

  const canSend = body.trim().length >= 8 && !busy;
  const kindLabel = FEEDBACK_KINDS.find((item) => item.id === kind)?.label ?? 'Suggestion';
  const placeLabel = FEEDBACK_SURFACES.find((item) => item.id === place)?.label ?? 'Other';

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setPlace(surface);
      playOpen();
    }
  }, [playOpen, surface, visible]);

  const dismiss = () => {
    playClose(() => {
      setOpen(false);
      onClose();
    });
  };

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      await submitAppFeedback(body, kind, place);
      if (kind === 'bug') {
        telemetry.trackIssue('suggestion_bug', place);
        supportSignals.capture({ feature: supportFeatureForPath(place === 'home' ? '/' : `/${place}`), code: 'user_report' });
      }
      else telemetry.trackFeature('suggestion', place);
      setBody('');
      dismiss();
      Alert.alert('Got it', Platform.OS === 'web' ? 'Your feedback has been sent to the Tapua’i team.'
        : 'Admin will see this on Feedback. If it ships, it goes out with Publish to app.');
    } catch (caught) {
      Alert.alert('Could not send', caught instanceof Error ? caught.message : 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  if (!open && !visible) return null;

  return (
    <Modal
      animationType="none"
      transparent
      visible={visible}
      onRequestClose={dismiss}
      onDismiss={() => setOpen(false)}
    >
      <View style={styles.root}>
        <Pressable haptic="none" onPress={dismiss} style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <BlurView intensity={40} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
            <View style={styles.dim} />
          </Animated.View>
        </Pressable>
        <View pointerEvents="box-none" style={frame.dock}>
        <Animated.View style={[styles.sheet, frame.card, { maxHeight: windowHeight * 0.85 }, sheetStyle]}>
          <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={dismiss} />
          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>Improve Tapua'i</Text>
          <Text style={styles.title}>{Platform.OS === 'web' ? 'Share feedback' : 'Send a suggestion'}</Text>
          <Text style={styles.lede}>{Platform.OS === 'web' ? 'For app ideas and problems. To report a clip, use Report / Hide.'
            : 'Goes to the admin Feedback desk — not a clip report.'}</Text>

          <Text style={styles.fieldLabel}>Type · {kindLabel}</Text>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.menuRail}
          >
            {FEEDBACK_KINDS.map((item) => {
              const on = kind === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={item.label}
                  haptic="selection"
                  onPress={() => setKind(item.id)}
                  style={[styles.menuChip, on && styles.menuChipOn]}
                >
                  <Text style={[styles.menuChipLabel, on && styles.menuChipLabelOn]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.fieldLabel}>Where · {placeLabel}</Text>
          <ScrollView
            nestedScrollEnabled
            style={styles.menuList}
            contentContainerStyle={styles.menuListContent}
            showsVerticalScrollIndicator
          >
            {FEEDBACK_SURFACES.map((item) => {
              const on = place === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={item.label}
                  haptic="selection"
                  onPress={() => setPlace(item.id)}
                  style={[styles.menuRow, on && styles.menuRowOn]}
                >
                  <Text style={[styles.menuRowLabel, on && styles.menuRowLabelOn]}>{item.label}</Text>
                  {on ? <Text style={styles.menuCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="What should change, and why?"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={Platform.OS === 'web' ? 'Your feedback' : 'Suggestion'}
            multiline
            style={styles.field}
          />
          <AnimatedButton
            haptic="medium"
            disabled={!canSend}
            accessibilityLabel={Platform.OS === 'web' ? 'Send feedback' : 'Send suggestion'}
            contentStyle={[styles.send, !canSend && styles.sendOff]}
            onPress={() => void send()}
          >
            <Text style={styles.sendLabel}>{busy ? 'Sending…' : Platform.OS === 'web' ? 'Send feedback' : 'Send suggestion'}</Text>
          </AnimatedButton>
          </ScrollView>
          <AnimatedButton haptic="light" accessibilityLabel="Cancel" contentStyle={styles.cancel} onPress={dismiss}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </AnimatedButton>
        </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bodyScroll: { flexGrow: 0, flexShrink: 1, alignSelf: 'stretch' },
  bodyContent: { gap: 10, paddingBottom: 4 },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7,10,12,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  kicker: {
    color: FOCAL.jadeInk,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    ...TYPE.title,
    ...figtree('800'),
  },
  lede: {
    color: colors.textMuted,
    ...TYPE.body,
    ...figtree('600'),

  },
  fieldLabel: {
    color: colors.textMuted,
    ...TYPE.caption,
    ...figtree('800'),
    letterSpacing: 0.2,
    marginTop: 2,
  },
  menuRail: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: 8,
  },
  menuChip: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuChipOn: {
    backgroundColor: FOCAL.mistJade,
    borderColor: FOCAL.jadeInk,
  },
  menuChipLabel: {
    color: colors.textMuted,
    ...TYPE.button,
    ...figtree('800'),
  },
  menuChipLabelOn: {
    color: FOCAL.jadeInk,
  },
  menuList: {
    maxHeight: 148,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  menuListContent: {
    paddingVertical: 4,
  },
  menuRow: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  menuRowOn: {
    backgroundColor: FOCAL.mistJade,
  },
  menuRowLabel: {
    color: colors.text,
    ...TYPE.button,
    ...figtree('700'),
  },
  menuRowLabelOn: {
    color: FOCAL.jadeInk,
  },
  menuCheck: {
    color: FOCAL.jadeInk,
    ...TYPE.body,
    ...figtree('800'),
  },
  field: {
    minHeight: 88,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...TYPE.body,
    ...figtree('600'),
    textAlignVertical: 'top',
  },
  send: {
    minHeight: 48,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: {
    opacity: 0.45,
  },
  sendLabel: {
    color: FOCAL.ink,
    ...TYPE.body,
    ...figtree('800'),
  },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: colors.textMuted,
    ...TYPE.button,
    ...figtree('700'),
  },
});
