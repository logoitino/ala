/** School-issued crest and confirmation proof; presentation never confers verification beyond the badge RPC. */
import { useState } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CardShine } from '@/components/Effects/CardShine';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { colors, MENU_METRICS, radii } from '@/constants/theme';
import { schoolBadgeColors, schoolMonogram, type SchoolBadge } from '@/lib/schoolBadge';
import { FOCAL } from '@/theme/motion';

const SHIELD = 'M50 3 L95 17 V56 C95 85 75 104 50 114 C25 104 5 85 5 56 V17 Z';

const CONFIRMED_BY: Record<SchoolBadge['confirmedBy'], string> = {
  athletic_director: 'the athletic director',
  coach: 'a coach',
  tapuai: 'Tapua’i',
};

function confirmedDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * @purpose The school's shield: admin logo when set, else a monogram in the school colours, with a
 *   jade ✓ seal and a moving shine. Only rendered from `athlete_school_badge` data.
 * @param size Shield width in px (height is ~1.15×).
 */
export function SchoolCrestMark({ badge, size = 40 }: { badge: SchoolBadge; size?: number }) {
  const { primary, secondary } = schoolBadgeColors(badge);
  const height = Math.round(size * 1.16);
  const seal = Math.max(14, Math.round(size * 0.42));
  return (
    <View style={{ width: size, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={height} viewBox="0 0 100 116">
        <Path d={SHIELD} fill={primary} stroke={secondary} strokeWidth={7} strokeLinejoin="round" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.crestInner]}>
        {badge.logoUrl ? (
          <Image
            source={{ uri: badge.logoUrl }}
            resizeMode="contain"
            style={{ width: size * 0.62, height: size * 0.62, marginTop: -size * 0.06 }}
          />
        ) : (
          <Text style={[styles.monogram, { color: secondary, fontSize: size * 0.36, marginTop: -size * 0.06 }]}>
            {schoolMonogram(badge.schoolName)}
          </Text>
        )}
      </View>
      <View style={[StyleSheet.absoluteFill, styles.shineClip, { borderRadius: size * 0.3 }]} pointerEvents="none">
        <CardShine tint={`${secondary}88`} loopMs={2600} width={Math.max(6, size * 0.18)} />
      </View>
      <View
        style={[
          styles.seal,
          { width: seal, height: seal, borderRadius: seal / 2, right: -seal * 0.28, bottom: -seal * 0.12 },
        ]}
      >
        <Text style={[styles.sealCheck, { fontSize: seal * 0.62 }]}>✓</Text>
      </View>
    </View>
  );
}

/**
 * @purpose Tappable crest that opens the proof sheet ("Confirmed in person by … on …"). A crest pasted
 *   into a profile photo can't open this sheet, which is how fans tell the real badge from a copy.
 * @param athleteName Shown in the proof sheet.
 */
export function SchoolCrest({ badge, athleteName, size = 40 }: { badge: SchoolBadge; athleteName: string; size?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${badge.schoolName} confirmed athlete. Show proof`}
        haptic="selection"
        hitSlop={8}
        onPress={() => setOpen(true)}
      >
        <SchoolCrestMark badge={badge} size={size} />
      </Pressable>
      <SchoolBadgeProofSheet badge={badge} athleteName={athleteName} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * @purpose Who confirmed this athlete and when. Explains that only Tapua'i can show the crest.
 */
export function SchoolBadgeProofSheet({
  badge,
  athleteName,
  visible,
  onClose,
}: {
  badge: SchoolBadge;
  athleteName: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { primary } = schoolBadgeColors(badge);
  const when = confirmedDate(badge.confirmedAt);
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable haptic="none" style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { borderTopColor: primary }]}>
          <MenuBackdrop accent="jade" />
          <SchoolCrestMark badge={badge} size={72} />
          <Text style={styles.sheetTitle}>
            {athleteName} is a confirmed {badge.schoolName} athlete
          </Text>
          <Text style={styles.sheetBody}>
            Confirmed in person by {CONFIRMED_BY[badge.confirmedBy]}
            {when ? ` on ${when}` : ''}.
          </Text>
          <Text style={styles.sheetFine}>
            Only Tapua’i can show this crest, and tapping it always opens this proof. A school logo inside a profile
            photo is not a confirmation.
          </Text>
          <Pressable accessibilityRole="button" haptic="selection" onPress={onClose} style={styles.sheetButton}>
            <Text style={styles.sheetButtonLabel}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * @purpose School-colour band behind a confirmed athlete's profile photo, with the mascot as a faint
 *   watermark. Fans have no banner or cover image, so this band only ever means "school confirmed".
 */
export function SchoolHeroBand({ badge }: { badge: SchoolBadge }) {
  const { primary, secondary } = schoolBadgeColors(badge);
  return (
    <View pointerEvents="none" style={[styles.band, { backgroundColor: primary }]}>
      <View style={[styles.bandStripe, { backgroundColor: secondary }]} />
      <Text numberOfLines={1} style={[styles.bandWatermark, { color: secondary }]}>
        {(badge.mascot ?? badge.schoolName).toUpperCase()}
      </Text>
      <CardShine tint={`${secondary}55`} loopMs={4200} width={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  crestInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: {
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  shineClip: {
    overflow: 'hidden',
  },
  seal: {
    position: 'absolute',
    backgroundColor: FOCAL.jadeInk,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealCheck: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15,20,22,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: MENU_METRICS.sheetRadius,
    borderTopWidth: 6,
    padding: 20,
    gap: 10,
    alignItems: 'center',
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  sheetBody: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  sheetFine: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  sheetButton: {
    alignSelf: 'stretch',
    minHeight: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    backgroundColor: FOCAL.jadeInk,
  },
  sheetButtonLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 104,
    borderRadius: radii.lg,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  bandStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 6,
  },
  bandWatermark: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 4,
    opacity: 0.16,
    textAlign: 'center',
  },
});
