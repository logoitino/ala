import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Checkbox } from 'expo-checkbox';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { LEGAL_ACK_LABEL, LEGAL_MENU_LABEL, LEGAL_SECTIONS, LEGAL_TERMS_VERSION } from '@/data/legal';
import { useLegalAck } from '@/hooks/useLegalAck';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';

type LegalModalProps = {
  visible: boolean;
  onClose: () => void;
  /** When true, the sheet includes the mandatory acknowledgement control. */
  requireAck?: boolean;
};

type LegalAckToggleProps = {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  onOpenTerms?: () => void;
  disabled?: boolean;
  /** Overrides the default Terms/NIL copy — e.g. the COPPA age-gate checkbox reuses this same control. */
  label?: string;
};

/**
 * @purpose Mandatory Terms / NIL / minor-safety checkbox for Athlete Verification and Stripe Connect.
 * Also reused (with a custom `label`) for the Soft-Wall / OAuth COPPA "13 years of age or older" gate.
 * @param checked Local or persisted acknowledgement.
 * @param onCheckedChange Parent persists via `useLegalAck.accept` when turning on.
 * @param onOpenTerms Opens `LegalModal` so the athlete can read the three sections.
 */
export function LegalAckToggle({ checked, onCheckedChange, onOpenTerms, disabled, label }: LegalAckToggleProps) {
  return (
    <View style={styles.ackCard}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: Boolean(disabled) }}
        disabled={disabled}
        haptic="selection"
        onPress={() => onCheckedChange(!checked)}
        style={styles.ackRow}
      >
        <Checkbox
          pointerEvents="none"
          value={checked}
          color={checked ? colors.primary : undefined}
          style={styles.checkbox}
        />
        <Text style={styles.ackLabel}>{label ?? LEGAL_ACK_LABEL}</Text>
      </Pressable>
      {onOpenTerms ? (
        <Pressable accessibilityRole="button" haptic="selection" onPress={onOpenTerms} style={styles.readLink}>
          <Text style={styles.readLinkLabel}>Read Terms of Service & NIL Compliance 📜</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * @purpose Bottom sheet for Terms of Service, High School NIL Disclaimer, and Minor Safety policy.
 * @param visible Opens over Profile Settings or verification / payout gates.
 * @param requireAck When true, shows the same mandatory toggle and stamps `recordLegalAck`.
 * @returns Blur + Daylight bottom sheet matching ProfileMenuSheet chrome.
 * @sideEffects Telemetry `legal_terms`; optional `useLegalAck.accept`.
 */
export function LegalModal({ visible, onClose, requireAck = false }: LegalModalProps) {
  const insets = useSafeAreaInsets();
  const { accepted, accept } = useLegalAck();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setChecked(accepted);
      telemetry.trackFeature('legal_terms', 'profile');
    }
  }, [accepted, visible]);

  if (!open && !visible) return null;

  const dismiss = () => {
    setOpen(false);
    onClose();
  };

  const onConfirm = async () => {
    if (requireAck) {
      if (!checked) return;
      if (!accepted) await accept();
    }
    dismiss();
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={dismiss}>
      <View style={styles.root}>
        <Pressable haptic="none" style={styles.backdrop} onPress={dismiss}>
          <BlurView intensity={40} tint="dark" pointerEvents="none" style={StyleSheet.absoluteFill} />
        </Pressable>
        <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>Legal</Text>
          <Text style={styles.title}>{LEGAL_MENU_LABEL}</Text>
          <Text style={styles.lede}>
            Prototype summary (v{LEGAL_TERMS_VERSION}). This is not legal advice and is not a claim that Tapua'i is
            approved NIL.
          </Text>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {LEGAL_SECTIONS.map((section) => (
              <View key={section.id} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
          {requireAck ? (
            <LegalAckToggle
              checked={checked || accepted}
              onCheckedChange={(next) => {
                setChecked(next);
                if (next && !accepted) void accept();
              }}
              disabled={accepted}
            />
          ) : null}
          <AnimatedButton
            accessibilityLabel={requireAck ? 'Agree and close' : 'Close legal terms'}
            disabled={requireAck && !(checked || accepted)}
            haptic="selection"
            onPress={() => void onConfirm()}
            contentStyle={[
              styles.doneBtn,
              requireAck && !(checked || accepted) && styles.doneBtnOff,
            ]}
          >
            <Text style={styles.doneLabel}>{requireAck ? 'Agree & close' : 'Close'}</Text>
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
    maxHeight: '90%',
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
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  lede: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    color: colors.textMuted,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 420,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 8,
  },
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  sectionBody: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    color: colors.textMuted,
  },
  doneBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnOff: {
    opacity: 0.45,
  },
  doneLabel: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '800',
  },
  ackCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    padding: 12,
    gap: 8,
  },
  ackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    marginTop: 2,
  },
  ackLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    color: colors.text,
  },
  readLink: {
    paddingLeft: 28,
  },
  readLinkLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
});
