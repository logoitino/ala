import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
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

/**
 * @purpose High-impact Daylight auth sheet when a guest hits Mālo / Crew / Chip In / exclusive Vault. Resumes the stashed action after sign-in.
 * @sideEffects Apple / Google / Magic Link / Demo Fan via AuthContext; telemetry `auth.*`.
 */
export function SoftWallModal() {
  const insets = useSafeAreaInsets();
  const { visible, intent, close } = useSoftWall();
  const { signInWithApple, signInWithGoogle, signInWithMagicLink, signInWithDemoAccount } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'apple' | 'google' | 'magic' | 'demo' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setEmail('');
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
        : intent?.kind === 'exclusive'
          ? 'Sign in with one tap to unlock exclusive Vault clips and power their season.'
          : intent?.kind === 'signin'
            ? 'Sign in with one tap to tip Mālo, join Crew, and Chip In — or continue as Demo Fan for QA.'
            : 'Sign in with one tap to drop a Mālo tip and power their season.';
  const title =
    intent?.kind === 'signin'
      ? "Sign in to Tapua'i"
      : athlete
        ? `Support ${athlete}'s Journey!`
        : 'Support their Journey!';

  const run = async (
    kind: 'apple' | 'google' | 'magic' | 'demo',
    work: () => Promise<void>,
  ) => {
    setBusy(kind);
    setError(null);
    setMessage(null);
    telemetry.trackFeature(
      kind === 'magic'
        ? 'auth.magic_link'
        : kind === 'apple'
          ? 'auth.apple'
          : kind === 'google'
            ? 'auth.google'
            : 'auth.demo',
      'auth',
    );
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
          <BlurView intensity={36} tint="light" pointerEvents="none" style={styles.blur} />
          <Pressable
            haptic="none"
            style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}
            onPress={() => undefined}
          >
            <View style={styles.handle} />
            <View style={styles.hero}>
              <Text style={styles.kicker}>Tapua&apos;i</Text>
              <Text style={styles.title}>{title}</Text>
              <View style={styles.goldRule} />
              <Text style={styles.subtitle}>{body}</Text>
            </View>

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

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orLabel}>or</Text>
              <View style={styles.orLine} />
            </View>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@family.com"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              editable={!busy}
            />
            <AnimatedButton
              accessibilityLabel="Send magic link email"
              disabled={Boolean(busy) || !email.trim()}
              haptic="medium"
              onPress={() => void run('magic', () => signInWithMagicLink(email))}
              contentStyle={[styles.providerBtn, styles.magicBtn, (busy || !email.trim()) && styles.disabled]}
            >
              {busy === 'magic' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.magicLabel}>Send Magic Link Email</Text>
              )}
            </AnimatedButton>

            {message ? <Text style={styles.message}>{message}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <AnimatedButton
              accessibilityLabel="Continue as Demo Fan"
              disabled={Boolean(busy)}
              haptic="medium"
              onPress={() => void run('demo', signInWithDemoAccount)}
              contentStyle={[styles.providerBtn, styles.demoBtn, busy && styles.disabled]}
            >
              {busy === 'demo' ? (
                <ActivityIndicator color={FOCAL.goldInk} />
              ) : (
                <Text style={styles.demoLabel}>Continue as Demo Fan</Text>
              )}
            </AnimatedButton>
            <Text style={styles.demoHint}>{DEMO_FAN_EMAIL} · instant session for QA</Text>

            <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={close} style={styles.close}>
              <Text style={styles.closeLabel}>Keep browsing</Text>
            </Pressable>
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
    backgroundColor: 'rgba(243,250,246,0.42)',
  },
  blur: { ...StyleSheet.absoluteFill },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 3,
    borderTopColor: FOCAL.electricGold,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: FOCAL.electricGold,
    marginBottom: 4,
  },
  hero: {
    backgroundColor: FOCAL.mistGold,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
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
  goldRule: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: FOCAL.electricGold,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.textMuted,
  },
  providerBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  appleBtn: { backgroundColor: FOCAL.ink },
  appleLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  googleBtn: {
    backgroundColor: FOCAL.mistSlate,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleLabel: { color: colors.text, fontSize: 16, fontWeight: '800' },
  magicBtn: { backgroundColor: FOCAL.jadeInk },
  magicLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  demoBtn: {
    backgroundColor: FOCAL.mistGold,
    borderWidth: 1,
    borderColor: FOCAL.electricGold,
  },
  demoLabel: { color: FOCAL.goldInk, fontSize: 16, fontWeight: '800' },
  demoHint: {
    marginTop: -6,
    marginBottom: 2,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
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
    backgroundColor: FOCAL.mistJade,
  },
  message: { color: FOCAL.jadeInk, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  error: { color: FOCAL.ember, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  close: { alignItems: 'center', paddingVertical: 10 },
  closeLabel: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  disabled: { opacity: 0.55 },
});
