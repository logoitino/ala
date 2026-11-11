/** Google supports new and existing accounts; bank setup is separate and age rules remain with account confirmation. */
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
import { BirthMonthField, type BirthDraft } from '@/components/Auth/BirthMonthField';
import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { BrandMark } from '@/components/UI/BrandMark';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, KIT } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { COMPLIANCE_ACCOUNT } from '@/data/legal';
import { DEMO_FAN_EMAIL, DEMO_FAN_PASSWORD, demoFanSignInAvailable, signUpBirthProblem, softWallEmailGates, type BirthMonth } from '@/lib/auth';
import { AGE_GATE_REFUSAL, isAgeGatePaused, pauseAgeGate } from '@/lib/minors';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL, SPRING_CARD } from '@/theme/motion';
import { DISPLAY_TEXT, TYPE, figtree } from '@/theme/fonts';

const SHEET_TRAVEL = 480;

type AuthBusy = 'apple' | 'google' | 'magic' | 'demo' | 'password' | 'signup' | null;

/**
 * @purpose Account sheet for guest actions. Google and native Apple support existing/new accounts with post-auth age confirmation; email creation collects birth month/year here. Resumes the stashed action after sign-in and required age confirmation.
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
  const [birth, setBirth] = useState<BirthDraft>({ year: null, month: null });
  const [agePaused, setAgePaused] = useState(false);
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
      setBirth({ year: null, month: null });
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
      ? 'Use Google, or create an account with email and your birth month and year.'
      : intent?.kind === 'upload'
        ? 'An account is required to post a Highlight.'
        : intent?.kind === 'browse'
          ? 'Finish this Highlight, then create an account to keep swiping.'
          : intent?.kind === 'crew'
            ? 'Sign in to join The Crew.'
            : intent?.kind === 'wishlist'
              ? 'Sign in to give toward the gear they need.'
              : intent?.kind === 'exclusive'
                ? 'Sign in with one tap to unlock exclusive Vault clips.'
                : intent?.kind === 'signin'
                  ? Platform.OS === 'ios' ? 'Apple, Google, or email.' : 'Google or email.'
                  : 'Sign in to give toward their season.';
  const title = mode === 'create' ? 'Create an account' : 'Sign in';

  // Sign in is deliberately not age-gated; Create account and magic link are. See
  // `softWallEmailGates` for why.
  const birthValue: BirthMonth | null = birth.year && birth.month ? { year: birth.year, month: birth.month } : null;
  const gates = softWallEmailGates(email, password, birthValue);
  const canSignIn = gates.canSignIn;
  const canCreate = gates.canCreate && !agePaused;
  const canMagic = gates.canMagic && !agePaused;

  // An under-13 date: the same neutral line every time, and no more tries on this device for a day.
  const refuseUnder13 = async (): Promise<boolean> => {
    if (signUpBirthProblem(birthValue) !== AGE_GATE_REFUSAL) return false;
    await pauseAgeGate();
    setAgePaused(true);
    setError(AGE_GATE_REFUSAL);
    return true;
  };

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
        // Resume stays armed only while this sheet stays open; "Keep browsing" clears it.
        setMessage('Check your email for the magic link. Keep this open, or unlock again after you sign in.');
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
              <BrandMark size={28} />
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{body}</Text>

              <View style={styles.group}>
                {Platform.OS === 'ios' ? (
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
                ) : null}
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
                <Text style={styles.demoHint}>Google works for new and existing accounts.</Text>
                <View style={styles.reassure}>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.primary} />
                  <Text style={styles.reassureLabel}>No bank details are needed to create your profile.</Text>
                </View>
              </View>

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orLabel}>or email</Text>
                <View style={styles.orLine} />
              </View>

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
                    <BirthMonthField value={birth} onChange={setBirth} disabled={Boolean(busy) || agePaused} />
                    <Text style={styles.demoHint}>{COMPLIANCE_ACCOUNT}</Text>
                    <AnimatedButton
                      accessibilityLabel="Create an account with email and password"
                      disabled={Boolean(busy) || !canCreate}
                      haptic="medium"
                      onPress={() => void (async () => {
                        if (!birthValue || (await refuseUnder13())) return;
                        await run('signup', async () => {
                          const signedIn = await signUpWithEmailPassword(email, password, birthValue);
                          if (!signedIn) {
                            setMessage('Account created. Confirm the email, then sign in.');
                          }
                        });
                      })()}
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
                      onPress={() => void (async () => {
                        if (!birthValue || (await refuseUnder13())) return;
                        await run('magic', () => signInWithMagicLink(email, birthValue));
                      })()}
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
                  if (mode !== 'create') {
                    void isAgeGatePaused().then((paused) => {
                      setAgePaused(paused);
                      if (paused) setError(AGE_GATE_REFUSAL);
                    });
                  }
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
    borderTopLeftRadius: KIT.sheetRadius,
    borderTopRightRadius: KIT.sheetRadius,
  },
  sheetInner: {
    gap: 12,
    paddingBottom: 8,
  },
  group: {
    gap: 10,
  },
  title: {
    ...DISPLAY_TEXT,
    ...TYPE.display,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...TYPE.body,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 2,
  },
  providerBtn: {
    borderRadius: KIT.controlRadius,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  appleBtn: { backgroundColor: colors.night },
  appleLabel: { ...figtree('700'), color: '#FFFFFF', fontSize: 16 },
  demoBtn: { backgroundColor: FOCAL.goldInk },
  demoLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  demoHint: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  reassure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reassureLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  googleBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleLabel: { ...figtree('700'), color: colors.text, fontSize: 16 },
  magicBtn: { backgroundColor: colors.primary, ...KIT.shadowSoft },
  magicLabel: { ...figtree('700'), color: '#FFFFFF', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: colors.accentSoft,
  },
  secondaryLabel: { ...figtree('700'), color: colors.primary, fontSize: 16 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: KIT.controlRadius,
    paddingHorizontal: 16,
    minHeight: 50,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.background,
  },
  message: { color: colors.primary, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  // emberInk, not the bright ember: error text must clear 4.5:1 on the white sheet.
  error: { color: colors.danger, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  close: { alignItems: 'center', paddingVertical: 6, minHeight: 44, justifyContent: 'center' },
  closeLabel: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  linkLabel: { fontSize: 15, fontWeight: '800', color: colors.primary },
  disabled: { opacity: 0.45 },
});
