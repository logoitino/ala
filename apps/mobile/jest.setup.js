// Shared Jest setup for @tapuai/mobile. Mocks native modules that have no
// implementation under Node (Jest never runs on a real device/simulator).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Dummy Supabase env so importing lib/supabase.ts in a test doesn't warn or
// try to reach a real project — no test in this suite should ever hit the network.
process.env.EXPO_PUBLIC_SUPABASE_URL ||= 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';

// These Expo native modules pull in real native/TurboModule classes that don't
// resolve under Jest's Node environment (no device/simulator backing them).
// lib/auth.ts imports them for OAuth helpers that aren't exercised by pure-logic
// tests (e.g. isNewAuthUser) — stub them so importing the module doesn't crash.
jest.mock('expo-crypto', () => ({}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'alasports://auth/callback') }));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-linking', () => ({}));
