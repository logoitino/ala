/**
 * The admin-published Home campaign banner and kicker / lede copy above the Home pills
 * (split out of app/(tabs)/index.tsx for R4-03; behaviour unchanged). Empty strings render nothing,
 * so an unpublished campaign leaves no gap in the chrome stack.
 */
import { StyleSheet, Text, View } from 'react-native';

import type { AppRuntimeConfig } from '@/lib/runtime';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Show the Look desk's Home banner title / body and kicker / lede when they are set.
 * @param runtime Published runtime copy and theme text colour.
 */
export function HomeCampaignCopy({ runtime }: { runtime: AppRuntimeConfig }) {
  return (
    <>
      {runtime.copy.homeBannerTitle.trim() ? (
        <View style={[styles.campaign, { borderColor: FOCAL.electricGold }]}>
          <Text style={[styles.campaignTitle, { color: FOCAL.electricGold }]}>{runtime.copy.homeBannerTitle}</Text>
          {runtime.copy.homeBannerBody.trim() ? (
            <Text style={[styles.campaignBody, { color: runtime.theme.text }]}>{runtime.copy.homeBannerBody}</Text>
          ) : null}
        </View>
      ) : null}
      {runtime.copy.homeKicker.trim() || runtime.copy.homeLede.trim() ? (
        <View style={styles.homeCopy}>
          {runtime.copy.homeKicker.trim() ? (
            <Text style={[styles.homeKicker, { color: FOCAL.electricGold }]}>{runtime.copy.homeKicker}</Text>
          ) : null}
          {runtime.copy.homeLede.trim() ? (
            <Text style={[styles.homeLede, { color: runtime.theme.text }]}>{runtime.copy.homeLede}</Text>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  campaign: {
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'rgba(15,20,22,0.78)',
    borderColor: FOCAL.electricGold,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  campaignTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: FOCAL.electricGold,
  },
  campaignBody: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  homeCopy: {
    gap: 2,
  },
  homeKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: FOCAL.electricGold,
  },
  homeLede: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.86,
  },
});
