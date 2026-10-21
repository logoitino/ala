/**
 * One booster card on the Local "Top Aura Boosters" rail: logo or initials, business, school and tier badge.
 * Reports its x offset so the hub can scroll a searched booster into view
 * (split out of app/(tabs)/local/index.tsx for R4-03; behaviour unchanged).
 */

import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { cardShadow, colors, radii } from '@/constants/theme';
import { initialsForBusiness, sponsorTierById } from '@/data/sponsorships';
import { mediaUri } from '@/lib/media';
import { FOCAL } from '@/theme/motion';
import type { Sponsorship } from '@/types/database';

export function SponsorRailCard({
  sponsor,
  highlighted,
  onLayoutX,
  onPress,
}: {
  sponsor: Sponsorship;
  highlighted: boolean;
  onLayoutX: (x: number) => void;
  onPress: () => void;
}) {
  const pack = sponsorTierById(sponsor.tier);
  const logo = mediaUri(sponsor.logo_url);
  return (
    <View onLayout={(event) => onLayoutX(event.nativeEvent.layout.x)}>
      <AnimatedButton
        accessibilityRole="button"
        accessibilityLabel={`${sponsor.business_name}, ${pack.badge}, ${sponsor.school_team}`}
        haptic="selection"
        onPress={onPress}
        contentStyle={[
          styles.sponsorCard,
          sponsor.tier === 'gold' || sponsor.tier === 'platinum' ? styles.sponsorCardGold : undefined,
          highlighted ? styles.sponsorCardOn : undefined,
        ]}
      >
        <View style={styles.sponsorLogo}>
          {logo ? (
            <Image source={{ uri: logo }} resizeMode="cover" style={styles.sponsorLogoImage} />
          ) : (
            <Text style={styles.sponsorInitials}>{initialsForBusiness(sponsor.business_name)}</Text>
          )}
        </View>
        <Text style={styles.sponsorName}>
          {sponsor.business_name}
        </Text>
        {sponsor.school_team ? (
          <Text style={styles.sponsorSchool}>
            {sponsor.school_team}
          </Text>
        ) : null}
        <View style={[styles.tierBadge, { borderColor: pack.accent }]}>
          <Text style={[styles.tierBadgeLabel, { color: pack.accent }]}>{pack.badge}</Text>
        </View>
      </AnimatedButton>
    </View>
  );
}

const styles = StyleSheet.create({
  sponsorCard: {
    width: 168,
    backgroundColor: FOCAL.mistCyan,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
    ...cardShadow,
  },
  sponsorCardGold: {
    backgroundColor: FOCAL.mistGold,
    borderColor: FOCAL.electricGold,
  },
  sponsorCardOn: {
    borderWidth: 2,
    borderColor: FOCAL.electricGold,
    shadowColor: FOCAL.electricGold,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  sponsorLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.photoPlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sponsorLogoImage: {
    width: 48,
    height: 48,
  },
  sponsorInitials: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  sponsorName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  sponsorSchool: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  tierBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tierBadgeLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
});
