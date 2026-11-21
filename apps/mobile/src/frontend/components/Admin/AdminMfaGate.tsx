/** UX-13 readable type/bounded presentation preserves synchronous flight guards and initiating lifetime checks. */
/**
 * SCALE-01 second sign-in step for Expo `/admin`. `AdminShell` mounts this only while
 * `EXPO_PUBLIC_ADMIN_REQUIRE_MFA` is on; desk children render only for an `aal2` session. Otherwise the admin
 * sets up an authenticator app once, or enters its code. Same look as `AccessRestricted`.
 * @sideEffects Supabase Auth TOTP calls through `lib/adminMfa.ts`; sign out through `AuthContext`.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View, type TextInputInstance, ScrollView, useWindowDimensions } from 'react-native';
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
import type { OfflineActor } from '@/lib/offlineActor';
import { FOCAL } from '@/theme/motion';
import { TYPE, figtree } from '@/theme/fonts';

/**
 * @purpose Hold desk children back until the session is `aal2`. Re-reads whenever the access token changes, so a
 *   verified code (new session) opens the desk without a reload.
 */
export function AdminMfaGate({ children }: { children: ReactNode }) {
  const { height: windowHeight } = useWindowDimensions();
  const { session, user, signOut, isSessionCurrent } = useAuth();
  const token = session?.access_token ?? null;
  const ownerId = session?.user.id && (!user || session.user.id === user.id) ? session.user.id : null;
  const scope = useRef({ ownerId, guard: isSessionCurrent, epoch: 0, mounted: true });
  const flight = useRef<object | null>(null);
  const leaving = useRef(false);
  const readRevision = useRef(0);
  if (scope.current.ownerId !== ownerId || scope.current.guard !== isSessionCurrent) {
    scope.current = { ...scope.current, ownerId, guard: isSessionCurrent, epoch: scope.current.epoch + 1 };
    flight.current = null;
    ++readRevision.current;
  }
  const epoch = scope.current.epoch;
  const current = useCallback(() => scope.current.mounted && scope.current.epoch === epoch && (isSessionCurrent?.() ?? true), [epoch, isSessionCurrent]);
  const actor: OfflineActor | undefined = ownerId ? { userId: ownerId, isCurrent: current } : undefined;
  type Gate = { epoch: number; state: AdminMfaState | null; setup: AdminTotpSetup | null; code: string; busy: 'setup' | 'verify' | null; failure: string | null };
  const empty: Gate = { epoch, state: null, setup: null, code: '', busy: null, failure: null };
  const [stored, setStored] = useState<Gate>(empty);
  const value = stored.epoch === epoch && current() ? stored : empty;
  const { state, setup, code, busy, failure } = value;
  const update = useCallback((patch: Partial<Gate>) => {
    if (!current()) return;
    setStored((previous) => ({ ...(previous.epoch === epoch ? previous : { epoch, state: null, setup: null, code: '', busy: null, failure: null }), ...patch, epoch }));
  }, [current, epoch]);
  const setCode = (code: string) => update({ code });
  const codeRef = useRef<TextInputInstance>(null);
  useEffect(() => {
    scope.current.mounted = true;
    return () => { scope.current.mounted = false; flight.current = null; ++readRevision.current; };
  }, []);
  useEffect(() => {
    const revision = ++readRevision.current;
    update({ state: null });
    readAdminMfaState(token, actor).then((next) => {
      if (revision === readRevision.current) update({ state: next });
    }).catch((caught: unknown) => {
      if (revision === readRevision.current) update({ state: { step: 'verify', factorId: null }, failure: mfaErrorText(caught) });
    });
    return () => { ++readRevision.current; };
  }, [token, epoch, current, update]);

  const beginSetup = async () => {
    if (!ownerId || !current() || flight.current) return;
    const operation = {}; flight.current = operation;
    update({ busy: 'setup', failure: null });
    try { const next = await startAdminTotpSetup(actor); if (flight.current === operation) update({ setup: next }); }
    catch (caught) { if (flight.current === operation) update({ failure: mfaErrorText(caught) }); }
    finally { if (flight.current === operation) { flight.current = null; update({ busy: null }); } }
  };
  const factorId = setup?.factorId ?? state?.factorId ?? null;
  const submit = async () => {
    if (!ownerId || !current() || flight.current) return;
    const digits = normalizeTotpCode(code);
    if (!digits) { update({ failure: 'Enter the 6 digits from your authenticator app.' }); codeRef.current?.focus(); return; }
    if (!factorId) return;
    const operation = {}; flight.current = operation;
    update({ busy: 'verify', failure: null });
    try { await verifyAdminTotpCode(factorId, digits, actor); if (flight.current === operation) update({ code: '' }); }
    catch (caught) { if (flight.current === operation && current()) { update({ failure: mfaErrorText(caught), code: '' }); codeRef.current?.focus(); } }
    finally { if (flight.current === operation) { flight.current = null; update({ busy: null }); } }
  };
  const leave = async () => {
    if (leaving.current) return;
    leaving.current = true;
    ++scope.current.epoch; flight.current = null; ++readRevision.current;
    const leavingEpoch = scope.current.epoch;
    setStored({ ...empty, epoch: scope.current.epoch });
    try { await signOut(); }
    catch (error) {
      if (scope.current.mounted && scope.current.epoch === leavingEpoch && scope.current.ownerId === ownerId) {
        setStored({ ...empty, epoch: leavingEpoch, state: { step: 'verify', factorId: null }, failure: error instanceof Error ? error.message : 'Sign-out did not finish. Try again.' });
      }
    } finally { leaving.current = false; }
  };

  if (!state) {
    return <View style={styles.wrap}><ActivityIndicator color={FOCAL.jadeInk} accessibilityLabel="Checking two-step sign-in" /></View>;
  }
  if (state.step === 'off' || state.step === 'pass') return <>{children}</>;

  const enrolling = state.step === 'enroll';
  const noAccount = !token;
  const showCode = !noAccount && (enrolling ? Boolean(setup) : Boolean(factorId));

  return (
    <ScrollView style={{ maxHeight: windowHeight * 0.85, flexGrow: 0 }} contentContainerStyle={styles.wrap}>
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

      <AnimatedButton haptic="medium" accessibilityLabel="Sign out" contentStyle={styles.secondary} onPress={() => void leave().catch(() => undefined)}>
        <Text style={styles.secondaryLabel}>Sign out</Text>
      </AnimatedButton>
    </ScrollView>
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
  kicker: { color: FOCAL.jadeInk, ...TYPE.caption, ...figtree('800'), letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.text, ...TYPE.display, ...figtree('800'), letterSpacing: -0.6, textAlign: 'center' },
  body: { color: colors.textMuted, ...TYPE.body,  ...figtree('600'), textAlign: 'center', maxWidth: 420 },
  setup: { alignItems: 'center', gap: 8, maxWidth: 420 },
  step: { color: colors.text, ...TYPE.section, ...figtree('800'), textAlign: 'center' },
  qr: { padding: 8, borderRadius: radii.md, backgroundColor: '#ffffff', borderWidth: 1, borderColor: colors.border },
  hint: { color: colors.textMuted, ...TYPE.body, ...figtree('600'), textAlign: 'center' },
  secret: { color: FOCAL.jadeInk, ...TYPE.body, fontWeight: 'normal', fontFamily: 'monospace', textAlign: 'center' },
  form: { alignItems: 'center', gap: 8, width: '100%', maxWidth: 320 },
  label: { color: colors.text, ...TYPE.section, ...figtree('800') },
  input: { ...figtree('400'),
    width: '100%',
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    color: colors.text,
    ...TYPE.title,
    letterSpacing: 6,
    textAlign: 'center',
  },
  failure: { color: colors.text, ...TYPE.body, ...figtree('700'), textAlign: 'center', maxWidth: 420 },
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
  ctaLabel: { color: FOCAL.ink, ...TYPE.section, ...figtree('800') },
  secondary: {
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { color: colors.text, ...TYPE.section, ...figtree('800') },
});
