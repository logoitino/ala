import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { colors } from '@/constants/theme';
import { completeAuthRedirect } from '@/lib/auth';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Deep-link landing for Magic Link / OAuth (`alasports://auth/callback`). Completes session then returns home.
 * @sideEffects `completeAuthRedirect`; Expo Router replace to `/`.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const url = (await Linking.getInitialURL()) ?? Linking.createURL('auth/callback', { queryParams: params as Record<string, string> });
        await completeAuthRedirect(url);
      } catch {
        // SoftWall / AuthContext deep-link listener may also complete the session.
      } finally {
        if (active) router.replace('/');
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [params, router]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={FOCAL.jadeInk} />
      <Text style={styles.copy}>Signing you in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.background,
  },
  copy: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 15,
  },
});
