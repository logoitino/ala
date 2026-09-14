import 'react-native-gesture-handler';
import { LogBox, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuraToast } from '@/components/AuraToast';
import { BackedCelebration } from '@/components/BackedCelebration';
import { StudioPreviewBar } from '@/components/Admin/StudioPreviewBar';
import { AuthProvider } from '@/context/AuthContext';
import { AppRuntimeProvider } from '@/context/AppRuntimeContext';
import { CelebrationProvider } from '@/context/CelebrationContext';
import { UploadSheetProvider } from '@/context/UploadSheetContext';
import { colors } from '@/constants/theme';
import { StripeProvider } from '@/lib/stripe';
import '@/services/OfflineQueue';
import '@/services/TelemetryManager';

LogBox.ignoreAllLogs();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <AppRuntimeProvider>
        <CelebrationProvider>
          <UploadSheetProvider>
            <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}>
              <StatusBar style="light" />
              <View style={styles.root}>
                <Stack
                  screenOptions={{
                    headerStyle: { backgroundColor: colors.surface },
                    headerShadowVisible: false,
                    headerTintColor: colors.accent,
                    headerTitleStyle: { fontWeight: '700', color: colors.text },
                    contentStyle: { backgroundColor: colors.background },
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
                </Stack>
                <StudioPreviewBar />
                <BackedCelebration />
                <AuraToast />
              </View>
            </StripeProvider>
          </UploadSheetProvider>
        </CelebrationProvider>
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
