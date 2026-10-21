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
// Reanimated 4 boots react-native-worklets on import, which reads a TurboModule
// that does not exist under Node — and its own shipped `mock.js` re-imports the
// real entry point, so it crashes the same way. This stub covers exactly the
// Reanimated surface this app imports. Animations resolve instantly to their
// target value, which is what a logic-level test wants anyway.
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, Text, Image, FlatList } = require('react-native');
  const identity = (value) => value;
  const passthrough = { View, ScrollView, Text, Image, FlatList, createAnimatedComponent: (c) => c };

  return {
    __esModule: true,
    default: passthrough,
    ...passthrough,
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (factory) => {
      try {
        return factory();
      } catch {
        return {};
      }
    },
    useAnimatedScrollHandler: () => jest.fn(),
    useAnimatedReaction: () => undefined,
    useReducedMotion: () => false,
    withSpring: identity,
    withTiming: identity,
    withDelay: (_delay, value) => value,
    withRepeat: identity,
    withSequence: (...values) => values[values.length - 1],
    cancelAnimation: jest.fn(),
    runOnJS: (fn) => fn,
    interpolate: (value) => value,
    interpolateColor: () => 'transparent',
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    Easing: new Proxy({}, { get: () => identity }),
    FadeIn: {}, FadeInDown: {}, FadeInUp: {}, FadeOut: {}, FadeOutUp: {},
  };
});

jest.mock('expo-crypto', () => ({}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'alasports://auth/callback') }));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-linking', () => ({}));

// SDK 58: icon fonts reach expo-asset through a registry Jest never fills, so the first
// Ionicons mount throws "Module 1 is missing from the asset registry". Fonts count as loaded.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  isLoaded: () => true,
  loadAsync: () => Promise.resolve(),
}));
