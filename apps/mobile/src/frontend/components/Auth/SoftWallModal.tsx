/** Fan menu presentation uses shared Daylight chrome; feature data and confirmation rules stay with the parent. */
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

import { MenuBackdrop } from '@/components/UI/MenuChrome';
import { SheetHandle } from '@/components/UI/SheetHandle';
import { LegalAckToggle } from '@/components/Legal/LegalModal';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { COMPLIANCE_ACCOUNT } from '@/data/legal';
import { DEMO_FAN_EMAIL, DEMO_FAN_PASSWORD, demoFanSignInAvailable, softWallEmailGates } from '@/lib/auth';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL, SPRING_CARD } from '@/theme/motion';

const AGE_GATE_LABEL = 'I confirm I am 13 years of age or older.';
const SHEET_TRAVEL = 480;

type AuthBusy = 'apple' | 'google' | 'magic' | 'demo' | 'password' | 'signup' | null;

/**
 * @purpose Account sheet when a guest uploads, keeps swiping Highlights, donates, joins Crew, or starts a gear goal. Sign-in stays Apple, Google, email, and password. Creating an account is a second step and is where the 13+ confirmation lives. Resumes the stashed action after sign-in.
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
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
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
      setMode('signin');
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

  const body =
    mode === 'create'
      ? 'Use your email. Confirm you are 13 or older.'
      : intent?.kind === 'upload'
        ? 'An account is required to post a Highlight.'
        : intent?.kind === 'browse'
          ? 'Finish this Highlight, then create an account to keep swiping.'
          : intent?.kind === 'crew'
            ? 'Sign in to join The Crew.'
            : intent?.kind === 'wishlist'
              ? 'Sign in to donate toward the gear they need.'
              : intent?.kind === 'signin'
                ? 'Apple, Google, or email.'
                : 'Sign in to donate toward their season.';
  const title = mode === 'create' ? 'Create an account' : 'Sign in';

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
            <MenuBackdrop accent="jade" />
          <SheetHandle onDismiss={busy ? undefined : dismiss} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetInner}
            >
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{body}</Text>

              {mode === 'signin' ? (
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
              ) : null}

              {mode === 'signin' ? (
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orLabel}>or email</Text>
                  <View style={styles.orLine} />
                </View>
              ) : null}

              <View style={styles.group}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="Email"
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
                    if (mode === 'signin' && canSignIn) {
                      void run('password', () => signInWithEmailPassword(email, password));
                    }
                  }}
                />
                {mode === 'create' ? (
                  <>
                    <LegalAckToggle
                      checked={ageConfirmed}
                      onCheckedChange={setAgeConfirmed}
                      disabled={Boolean(busy)}
                      label={AGE_GATE_LABEL}
                    />
                    <Text style={styles.demoHint}>{COMPLIANCE_ACCOUNT}</Text>
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
                        styles.magicBtn,
                        (busy || !canCreate) && styles.disabled,
                      ]}
                    >
                      {busy === 'signup' ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.magicLabel}>Create account</Text>
                      )}
                    </AnimatedButton>
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
                        <Text style={styles.secondaryLabel}>Email me a link instead</Text>
                      )}
                    </AnimatedButton>
                  </>
                ) : (
                  <AnimatedButton
                    accessibilityLabel="Sign in with email and password"
                    disabled={Boolean(busy) || !canSignIn}
                    haptic="medium"
                    onPress={() => void run('password', () => signInWithEmailPassword(email, password))}
                    contentStyle={[styles.providerBtn, styles.magicBtn, (busy || !canSignIn) && styles.disabled]}
                  >
                    {busy === 'password' ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.magicLabel}>Sign in</Text>
                    )}
                  </AnimatedButton>
                )}
              </View>

              {mode === 'signin' && demoFanSignInAvailable() ? (
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
                    <Text style={styles.demoLabel}>Use test account</Text>
                  )}
                </AnimatedButton>
              ) : null}
              {mode === 'signin' && demoFanSignInAvailable() ? (
                <Text style={styles.demoHint}>
                  {DEMO_FAN_EMAIL} · {DEMO_FAN_PASSWORD}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={mode === 'create' ? 'Already have an account? Sign in' : 'Create an account'}
                disabled={Boolean(busy)}
                onPress={() => {
                  setError(null);
                  setMessage(null);
                  setMode(mode === 'create' ? 'signin' : 'create');
                }}
                style={styles.close}
              >
                <Text style={styles.linkLabel}>
                  {mode === 'create' ? 'Already have an account? Sign in' : 'Create an account'}
                </Text>
              </Pressable>

              {message ? <Text style={styles.message}>{message}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={dismiss} style={styles.close}>
                <Text style={styles.closeLabel}>{intent?.kind === 'browse' ? 'Finish this Highlight' : 'Not now'}</Text>
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
    gap: 8,
    paddingBottom: 4,
  },
  group: {
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: colors.textMuted,
  },
  providerBtn: {
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  appleBtn: { backgroundColor: '#0F1416' },
  appleLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  demoBtn: { backgroundColor: FOCAL.goldInk },
  demoLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
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
  googleLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  magicBtn: { backgroundColor: FOCAL.jadeInk },
  magicLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: FOCAL.jadeInk,
  },
  secondaryLabel: { color: FOCAL.jadeInk, fontSize: 14, fontWeight: '800' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.background,
  },
  message: { color: FOCAL.jadeInk, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  error: { color: FOCAL.ember, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  close: { alignItems: 'center', paddingVertical: 6, minHeight: 44, justifyContent: 'center' },
  closeLabel: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  linkLabel: { fontSize: 14, fontWeight: '800', color: FOCAL.jadeInk },
  disabled: { opacity: 0.55 },
});
