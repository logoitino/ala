/** Current OAuth returns complete once per route input; web failure recovery cleans Router history state so return details cannot reappear. */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

import { colors } from '@/constants/theme';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { completeAuthRedirect } from '@/lib/auth';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Deep-link landing for Magic Link / OAuth. Returns home only after a completed session; otherwise offers recovery.
 * @sideEffects `completeAuthRedirect`; Expo Router replace to `/`.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [failed, setFailed] = useState(false);
  const recovering = useRef(false);
  const hasInvalidParams = Object.values(params).some((value) => typeof value !== 'string');
  // Router params objects can change identity on each render; only changed return values restart completion.
  const query = new URLSearchParams(
    Object.entries(params)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .sort(([a], [b]) => a.localeCompare(b)),
  ).toString();

  useEffect(() => {
    // Our own clean-route replacement must retain recovery, without retrying the consumed return.
    const cleanWebAddress = Platform.OS === 'web' && typeof window !== 'undefined'
      && !window.location.search && !window.location.hash;
    if (recovering.current && !query && !hasInvalidParams && cleanWebAddress) {
      setFailed(true);
      return;
    }
    recovering.current = false;
    let active = true;
    setFailed(false);
    const run = async () => {
      try {
        if (hasInvalidParams) throw new Error('Ambiguous sign-in return.');
        let url: string;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          // OAuth tokens can be in the fragment, which Router's search params do not carry.
          url = window.location.href;
        } else if (query) {
          url = Linking.createURL('auth/callback', { queryParams: Object.fromEntries(new URLSearchParams(query)) });
        } else {
          const initialURL = await Linking.getInitialURL();
          // A warm app can have been launched from a different screen's link.
          if (initialURL) {
            const initial = new URL(initialURL);
            const isCallback = initial.pathname === '/auth/callback' || initial.pathname === '/--/auth/callback'
              || (initial.hostname === 'auth' && initial.pathname === '/callback');
            if (!isCallback) throw new Error('No sign-in return.');
          }
          url = initialURL ?? Linking.createURL('auth/callback');
        }
        if (!active) return;
        const session = await completeAuthRedirect(url);
        if (!active) return;
        if (!session) throw new Error('Incomplete sign-in return.');
        router.replace('/');
      } catch {
        if (!active) return;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          recovering.current = true;
          const hasReturnDetails = Boolean(query || hasInvalidParams || window.location.search || window.location.hash);
          // Do not leave tokens, one-time codes or provider error text in the recovery page address.
          try {
            window.history.replaceState(window.history.state, '', window.location.pathname);
          } catch {
            // Recovery stays available if browser history access is restricted.
          }
          if (hasReturnDetails) {
            try {
              // Router replays its stored path after navigation commits; clean that source too.
              router.replace('/auth/callback');
            } catch {
              // A navigation failure must still show recovery; the direct history cleanup was attempted.
            }
          }
        }
        setFailed(true);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [hasInvalidParams, query, router]);

  return (
    <View style={styles.wrap}>
      {failed ? (
        <>
          <Text style={styles.copy} accessibilityRole="alert">We couldn't finish signing you in.</Text>
          <Text style={styles.copy}>Return to the app and try again.</Text>
          <AnimatedButton accessibilityLabel="Back to app" onPress={() => router.replace('/')} contentStyle={styles.button}>
            <Text style={styles.buttonLabel}>Back to app</Text>
          </AnimatedButton>
        </>
      ) : (
        <>
          <ActivityIndicator color={FOCAL.jadeInk} />
          <Text style={styles.copy}>Signing you in…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: colors.background,
  },
  copy: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
  button: {
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
});
