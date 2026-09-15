import { useEffect, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { HapticPressable as Pressable } from '@/components/UI/HapticPressable';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useSoftWall } from '@/context/SoftWallContext';
import { DEMO_FAN_EMAIL } from '@/lib/auth';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';

type AuthBusy = 'apple' | 'google' | 'magic' | 'demo' | 'password' | null;

/**
 * @purpose High-impact auth sheet when a guest hits Mālo / Crew / Chip In. Resumes the stashed action after sign-in.
 * @sideEffects Email/password, Apple / Google / Magic Link / Demo Fan via AuthContext; telemetry `auth.*`.
 */
export function SoftWallModal() {
  const insets = useSafeAreaInsets();
  const { visible, intent, close } = useSoftWall();
  const {
    signInWithApple,
    signInWithGoogle,
    signInWithMagicLink,
    signInWithEmailPassword,
    signInWithDemoAccount,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<AuthBusy>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setEmail('');
      setPassword('');
      setBusy(null);
      setMessage(null);
      setError(null);
    }
  }, [visible]);

  const athlete = intent?.athleteName?.trim();
  const body =
    intent?.kind === 'crew'
      ? 'Sign in with one tap to join The Crew ⚡ and stay close to the season.'
      : intent?.kind === 'wishlist'
        ? 'Sign in with one tap to Chip In and help fund the gear they need.'
        : intent?.kind === 'signin'
          ? 'Use email + password, Demo Fan, Apple, Google, or a Magic Link — then tip Mālo, join Crew, and Chip In.'
          : 'Sign in with one tap to drop a Mālo tip and power their season.';
  const title =
    intent?.kind === 'signin'
      ? "Sign in to Tapua'i"
      : athlete
        ? `Support ${athlete}'s Journey!`
        : 'Support their Journey!';

  const canPassword = Boolean(email.trim() && password);
  const canMagic = Boolean(email.trim());

  const run = async (kind: Exclude<AuthBusy, null>, work: () => Promise<void>) => {
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
      setBusy(null);
    }
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdropWrap}
      >
        <Pressable haptic="none" style={styles.backdrop} onPress={busy ? undefined : close}>
          <BlurView intensity={48} tint="dark" pointerEvents="none" style={styles.blur} />
          <Pressable
            haptic="none"
            style={[styles.sheet, { paddingBottom: 16 + insets.bottom, maxHeight: '92%' }]}
            onPress={() => undefined}
          >
            <View style={styles.handle} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetInner}
            >
              <Text style={styles.kicker}>Tapua&apos;i</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{body}</Text>

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
                  if (canPassword) {
                    void run('password', () => signInWithEmailPassword(email, password));
                  }
                }}
              />
              <AnimatedButton
                accessibilityLabel="Sign in with email and password"
                disabled={Boolean(busy) || !canPassword}
                haptic="medium"
                onPress={() => void run('password', () => signInWithEmailPassword(email, password))}
                contentStyle={[styles.providerBtn, styles.magicBtn, (busy || !canPassword) && styles.disabled]}
              >
                {busy === 'password' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.magicLabel}>Sign in</Text>
                )}
              </AnimatedButton>
              <Text style={styles.demoHint}>
                Demo Fan: {DEMO_FAN_EMAIL} · or tap Continue as Demo Fan below
              </Text>

              <AnimatedButton
                accessibilityLabel="Send magic link email"
                disabled={Boolean(busy) || !canMagic}
                haptic="selection"
                onPress={() => void run('magic', () => signInWithMagicLink(email))}
                contentStyle={[styles.providerBtn, styles.secondaryBtn, (busy || !canMagic) && styles.disabled]}
              >
                {busy === 'magic' ? (
                  <ActivityIndicator color={FOCAL.jadeInk} />
                ) : (
                  <Text style={styles.secondaryLabel}>Send Magic Link instead</Text>
                )}
              </AnimatedButton>

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orLabel}>or</Text>
                <View style={styles.orLine} />
              </View>

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

              {message ? <Text style={styles.message}>{message}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={close} style={styles.close}>
                <Text style={styles.closeLabel}>Keep browsing</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1 },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,20,22,0.35)',
  },
  blur: { ...StyleSheet.absoluteFill },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetInner: {
    gap: 12,
    paddingBottom: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
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
  demoHint: {
    marginTop: -4,
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
