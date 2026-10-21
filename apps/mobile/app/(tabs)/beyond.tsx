/** Beyond the Game route: existing discovery/composer permissions with readable Highlights return chrome.
 * Upload ＋ (?compose=1) opens the composer only through BeyondGameScreen readiness; no new bar destination. */
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { BeyondCategory } from '@tapuai/shared-types/beyondGame';

import { TabScreen } from '@/components/TabScreen';
import { RuntimePaused } from '@/components/RuntimePaused';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { BeyondGameScreen } from '@/components/BeyondGame/BeyondGameScreen';
import { FamilyFunDiscovery } from '@/components/FamilyFun/FamilyFunDiscovery';
import { LegacyWorkoutList } from '@/components/BeyondGame/LegacyWorkoutList';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { colors } from '@/constants/theme';

export default function BeyondTab() {
  const { live } = useAppRuntime();
  const [focused, setFocused] = useState(false);
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const legacy = useCallback((category: BeyondCategory) => (
    <LegacyWorkoutList category={category} active={focused && live.tabs.beyond} />
  ), [focused, live.tabs.beyond]);
  const composeStarted = useCallback(() => router.setParams({ compose: undefined }), []);
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <TabScreen>
      <View style={styles.bar}>
        <AnimatedButton
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel="Back to Highlights"
          contentStyle={styles.back}
          onPress={back}
        >
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
          <Text style={styles.backLabel}>Highlights</Text>
        </AnimatedButton>
      </View>
      {live.tabs.beyond ? (
        <>
          <View style={styles.fan}><FamilyFunDiscovery surface="beyond" /></View>
          <BeyondGameScreen
            active={focused}
            renderLegacy={legacy}
            startComposing={compose === '1'}
            onComposeStarted={composeStarted}
          />
        </>
      ) : (
        <RuntimePaused title="Beyond the Game is paused" lede="Enable Beyond in Features and publish." />
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  back: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backLabel: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    flexShrink: 1,
  },
  fan: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
});
