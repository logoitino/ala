/**
 * Root layout, the first thing the app renders: mounts every provider (runtime config, auth, soft wall,
 * celebration, upload sheet, Stripe) and the root navigation Stack. Status-bar colour follows the runtime theme. Opt-in support observation preserves platform error handling.
 */

import 'react-native-gesture-handler';
import { useEffect, useRef } from 'react';
import { LogBox, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SupportRuntimeObserver } from '@/components/Common/SupportRuntimeObserver';
import { AuraToast } from '@/components/AuraToast';
import { BackedCelebration } from '@/components/BackedCelebration';
import { StudioPreviewBar } from '@/components/Admin/StudioPreviewBar';
import { AgeConfirmModal } from '@/components/Auth/AgeConfirmModal';
import { SoftWallModal } from '@/components/Auth/SoftWallModal';
import { WelcomeOverlay } from '@/components/Onboarding/WelcomeOverlay';
import { AuthProvider } from '@/context/AuthContext';
import { AppRuntimeProvider, useAppRuntime } from '@/context/AppRuntimeContext';
import { SoftWallProvider } from '@/context/SoftWallContext';
import { CelebrationProvider } from '@/context/CelebrationContext';
import { UploadSheetProvider } from '@/context/UploadSheetContext';
import { colors, isLightCanvas } from '@/constants/theme';
import { telemetry } from '@/services/TelemetryManager';
import { StripeProvider } from '@/lib/stripe';
import { APPLE_PAY_MERCHANT_ID } from '@/lib/walletPay';
import '@/services/OfflineQueue';
import '@/services/TelemetryManager';

LogBox.ignoreAllLogs();

// Cold-start clock: bundle eval to first root commit. The mark is module-level so Fast Refresh and
// re-renders never move it; emission still waits for the smoothness flag (async config fetch).
const BUNDLE_EVALLED_AT = performance.now();

function RuntimeApp() {
  const { live } = useAppRuntime();
  const light = isLightCanvas(live.theme.background);
  const smoothnessOn = live.layouts?.telemetrySmoothness === true;
  const appStartSent = useRef(false);
  useEffect(() => {
    if (smoothnessOn && !appStartSent.current) {
      appStartSent.current = true;
      telemetry.trackAppStart(performance.now() - BUNDLE_EVALLED_AT);
    }
  }, [smoothnessOn]);
  return (
    <>
      <SupportRuntimeObserver />
      <StatusBar style={light ? 'dark' : 'light'} />
      <View style={[styles.root, { backgroundColor: live.theme.background }]}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: live.theme.surface },
            headerShadowVisible: false,
            headerTintColor: live.theme.jade,
            headerTitleStyle: { fontWeight: '700', color: live.theme.text },
            contentStyle: { backgroundColor: live.theme.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(guest)" options={{ headerShown: false }} />
          <Stack.Screen name="(fan)" options={{ headerShown: false }} />
          <Stack.Screen name="(athlete)" options={{ headerShown: false }} />
          <Stack.Screen name="(parent)" options={{ headerShown: false }} />
          <Stack.Screen name="operator" options={{ headerShown: false }} />
          <Stack.Screen name="(booster)" options={{ headerShown: false }} />
          <Stack.Screen name="(sponsor)" options={{ headerShown: false }} />
          <Stack.Screen name="(admin)" options={{ headerShown: false }} />
          <Stack.Screen name="auth/callback" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="gift/[handle]" options={{ title: 'Share & Give ⚡' }} />
          <Stack.Screen name="school-confirm" options={{ title: 'Confirm athletes' }} />
          <Stack.Screen name="sport-quiz" options={{ headerShown: false }} />
          <Stack.Screen name="fan-zone" options={{ headerShown: false }} />
          {/* Dev-only QUIZ-04 demo page; the route itself redirects to Home in production builds. */}
          <Stack.Screen name="dev/trivia-preview" options={{ headerShown: false }} />
        </Stack>
        <StudioPreviewBar />
        <BackedCelebration />
        <AuraToast />
        <SoftWallModal />
        <AgeConfirmModal />
        <WelcomeOverlay />
      </View>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <AppRuntimeProvider>
        <SoftWallProvider>
        <CelebrationProvider>
          <UploadSheetProvider>
            <StripeProvider
              publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
              merchantIdentifier={APPLE_PAY_MERCHANT_ID}
            >
              <RuntimeApp />
            </StripeProvider>
          </UploadSheetProvider>
        </CelebrationProvider>
        </SoftWallProvider>
        </AppRuntimeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
