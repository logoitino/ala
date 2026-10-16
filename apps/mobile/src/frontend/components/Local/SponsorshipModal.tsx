/** Fan menu uses shared Daylight chrome; the feature retains its identity, validation and data ownership. */
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { CardShine } from '@/components/Effects/CardShine';
import { colors, MENU_METRICS, radii } from '@/constants/theme';
import { useSheetFrame } from '@/hooks/useSheetFrame';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import {
  catalogSponsorTiers,
  formatSponsorDollars,
  initialsForBusiness,
  type SponsorTier,
} from '@/data/sponsorships';
import { useTipCheckout } from '@/hooks/useTipCheckout';
import type { RecordSponsorshipInput } from '@/hooks/useSponsorships';
import { uploadSponsorLogo } from '@/lib/sponsorships';
import { SPRING_SHEET, TAB_ACCENTS } from '@/theme/motion';
import type { SponsorshipTierId } from '@/types/database';

type SponsorshipModalProps = {
  visible: boolean;
  schoolOptions?: string[];
  onClose: () => void;
  onSponsored: (input: RecordSponsorshipInput) => Promise<void>;
};

const IMAGE_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.85,
};

function fireLight() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Simulator / web may not expose haptics.
  }
}

/**
 * @purpose Local booster Sponsorship Tier sheet: Silver / Gold / Platinum, business identity, Stripe PaymentSheet.
 * @param visible Opens the modal over Local.
 * @param schoolOptions Live match school chips for Targeted School Team.
 * @param onClose Dismiss (locked while PaymentSheet is open).
 * @param onSponsored Persist `sponsorships` after a successful one-time charge.
 * @returns Bottom sheet with Silver / Gold / Platinum cards, logo, and Complete Sponsorship checkout.
 * @sideEffects ImagePicker, Storage logo upload, `useTipCheckout` PaymentSheet, `add_user_aura` (payer), Light `impactAsync` on tier change, Success notification from checkout.
 */
