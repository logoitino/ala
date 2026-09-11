import { LogBox, StyleSheet, View } from 'react-native';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackedCelebration } from '@/components/BackedCelebration';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { AuthProvider } from '@/context/AuthContext';
import { CelebrationProvider } from '@/context/CelebrationContext';
import { colors } from '@/constants/theme';

LogBox.ignoreAllLogs();

export default function RootLayout() {
  return (
    <AuthProvider>
      <CelebrationProvider>
        <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}>
          <StatusBar style="dark" />
          <View style={styles.root}>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.surface },
                headerShadowVisible: false,
                headerTintColor: colors.primary,
                headerTitleStyle: { fontWeight: '700', color: colors.text },
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(guest)" options={{ headerShown: false }} />
              <Stack.Screen name="(fan)" options={{ headerShown: false }} />
              <Stack.Screen name="(athlete)" options={{ headerShown: false }} />
              <Stack.Screen name="(parent)" options={{ headerShown: false }} />
              <Stack.Screen name="(operator)" options={{ headerShown: false }} />
              <Stack.Screen name="(booster)" options={{ headerShown: false }} />
              <Stack.Screen name="(sponsor)" options={{ headerShown: false }} />
              <Stack.Screen name="(admin)" options={{ headerShown: false }} />
            </Stack>
            <SafeAreaView edges={['bottom']} style={styles.switcher}>
              <RoleSwitcher />
            </SafeAreaView>
            <BackedCelebration />
          </View>
        </StripeProvider>
      </CelebrationProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  switcher: {
    backgroundColor: colors.surface,
  },
});
