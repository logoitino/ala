import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { useAppRuntime } from '@/context/AppRuntimeContext';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';

const STORAGE_KEY = 'tapuai.slangGuideDismissed';

type SlangGuideBannerProps = {
  overlay?: boolean;
};

/**
 * @purpose Home Mālo / Seki explainer. Copy and visibility come from Look / Features (`copy.slangLine`, `layouts.slangGuide`).
 * @param overlay When true, sits over Highlights chrome instead of in the feed header.
 * @sideEffects AsyncStorage dismiss key; `feature_tap` slang.
 */
export function SlangGuideBanner({ overlay = false }: SlangGuideBannerProps) {
  const insets = useSafeAreaInsets();
  const { live } = useAppRuntime();
  const [visible, setVisible] = useState(false);
  const copy = live.copy.slangLine.trim() || 'Donations go to the athlete’s family • Seki = Awesome Play';

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (active && value !== '1') setVisible(true);
      })
      .catch(() => {
        if (active) setVisible(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    telemetry.trackFeature('slang', 'home');
    void AsyncStorage.setItem(STORAGE_KEY, '1');
  };

  if (!visible || !live.layouts.slangGuide) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        overlay ? styles.overlay : styles.inline,
        overlay && { paddingTop: insets.top + 8 },
      ]}
    >
      <View style={styles.banner} accessibilityRole="summary" accessibilityLabel={copy}>
        <Text style={styles.copy}>{copy}</Text>
        <AnimatedButton
          haptic="selection"
          accessibilityLabel="Dismiss slang guide"
          onPress={dismiss}
          contentStyle={styles.dismiss}
        >
          <Text style={styles.dismissLabel}>OK</Text>
        </AnimatedButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 12,
  },
  inline: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: FOCAL.mistGold,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: FOCAL.electricGold,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  copy: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  dismiss: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    backgroundColor: FOCAL.goldInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissLabel: {
    color: colors.onAccent,
    fontSize: 12,
    fontWeight: '800',
  },
});