export function SponsorshipModal({
  visible,
  schoolOptions = [],
  onClose,
  onSponsored,
}: SponsorshipModalProps) {
  const frame = useSheetFrame();
  const { live } = useAppRuntime();
  const { startCheckout, busy } = useTipCheckout();
  const tiers = catalogSponsorTiers(live.catalog.sponsorTiers);
  const [tierId, setTierId] = useState<SponsorshipTierId>('silver');
  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [schoolTeam, setSchoolTeam] = useState('');
  const sheetY = useSharedValue(28);
  const sheetOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    setTierId('silver');
    setBusinessName('');
    setLogoUrl('');
    setSchoolTeam('');
    sheetY.value = 28;
    sheetOpacity.value = 0;
    sheetY.value = withSpring(0, SPRING_SHEET);
    sheetOpacity.value = withTiming(1, { duration: 220 });
  }, [visible, sheetOpacity, sheetY]);

  const sheetEntrance = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [{ translateY: sheetY.value }],
  }));

  const tier = tiers.find((item) => item.id === tierId) ?? tiers[0];

  const dismiss = () => {
    if (busy) return;
    onClose();
  };

  const selectTier = (next: SponsorTier) => {
    if (next.id === tierId) return;
    fireLight();
    setTierId(next.id);
  };

  const pickLogo = async () => {
    if (busy) return;
    fireLight();
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo library', 'Allow photo access to upload a brand logo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(IMAGE_OPTIONS);
      if (result.canceled || !result.assets[0]?.uri) return;
      setLogoUrl(result.assets[0].uri);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open the photo library.';
      Alert.alert('Logo upload', message);
    }
  };

  const checkout = () => {
    const name = businessName.trim();
    const school = schoolTeam.trim();
    if (!name) {
      Alert.alert('Business name', 'Add the business name that will appear on the booster rail.');
      return;
    }
    if (!school) {
      Alert.alert('School team', 'Pick the high school team this sponsorship backs.');
      return;
    }

    void startCheckout({
      tipAmount: tier.dollars,
      coverFees: false,
      skipBacker: true,
      auraPoints: tier.auraPoints,
      successToast: `${tier.name} locked 🏆 +${tier.auraPoints.toLocaleString()} Aura`,
      onPaid: async () => {
        const storedLogo = logoUrl.trim() ? await uploadSponsorLogo(logoUrl.trim()) : '';
        await onSponsored({
          businessName: name,
          logoUrl: storedLogo,
          schoolTeam: school,
          tier: tier.id,
        });
        onClose();
      },
    });
  };

  const previewName = businessName.trim() || 'Your business';

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdropWrap}
      >
        <Pressable haptic="none" disabled={busy} style={styles.backdrop} onPress={dismiss}>
          <BlurView intensity={48} tint="dark" pointerEvents="none" style={styles.blur} />
          <View pointerEvents="box-none" style={frame.dock}>
          <Pressable haptic="none" style={[styles.sheet, frame.card]} onPress={() => undefined}>
          <MenuBackdrop accent="cyan" />
          <SheetHandle onDismiss={dismiss} />
            <Animated.View style={[styles.sheetInner, sheetEntrance]}>
            <View style={styles.handle} />
            <Text style={styles.kicker}>Local boosters</Text>
            <Text style={styles.title}>Become a Team Sponsor</Text>
            <Text style={styles.blurb}>
              Back a high school program. This charge is one time through Stripe PaymentSheet; the rail lists you as {formatSponsorDollars(tier.dollars)}.
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.form}
            >
              {tiers.map((option) => {
                const selected = option.id === tierId;
                return (
                  <AnimatedButton
                    key={option.id}
                    accessibilityLabel={`${option.name}, ${formatSponsorDollars(option.dollars)}`}
                    accessibilityState={{ selected }}
                    haptic="none"
                    onPress={() => selectTier(option)}
                    contentStyle={[
                      styles.tierCard,
                      selected && styles.tierCardOn,
                      selected && { borderColor: option.accent, backgroundColor: `${option.accent}22` },
                    ]}
                  >
                    {selected ? (
                      <CardShine tint={`${option.accent}55`} color="rgba(255,255,255,0.85)" width={38} loopMs={2600} />
                    ) : null}
                    <View style={styles.tierHead}>
                      <View style={[styles.radio, { borderColor: selected ? option.accent : colors.border }]}>
                        {selected ? <View style={[styles.radioDot, { backgroundColor: option.accent }]} /> : null}
                      </View>
                      <Text style={[styles.tierName, selected && { color: option.accent }]}>{option.name}</Text>
                      <View style={[styles.badge, { borderColor: option.accent }]}>
                        <Text style={[styles.badgeLabel, { color: option.accent }]}>{option.badge}</Text>
                      </View>
                    </View>
                    <Text style={[styles.tierPrice, { color: option.accent }]}>{formatSponsorDollars(option.dollars)}</Text>
                    <Text style={styles.tierPerks}>{option.perks}</Text>
                  </AnimatedButton>
                );
              })}

              <Text style={styles.fieldLabel}>Business Name</Text>
              <TextInput
                value={businessName}
                onChangeText={setBusinessName}
                editable={!busy}
                placeholder="Island Grill"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Logo Upload / URL</Text>
              <View style={styles.logoRow}>
                <View style={styles.logoPreview}>
                  {logoUrl.trim() ? (
                    <Image source={{ uri: logoUrl.trim() }} style={styles.logoImage} />
                  ) : (
                    <Text style={styles.logoInitials}>{initialsForBusiness(previewName)}</Text>
                  )}
                </View>
                <View style={styles.logoFields}>
                  <TextInput
                    value={logoUrl}
                    onChangeText={setLogoUrl}
                    editable={!busy}
                    placeholder="https://… or pick a photo"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                  <AnimatedButton
                    accessibilityLabel="Upload logo from photo library"
                    disabled={busy}
                    haptic="none"
                    onPress={() => void pickLogo()}
                    contentStyle={styles.uploadBtn}
                  >
                    <Text style={styles.uploadLabel}>Upload logo</Text>
                  </AnimatedButton>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Targeted School Team</Text>
              <TextInput
                value={schoolTeam}
                onChangeText={setSchoolTeam}
                editable={!busy}
                placeholder="Westlake Thunder"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                style={styles.input}
              />
              {schoolOptions.length > 0 ? (
                <View style={styles.schoolChips}>
                  {schoolOptions.slice(0, 8).map((school) => {
                    const selected = schoolTeam.trim().toLowerCase() === school.toLowerCase();
                    return (
                      <AnimatedButton
                        key={school}
                        accessibilityLabel={`Target ${school}`}
                        accessibilityState={{ selected }}
                        haptic="none"
                        onPress={() => {
                          fireLight();
                          setSchoolTeam(school);
                        }}
                        contentStyle={[styles.schoolChip, selected && styles.schoolChipOn]}
                      >
                        <Text style={[styles.schoolChipLabel, selected && styles.schoolChipLabelOn]} numberOfLines={1}>
                          {school}
                        </Text>
                      </AnimatedButton>
                    );
                  })}
                </View>
              ) : null}

              <AnimatedButton
                accessibilityLabel={`Complete Sponsorship, ${tier.name} for ${formatSponsorDollars(tier.dollars)}`}
                disabled={busy}
                onPress={checkout}
                contentStyle={[styles.pay, busy && styles.payOff]}
              >
                <Text style={styles.payLabel}>{busy ? 'Opening PaymentSheet…' : 'Complete Sponsorship'}</Text>
                {busy ? null : (
                  <Text style={styles.payMeta}>
                    {tier.name} · {formatSponsorDollars(tier.dollars)}
                  </Text>
                )}
              </AnimatedButton>
            </ScrollView>
            </Animated.View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={dismiss}
              style={[styles.close, busy && styles.closeDisabled]}
            >
              <Text style={styles.closeLabel}>{busy ? 'Finish payment to close' : 'Cancel'}</Text>
            </Pressable>
          </Pressable>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    width: '100%',
    height: '100%',
    ...Platform.select({
      web: {
        ...StyleSheet.absoluteFill,
        zIndex: 50,
      },
      default: {},
    }),
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.border,
  },
  blur: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  sheetInner: {
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  kicker: {
    color: TAB_ACCENTS.local.color,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  blurb: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  form: {
    gap: 10,
    paddingBottom: 8,
  },
  tierCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  tierCardOn: {
    borderWidth: 2,
  },
  tierHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tierName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  tierPrice: {
    fontSize: 14,
    fontWeight: '800',
  },
  tierPerks: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  input: {
    minHeight: 48,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  logoRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  logoPreview: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.photoPlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 56,
    height: 56,
  },
  logoInitials: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  logoFields: {
    flex: 1,
    gap: 8,
  },
  uploadBtn: {
    minHeight: 40,
    borderRadius: MENU_METRICS.controlRadius,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  schoolChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  schoolChip: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 180,
  },
  schoolChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.accentSoft,
  },
  schoolChipLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  schoolChipLabelOn: {
    color: colors.primary,
  },
  pay: {
    minHeight: 52,
    borderRadius: MENU_METRICS.controlRadius,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
    gap: 2,
  },
  payOff: {
    opacity: 0.55,
  },
  payLabel: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  payMeta: {
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.85,
    textAlign: 'center',
  },
  close: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeDisabled: {
    opacity: 0.55,
  },
  closeLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
