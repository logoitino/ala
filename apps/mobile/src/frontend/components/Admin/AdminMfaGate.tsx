/**
 * SCALE-01 second sign-in step for Expo `/admin`. `AdminShell` mounts this only while
 * `EXPO_PUBLIC_ADMIN_REQUIRE_MFA` is on; desk children render only for an `aal2` session. Otherwise the admin
 * sets up an authenticator app once, or enters its code. Same look as `AccessRestricted`.
 * @sideEffects Supabase Auth TOTP calls through `lib/adminMfa.ts`; sign out through `AuthContext`.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { AnimatedButton } from '@/components/UI/AnimatedButton';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  mfaErrorText,
  normalizeTotpCode,
  readAdminMfaState,
  startAdminTotpSetup,
  verifyAdminTotpCode,
  type AdminMfaState,
  type AdminTotpSetup,
} from '@/lib/adminMfa';
import { FOCAL } from '@/theme/motion';

/**
 * @purpose Hold desk children back until the session is `aal2`. Re-reads whenever the access token changes, so a
 *   verified code (new session) opens the desk without a reload.
 */
export function AdminMfaGate({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const token = session?.access_token ?? null;
  const [state, setState] = useState<AdminMfaState | null>(null);
  const [setup, setSetup] = useState<AdminTotpSetup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'setup' | 'verify' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const codeRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    let live = true;
    setState(null);
    readAdminMfaState(token)
      .then((next) => {
        if (live) setState(next);
      })
      .catch((caught: unknown) => {
        if (!live) return;
        // Unknown means refused, never open.
        setState({ step: 'verify', factorId: null });
        setFailure(mfaErrorText(caught));
      });
    return () => {
      live = false;
    };
  }, [token]);

  const beginSetup = useCallback(async () => {
    setBusy('setup');
    setFailure(null);
    try {
      setSetup(await startAdminTotpSetup());
    } catch (caught) {
      setFailure(mfaErrorText(caught));
    } finally {
      setBusy(null);
    }
  }, []);

  const factorId = setup?.factorId ?? state?.factorId ?? null;

  const submit = useCallback(async () => {
    const digits = normalizeTotpCode(code);
    if (!digits) {
      setFailure('Enter the 6 digits from your authenticator app.');
      codeRef.current?.focus();
      return;
    }
    if (!factorId) return;
    setBusy('verify');
    setFailure(null);
    try {
      await verifyAdminTotpCode(factorId, digits);
      // The new aal2 session reaches AuthContext through onAuthStateChange; the token effect above re-reads.
      setCode('');
    } catch (caught) {
      setFailure(mfaErrorText(caught));
      setCode('');
      codeRef.current?.focus();
    } finally {
      setBusy(null);
    }
  }, [code, factorId]);

  if (!state) {
    return <View style={styles.wrap}><ActivityIndicator color={FOCAL.jadeInk} accessibilityLabel="Checking two-step sign-in" /></View>;
  }
  if (state.step === 'off' || state.step === 'pass') return <>{children}</>;

  const enrolling = state.step === 'enroll';
  const noAccount = !token;
  const showCode = !noAccount && (enrolling ? Boolean(setup) : Boolean(factorId));

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>Tapua&apos;i Admin</Text>
      <Text style={styles.title} accessibilityRole="header">Two-step sign-in</Text>
      <Text style={styles.body}>
        {noAccount
          ? 'Admin desks need a signed-in admin account with an authenticator app. Studio unlock does not open them.'
          : enrolling
            ? 'Admin desks need a second step. Set up an authenticator app once, then enter its code each time you sign in.'
            : 'Enter the 6-digit code from your authenticator app.'}
      </Text>

      {enrolling && !noAccount && !setup ? (
        <AnimatedButton
          haptic="medium"
          accessibilityLabel="Set up an authenticator app"
          contentStyle={styles.cta}
          disabled={busy !== null}
          onPress={() => void beginSetup()}
        >
          <Text style={styles.ctaLabel}>{busy === 'setup' ? 'Starting setup…' : 'Set up an authenticator app'}</Text>
        </AnimatedButton>
      ) : null}

      {setup ? (
        <View style={styles.setup}>
          <Text style={styles.step}>1. Scan this code with your authenticator app.</Text>
          <View
            style={styles.qr}
            accessible
            accessibilityRole="image"
            accessibilityLabel="QR code that adds Tapua'i Admin to your authenticator app"
          >
            <SvgXml xml={setup.qrSvg} width={176} height={176} />
          </View>
          <Text style={styles.hint}>Cannot scan it? Type this setup key into the app instead.</Text>
          <Text style={styles.secret} selectable accessibilityLabel={`Setup key ${setup.secret.split('').join(' ')}`}>
            {setup.secret}
          </Text>
          <Text style={styles.step}>2. Enter the 6-digit code the app shows.</Text>
        </View>
      ) : null}

      {showCode ? (
        <View style={styles.form}>
          <Text style={styles.label} nativeID="admin-mfa-code-label">6-digit code</Text>
          <TextInput
            ref={codeRef}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={9}
            accessibilityLabel="6-digit code"
            accessibilityLabelledBy="admin-mfa-code-label"
            accessibilityHint="The code changes every 30 seconds."
            placeholder="123456"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            onSubmitEditing={() => void submit()}
          />
          <AnimatedButton
            haptic="medium"
            accessibilityLabel="Verify"
            contentStyle={styles.cta}
            disabled={busy !== null}
            onPress={() => void submit()}
          >
            <Text style={styles.ctaLabel}>{busy === 'verify' ? 'Checking…' : 'Verify'}</Text>
          </AnimatedButton>
        </View>
      ) : null}

      <View accessibilityLiveRegion="assertive">
        {failure ? <Text style={styles.failure} accessibilityRole="alert">{failure}</Text> : null}
      </View>

      <AnimatedButton haptic="medium" accessibilityLabel="Sign out" contentStyle={styles.secondary} onPress={() => void signOut()}>
        <Text style={styles.secondaryLabel}>Sign out</Text>
      </AnimatedButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: FOCAL.backgroundBase,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  kicker: { color: FOCAL.jadeInk, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22, fontWeight: '600', textAlign: 'center', maxWidth: 420 },
  setup: { alignItems: 'center', gap: 8, maxWidth: 420 },
  step: { color: colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  qr: { padding: 8, borderRadius: radii.md, backgroundColor: '#ffffff', borderWidth: 1, borderColor: colors.border },
  hint: { color: colors.textMuted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  secret: { color: FOCAL.jadeInk, fontSize: 14, fontWeight: '700', fontFamily: 'monospace', textAlign: 'center' },
  form: { alignItems: 'center', gap: 8, width: '100%', maxWidth: 320 },
  label: { color: colors.text, fontSize: 15, fontWeight: '800' },
  input: {
    width: '100%',
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 22,
    letterSpacing: 6,
    textAlign: 'center',
  },
  failure: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center', maxWidth: 420 },
  cta: {
    marginTop: 8,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 22,
    borderRadius: radii.md,
    backgroundColor: FOCAL.neonJade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { color: FOCAL.ink, fontSize: 15, fontWeight: '800' },
  secondary: {
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
