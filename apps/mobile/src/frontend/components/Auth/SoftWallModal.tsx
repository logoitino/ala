import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSheetFrame, SHEET_BLUR_INTENSITY } from '@/hooks/useSheetFrame';

import { SheetHandle } from '@/components/UI/SheetHandle';
import { LegalAckToggle } from '@/components/Legal/LegalModal';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { COMPLIANCE_ACCOUNT } from '@/data/legal';
import { DEMO_FAN_EMAIL, softWallEmailGates } from '@/lib/auth';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL, SPRING_CARD } from '@/theme/motion';

const AGE_GATE_LABEL = 'I confirm I am 13 years of age or older.';
const SHEET_TRAVEL = 480;

type AuthBusy = 'apple' | 'google' | 'magic' | 'demo' | 'password' | 'signup' | null;

/**
 * @purpose High-impact auth sheet when a guest hits Donate / Crew / a gear goal. Resumes the stashed action after sign-in.
 * @sideEffects Email/password, Apple / Google / Magic Link / Demo Fan via AuthContext; telemetry `auth.*`.
 */
export function SoftWallModal() {
  const frame = useSheetFrame();
  const { visible, intent, close, presentId } = useSoftWall();
  const {
    signInWithApple,
    signInWithGoogle,
    signInWithMagicLink,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signInWithDemoAccount,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [busy, setBusy] = useState<AuthBusy>(null);
  // `disabled={busy}` only lands on the next render; this blocks a second tap in the same frame.
  const running = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const wasVisible = useRef(false);
  const translateY = useSharedValue(SHEET_TRAVEL);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      setEmail('');
      setPassword('');
      setAgeConfirmed(false);
      setBusy(null);
      setMessage(null);
      setError(null);
    }
  }, [visible]);

  // Mirrors ProfileMenuSheet's slide-up spring, but also has to animate closed when
  // SoftWallContext clears itself the instant a session lands (see close() callers in
  // SoftWallContext) — not just when the fan taps "Keep browsing" — so we track the prior
  // visibility in a ref instead of relying on a manual dismiss() being the only way out.
  useEffect(() => {
    if (visible) {
      wasVisible.current = true;
      setOpen(true);
      translateY.value = withSpring(0, SPRING_CARD);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else if (wasVisible.current) {
      wasVisible.current = false;
      translateY.value = withTiming(SHEET_TRAVEL, { duration: 180 });
      backdropOpacity.value = withTiming(0, { duration: 160 });
      const timer = setTimeout(() => setOpen(false), 180);
      return () => clearTimeout(timer);
    }
  }, [visible, backdropOpacity, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!open && !visible) return null;

  const dismiss = () => {
    if (busy) return;
    close();
  };

  const athlete = intent?.athleteName?.trim();
  const body =
    intent?.kind === 'crew'
      ? 'Sign in with one tap to join The Crew ⚡ and stay close to the season.'
      : intent?.kind === 'wishlist'
        ? 'Sign in with one tap to donate toward the gear they need.'
        : intent?.kind === 'signin'
          ? 'Use email + password, Demo Fan, Apple, Google, or a Magic Link — then donate, join Crew, and give toward gear goals.'
          : 'Sign in with one tap to donate toward their season.';
  const title =
    intent?.kind === 'signin'
      ? "Sign in to Tapua'i"
      : athlete
        ? `Support ${athlete}'s Journey!`
        : 'Support their Journey!';

  // Sign in is deliberately not age-gated; Create account and magic link are. See
  // `softWallEmailGates` for why.
  const { canSignIn, canCreate, canMagic } = softWallEmailGates(email, password, ageConfirmed);

  const run = async (kind: Exclude<AuthBusy, null>, work: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(kind);
    setError(null);
    setMessage(null);
    const telemetryId =
      kind === 'magic'
        ? 'auth.magic_link'
        : kind === 'apple'
          ? 'auth.apple'
          : kind === 'google'
            ? 'auth.google'
            : kind === 'password'
              ? 'auth.password'
              : kind === 'signup'
                ? 'auth.signup'
                : 'auth.demo';
    telemetry.trackFeature(telemetryId, 'auth');
    try {
      await work();
      if (kind === 'magic') {
        setMessage('Check your email for the magic link. We will pick up right where you left off.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.');
    } finally {
      running.current = false;
      setBusy(null);
    }
  };

  return (
    <Modal
      key={presentId}
      animationType="none"
      transparent
      visible={visible || open}
      onRequestClose={dismiss}
      onDismiss={() => setOpen(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.page}
      >
        <View style={styles.root}>
          <Pressable haptic="none" style={styles.backdrop} onPress={busy ? undefined : dismiss}>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, backdropStyle]}>
              <BlurView intensity={SHEET_BLUR_INTENSITY} tint="dark" style={StyleSheet.absoluteFill} />
            </Animated.View>
          </Pressable>
          <View pointerEvents="box-none" style={frame.dock}>
          <Animated.View style={[styles.sheet, frame.card, { maxHeight: '92%' }, sheetStyle]}>
            <SheetHandle />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetInner}
            >
              <Text style={styles.kicker}>Tapua&apos;i</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{body}</Text>

              {/* Growth rule (owner, 2026-09-29): one-tap sign-in first. Apple / Google skip typing a
                  password; the COPPA age question follows as one tap (AgeConfirmModal). */}
              <View style={styles.group}>
                <AnimatedButton
                  accessibilityLabel="Continue with Apple"
                  disabled={Boolean(busy)}
                  haptic="medium"
                  onPress={() => void run('apple', signInWithApple)}
                  contentStyle={[styles.providerBtn, styles.appleBtn, busy && styles.disabled]}
                >
                  {busy === 'apple' ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.appleLabel}>Continue with Apple</Text>
                  )}
                </AnimatedButton>

                <AnimatedButton
                  accessibilityLabel="Continue with Google"
                  disabled={Boolean(busy)}
                  haptic="medium"
                  onPress={() => void run('google', signInWithGoogle)}
                  contentStyle={[styles.providerBtn, styles.googleBtn, busy && styles.disabled]}
                >
                  {busy === 'google' ? (
                    <ActivityIndicator color={FOCAL.ink} />
                  ) : (
                    <Text style={styles.googleLabel}>Continue with Google</Text>
                  )}
                </AnimatedButton>
              </View>

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orLabel}>or use email</Text>
                <View style={styles.orLine} />
              </View>

              <View style={styles.group}>
                <Text style={styles.sectionLabel}>Email & password</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="you@family.com"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  editable={!busy}
                />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  editable={!busy}
                  onSubmitEditing={() => {
                    if (canSignIn) {
                      void run('password', () => signInWithEmailPassword(email, password, ageConfirmed));
                    }
                  }}
                />
                <LegalAckToggle
                  checked={ageConfirmed}
                  onCheckedChange={setAgeConfirmed}
                  disabled={Boolean(busy)}
                  label={AGE_GATE_LABEL}
                />
                <Text style={styles.demoHint}>{COMPLIANCE_ACCOUNT}</Text>
                <AnimatedButton
                  accessibilityLabel="Sign in with email and password"
                  disabled={Boolean(busy) || !canSignIn}
                  haptic="medium"
                  onPress={() => void run('password', () => signInWithEmailPassword(email, password, ageConfirmed))}
                  contentStyle={[styles.providerBtn, styles.magicBtn, (busy || !canSignIn) && styles.disabled]}
                >
                  {busy === 'password' ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.magicLabel}>Sign in</Text>
                  )}
                </AnimatedButton>
                <AnimatedButton
                  accessibilityLabel="Create an account with email and password"
                  disabled={Boolean(busy) || !canCreate}
                  haptic="medium"
                  onPress={() =>
                    void run('signup', async () => {
                      const signedIn = await signUpWithEmailPassword(email, password, ageConfirmed);
                      if (!signedIn) {
                        setMessage('Account created. Confirm the email, then sign in.');
                      }
                    })
                  }
                  contentStyle={[
                    styles.providerBtn,
                    styles.secondaryBtn,
                    (busy || !canCreate) && styles.disabled,
                  ]}
                >
                  {busy === 'signup' ? (
                    <ActivityIndicator color={FOCAL.jadeInk} />
                  ) : (
                    <Text style={styles.secondaryLabel}>Create account</Text>
                  )}
                </AnimatedButton>
              </View>

              <AnimatedButton
                accessibilityLabel="Send magic link email"
                disabled={Boolean(busy) || !canMagic}
                haptic="selection"
                onPress={() => void run('magic', () => signInWithMagicLink(email, ageConfirmed))}
                contentStyle={[styles.providerBtn, styles.secondaryBtn, (busy || !canMagic) && styles.disabled]}
              >
                {busy === 'magic' ? (
                  <ActivityIndicator color={FOCAL.jadeInk} />
                ) : (
                  <Text style={styles.secondaryLabel}>Send Magic Link instead</Text>
                )}
              </AnimatedButton>

              {/* 2026-09 audit (Round 11 sweep): this signs into (or, on first use, auto-creates)
                  a single shared account with a hardcoded password checked into the repo and
                  .env.example — fine for internal QA on a throwaway project, but with no gate at
                  all this button shipped to every real user in a production build too, meaning
                  anyone who reads this open codebase could sign into a real, shared fan session in
                  the live app. `__DEV__` is true in Expo Go and a development-client build, and false
                  in preview and production release builds, so the EAS preview install has no Demo Fan
                  button. That matches the intent — QA convenience, never a real end-user sign-in. */}
              {__DEV__ ? (
                <View style={styles.demoGroup}>
                  <Text style={styles.demoHint}>
                    Just exploring? Continue as Demo Fan — {DEMO_FAN_EMAIL}
                  </Text>
                  <AnimatedButton
                    accessibilityLabel="Continue as Demo Fan"
                    disabled={Boolean(busy)}
                    haptic="medium"
                    onPress={() => void run('demo', signInWithDemoAccount)}
                    contentStyle={[styles.providerBtn, styles.demoBtn, busy && styles.disabled]}
                  >
                    {busy === 'demo' ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.demoLabel}>Continue as Demo Fan</Text>
                    )}
                  </AnimatedButton>
                </View>
              ) : null}

              {message ? <Text style={styles.message}>{message}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={dismiss} style={styles.close}>
                <Text style={styles.closeLabel}>Keep browsing</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15,20,22,0.35)',
  },
  sheet: {
    backgroundColor: colors.surface,
  },
  sheetInner: {
    gap: 12,
    paddingBottom: 8,
  },
  group: {
    gap: 10,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: FOCAL.goldInk,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: FOCAL.jadeInk,
  },
  providerBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  appleBtn: { backgroundColor: '#0F1416' },
  appleLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  demoBtn: { backgroundColor: FOCAL.goldInk },
  demoLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  demoGroup: {
    gap: 8,
    marginTop: 2,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  demoHint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  googleBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleLabel: { color: colors.text, fontSize: 16, fontWeight: '800' },
  magicBtn: { backgroundColor: FOCAL.jadeInk },
  magicLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: FOCAL.jadeInk,
  },
  secondaryLabel: { color: FOCAL.jadeInk, fontSize: 15, fontWeight: '800' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.background,
  },
  message: { color: FOCAL.jadeInk, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  error: { color: FOCAL.ember, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  close: { alignItems: 'center', paddingVertical: 10 },
  closeLabel: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  disabled: { opacity: 0.55 },
});
