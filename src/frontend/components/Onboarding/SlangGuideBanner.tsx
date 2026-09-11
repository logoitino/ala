import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii } from '@/constants/theme';

const STORAGE_KEY = 'tapuai.slangGuideDismissed';
const GUIDE_COPY = 'Mālo = Direct Support • Seki = Awesome Play';

type SlangGuideBannerProps = {
  overlay?: boolean;
};

export function SlangGuideBanner({ overlay = false }: SlangGuideBannerProps) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

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
    void AsyncStorage.setItem(STORAGE_KEY, '1');
  };

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        overlay ? styles.overlay : styles.inline,
        overlay && { paddingTop: insets.top + 8 },
      ]}
    >
      <View style={styles.banner} accessibilityRole="summary" accessibilityLabel={GUIDE_COPY}>
        <Text style={styles.copy}>{GUIDE_COPY}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss slang guide"
          hitSlop={8}
          onPress={dismiss}
          style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
        >
          <Text style={styles.dismissLabel}>OK</Text>
        </Pressable>
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
    backgroundColor: colors.deepGreen,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#F4C430',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  copy: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  dismiss: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F4C430',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissLabel: {
    color: colors.deepGreen,
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.88,
  },
});
