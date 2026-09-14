import { useState } from 'react';
import { Alert, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import {
  FEEDBACK_KINDS,
  FEEDBACK_SURFACES,
  submitAppFeedback,
  type AppFeedbackKind,
  type AppFeedbackSurface,
} from '@/lib/feedback';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';

type SuggestionSheetProps = {
  visible: boolean;
  surface?: AppFeedbackSurface;
  onClose: () => void;
};

/**
 * @purpose Fan suggestion / bug / look note. Distinct from Report / Hide on a clip.
 * @sideEffects `submit_app_feedback`.
 */
export function SuggestionSheet({ visible, surface = 'other', onClose }: SuggestionSheetProps) {
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<AppFeedbackKind>('suggestion');
  const [place, setPlace] = useState<AppFeedbackSurface>(surface);
  const [busy, setBusy] = useState(false);

  const canSend = body.trim().length >= 8 && !busy;

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      await submitAppFeedback(body, kind, place);
      if (kind === 'bug') telemetry.trackIssue('suggestion_bug', place);
      else telemetry.trackFeature('suggestion', place);
      setBody('');
      onClose();
      Alert.alert('Got it', 'Admin will see this on Feedback. If it ships, it goes out with Publish to app.');
    } catch (caught) {
      Alert.alert('Could not send', caught instanceof Error ? caught.message : 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={[styles.root, Platform.OS === 'web' ? styles.webRoot : undefined]}>
        <Pressable haptic="none" onPress={onClose} style={StyleSheet.absoluteFill}>
          <BlurView intensity={40} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
          <View style={styles.dim} />
        </Pressable>
        <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>Improve Tapua'i</Text>
          <Text style={styles.title}>Send a suggestion</Text>
          <Text style={styles.lede}>Not a clip report. This goes to the admin Feedback desk, then Engineer Lab if it should ship as chrome.</Text>
          <View style={styles.pills}>
            {FEEDBACK_KINDS.map((item) => (
              <AnimatedButton
                key={item.id}
                haptic="selection"
                accessibilityLabel={item.label}
                contentStyle={[styles.pill, kind === item.id && styles.pillOn]}
                onPress={() => setKind(item.id)}
              >
                <Text style={[styles.pillLabel, kind === item.id && styles.pillLabelOn]}>{item.label}</Text>
              </AnimatedButton>
            ))}
          </View>
          <View style={styles.pills}>
            {FEEDBACK_SURFACES.map((item) => (
              <AnimatedButton
                key={item.id}
                haptic="selection"
                accessibilityLabel={item.label}
                contentStyle={[styles.pill, place === item.id && styles.pillOn]}
                onPress={() => setPlace(item.id)}
              >
                <Text style={[styles.pillLabel, place === item.id && styles.pillLabelOn]}>{item.label}</Text>
              </AnimatedButton>
            ))}
          </View>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="What should change, and why?"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Suggestion"
            multiline
            style={styles.field}
          />
          <AnimatedButton
            haptic="medium"
            disabled={!canSend}
            accessibilityLabel="Send suggestion"
            contentStyle={[styles.send, !canSend && styles.sendOff]}
            onPress={() => void send()}
          >
            <Text style={styles.sendLabel}>{busy ? 'Sending…' : 'Send suggestion'}</Text>
          </AnimatedButton>
          <AnimatedButton haptic="light" accessibilityLabel="Cancel" contentStyle={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </AnimatedButton>
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
  webRoot: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7,10,12,0.45)',
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  kicker: {
    color: FOCAL.jadeInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  lede: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: {
    backgroundColor: FOCAL.neonJade,
    borderColor: FOCAL.jadeInk,
  },
  pillLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  pillLabelOn: {
    color: FOCAL.ink,
  },
  field: {
    minHeight: 96,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  send: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: {
    opacity: 0.45,
  },
  sendLabel: {
    color: FOCAL.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  cancel: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
