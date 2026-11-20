/**
 * Who is using the app: the Supabase session, the signed-in profile and role, guest browse markers, sign-in
 * (Apple / Google / Magic Link), the fan-or-athlete switch, and the owner "Studio unlock".
 * Everything else asks this context before gating a feature (`useAuth`). Profile edits write `profiles`;
 * role, verification and player link are server-owned and cannot be set from here. Profile reads
 * belong to one session lifetime: a delayed refresh cannot publish into an incoming account.
 * @sideEffects Supabase Auth session, `profiles` reads / writes, AsyncStorage guest markers.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Session, type User } from '@supabase/supabase-js';
import { type Href, useRouter } from 'expo-router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  completeAuthRedirect,
  confirmAge13Plus as confirmAge13PlusRemote,
  ensureFanProfile,
  ensureGuestId,
  isNewAuthUser,
  signInWithApple as appleSignIn,
  signInWithGoogle as googleSignIn,
  signInWithMagicLink as magicLinkSignIn,
  signInWithEmailPassword as passwordSignIn,
  signUpWithEmailPassword as passwordSignUp,
  signInWithDemoAccount as demoSignIn,
  signOutRemote,
  subscribeAuthDeepLinks,
  type BirthMonth,
} from '@/lib/auth';
import { deriveRoles, isAdminAccess, isUserRole, ROLE_HOME, addUserRoleRemote, parseRoles } from '@/lib/roles';
import { recordMyBirthMonth } from '@/lib/minors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { subscribeProfileAura } from '@/lib/aura';
import { offlineQueue } from '@/services/OfflineQueue';
import {
  fetchSchoolTeam,
  readAthleteOnboarding,
  saveAthleteOnboardingRemote,
  type AthleteOnboarding,
} from '@/lib/teams';
import type { Profile, ProfileSocialLinks, ProfileVisibility, UserRole } from '@/types/database';

export type ProfileEditPatch = {
  full_name?: string;
  username?: string | null;
  bio?: string | null;
  social_links?: ProfileSocialLinks;
  profile_visibility?: ProfileVisibility;
};

const DEV_ROLE_KEY = 'tapuai.devRole';
/** MINOR-01: an older account that taps Not now on the birth-month card is asked again after this long (owner 2026-10-14: "ask to confirm every now and then"). */
const BIRTH_PROMPT_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const birthPromptKey = (userId: string) => `tapuai.birthPrompt.snoozedUntil.${userId}`;
const STUDIO_KEY = 'tapuai.studioUnlocked';

type AuthContextValue = {
  /** Active RoleGate / Studio preview value. Fan chrome never shows this. */
  role: UserRole;
  /** Dual capability list, e.g. `['fan', 'athlete']`. */
  roles: UserRole[];
  /** Fan View vs Athlete Management View (dual accounts). */
  activeRole: 'fan' | 'athlete';
  isAthlete: boolean;
  isAdmin: boolean;
  /** True when there is no Supabase session (browse-first guest). Studio `guest` role is separate. */
  isGuest: boolean;
  /** True only right after a brand-new account's first sign-in (Apple/Google skip the sign-up form)
   * when the COPPA 13+ self-attestation has not been captured yet. Never true for a returning user. */
  needsAgeConfirmation: boolean;
  /** Records the COPPA 13+ self-attestation for the signed-in fan (`AgeConfirmModal`, databases without MINOR-01). */
  confirmAge13Plus: () => Promise<void>;
  /**
   * MINOR-01 one-time birth month card: 'required' for an account made after the update with no age yet (it cannot
   * friend or be friended until it adds one), 'optional' for an older account (skippable this session), else null.
   */
  birthPrompt: 'required' | 'optional' | null;
  /** Saves the birth month and year; 'blocked' (under 13) signs the account out. */
  recordBirthMonth: (year: number, month: number) => Promise<'ok' | 'blocked'>;
  /** Hides the optional card for three days on this device; it comes back until an age is added. */
  dismissBirthPrompt: () => void;
  /** Local Studio session so `/admin` stays open while previewing Fan / Operator. */
  studioUnlocked: boolean;
  canReceiveTips: boolean;
  isVerified: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Memory-only account-lifetime guard for pending UI work; remains valid through same-owner token refresh. */
  isSessionCurrent?: () => boolean;
  loading: boolean;
  switchRole: (role: UserRole) => Promise<void>;
  /** Preview a production surface from Studio without losing portal access. */
  previewAsRole: (role: UserRole) => Promise<void>;
  unlockStudio: () => Promise<void>;
  lockStudio: () => Promise<void>;
  setActiveRole: (role: 'fan' | 'athlete') => Promise<void>;
  addUserRole: (role: UserRole) => Promise<void>;
  completeAthleteOnboarding: (onboard: AthleteOnboarding) => Promise<void>;
  /** Patches the signed-in fan's own `profiles` row (Edit Profile sheet: name, username, bio,
   * social links, visibility toggles). Optimistic local update, then a remote write. */
  updateProfile: (patch: ProfileEditPatch) => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmailPassword: (email: string, password: string, ageConfirmed13Plus?: boolean) => Promise<void>;
  /** Creates a fan account. Resolves without a session when email confirmation is still required. */
  signUpWithEmailPassword: (email: string, password: string, birth: BirthMonth) => Promise<boolean>;
  signInWithMagicLink: (email: string, birth: BirthMonth) => Promise<void>;
  signInWithDemoAccount: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * @purpose Session, guest browse markers, Soft-Wall auth (Apple / Google / Magic Link), dual Fan/Athlete, Studio unlock.
 * @returns Auth bag including `isGuest`, `roles`, `activeRole`, `isVerified` (Varsity, not athlete claim), sign-in helpers, and Studio flags.
 * @sideEffects Supabase Auth + `profiles`; AsyncStorage guest/dev/studio keys; deep-link session recovery.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('fan');
  const [{ session, epoch: renderedSessionEpoch }, setSessionState] = useState<{ session: Session | null; epoch: number }>({ session: null, epoch: 0 });
  const [storedProfile, setProfile] = useState<Profile | null>(null);
  // Mask ownership in the render as well as clearing state at the auth boundary.
  const profile = storedProfile?.user_id === session?.user.id ? storedProfile : null;
  const sessionRef = useRef<Session | null>(null);
  const sessionEpoch = useRef(0);
  const accountEpoch = useRef(0);
  const profileLoad = useRef(0);
  const mounted = useRef(false);
  const [loading, setLoading] = useState(true);
  const [extraRoles, setExtraRoles] = useState<UserRole[]>([]);
  const [activeRoleOverride, setActiveRoleOverride] = useState<'fan' | 'athlete' | null>(null);
  const [studioUnlocked, setStudioUnlocked] = useState(false);
  const [birthPromptDismissed, setBirthPromptDismissed] = useState(false);

  const isCurrentSession = useCallback((epoch: number, userId?: string) => (
    mounted.current && epoch === sessionEpoch.current && sessionRef.current?.user.id === userId
  ), []);

  const installSession = useCallback((nextSession: Session | null) => {
    const changedOwner = sessionRef.current?.user.id !== nextSession?.user.id;
    const epoch = ++sessionEpoch.current;
    ++profileLoad.current;
    sessionRef.current = nextSession;
    // Queue ownership follows Auth immediately, before profile/network awaits or UI publication.
    offlineQueue.setActor(nextSession?.user.id ?? null);
    if (changedOwner) {
      ++accountEpoch.current;
      setProfile(null);
      setExtraRoles([]);
      setActiveRoleOverride(null);
      setBirthPromptDismissed(false);
    }
    setSessionState({ session: nextSession, epoch });
    return epoch;
  }, []);

  const loadProfile = useCallback(async (userId: string | undefined, epoch = sessionEpoch.current) => {
    if (!isCurrentSession(epoch, userId)) return null;
    const load = ++profileLoad.current;
    const isCurrentLoad = () => isCurrentSession(epoch, userId) && load === profileLoad.current;
    if (!userId || !isSupabaseConfigured) {
      setProfile(null);
      return null;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!isCurrentLoad()) return null;
    const next = data && data.user_id === userId ? { ...data } as Profile : null;
    if (next?.school_id) {
      next.team = await fetchSchoolTeam(next.school_id);
    } else {
      const local = await readAthleteOnboarding();
      if (next && local?.team) next.team = local.team;
    }
    if (!isCurrentLoad()) return null;
    setProfile(next);
    return next;
  }, [isCurrentSession]);

  const hydrateSession = useCallback(
    async (nextSession: Session | null, expectedEpoch = sessionEpoch.current) => {
      if (!mounted.current || expectedEpoch !== sessionEpoch.current) return null;
      const epoch = installSession(nextSession);
      if (nextSession?.user) {
        await ensureFanProfile(nextSession.user);
        if (!isCurrentSession(epoch, nextSession.user.id)) return null;
        return loadProfile(nextSession.user.id, epoch);
      } else {
        setProfile(null);
        return null;
      }
    },
    [installSession, isCurrentSession, loadProfile],
  );

  useEffect(() => {
    let active = true;
    mounted.current = true;
    const bootstrapEpoch = sessionEpoch.current;

    const bootstrap = async () => {
      await ensureGuestId();
      const [storedRole, storedStudio] = await Promise.all([
        AsyncStorage.getItem(DEV_ROLE_KEY),
        AsyncStorage.getItem(STUDIO_KEY),
      ]);
      const nextSession = isSupabaseConfigured
        ? (await supabase.auth.getSession()).data.session
        : null;

      if (!active) return;

      const nextProfile = await hydrateSession(nextSession, bootstrapEpoch);
      if (!active) return;

      let unlocked = storedStudio === '1';
      if (storedRole === 'admin') {
        unlocked = true;
        setRole('fan');
        await AsyncStorage.setItem(DEV_ROLE_KEY, 'fan');
        await AsyncStorage.setItem(STUDIO_KEY, '1');
      } else if (isUserRole(storedRole)) {
        setRole(storedRole);
      } else if (nextProfile && isUserRole(nextProfile.role) && nextProfile.role !== 'admin') {
        setRole(nextProfile.role);
      } else {
        setRole('fan');
      }
      setStudioUnlocked(unlocked);
      setLoading(false);
    };

    void bootstrap();

    if (!isSupabaseConfigured) {
      return () => {
        active = false;
        mounted.current = false;
        offlineQueue.suspendActor();
        ++sessionEpoch.current;
        ++accountEpoch.current;
        ++profileLoad.current;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      void hydrateSession(nextSession).catch(() => undefined);
    });

    const stopDeepLinks = subscribeAuthDeepLinks((url) => {
      if (!url.includes('auth/callback') && !url.includes('access_token') && !url.includes('code=')) {
        return;
      }
      const redirectEpoch = sessionEpoch.current;
      void completeAuthRedirect(url)
        .then((next) => {
          if (next) return hydrateSession(next, redirectEpoch);
        })
        .catch(() => undefined);
    });

    return () => {
      active = false;
      mounted.current = false;
      offlineQueue.suspendActor();
      ++sessionEpoch.current;
      ++accountEpoch.current;
      ++profileLoad.current;
      data.subscription.unsubscribe();
      stopDeepLinks();
    };
  }, [hydrateSession, loadProfile]);

  const switchRole = useCallback(
    async (nextRole: UserRole) => {
      setRole(nextRole);
      await AsyncStorage.setItem(DEV_ROLE_KEY, nextRole);
      router.replace(ROLE_HOME[nextRole] as Href);
    },
    [router],
  );

  const unlockStudio = useCallback(async () => {
    setStudioUnlocked(true);
    await AsyncStorage.setItem(STUDIO_KEY, '1');
  }, []);

  const lockStudio = useCallback(async () => {
    setStudioUnlocked(false);
    await AsyncStorage.removeItem(STUDIO_KEY);
    if (role === 'admin') {
      setRole('fan');
      await AsyncStorage.setItem(DEV_ROLE_KEY, 'fan');
    }
    router.replace('/' as Href);
  }, [role, router]);

  const previewAsRole = useCallback(
    async (nextRole: UserRole) => {
      setStudioUnlocked(true);
      await AsyncStorage.setItem(STUDIO_KEY, '1');
      await switchRole(nextRole);
    },
    [switchRole],
  );

  useEffect(() => {
    return subscribeProfileAura((userId, auraPoints) => {
      setProfile((current) => {
        if (!current) return current;
        if (current.user_id === userId || current.id === userId) {
          return { ...current, aura_points: auraPoints };
        }
        return current;
      });
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    return loadProfile(session?.user.id, renderedSessionEpoch);
  }, [loadProfile, renderedSessionEpoch, session?.user.id]);

  // Auth events can turn A→B→A before consumers render. Check the event boundary, not just the displayed UID.
  const renderedAccountEpoch = accountEpoch.current;
  const isSessionCurrent = useCallback(() => (
    mounted.current && renderedAccountEpoch === accountEpoch.current
  ), [renderedAccountEpoch]);

  const signInWithApple = useCallback(async () => {
    const epoch = sessionEpoch.current;
    const next = await appleSignIn();
    await hydrateSession(next, epoch);
  }, [hydrateSession]);

  const signInWithGoogle = useCallback(async () => {
    const epoch = sessionEpoch.current;
    const next = await googleSignIn();
    await hydrateSession(next, epoch);
  }, [hydrateSession]);

  const signInWithEmailPassword = useCallback(
    async (email: string, password: string, ageConfirmed13Plus?: boolean) => {
      const epoch = sessionEpoch.current;
      const next = await passwordSignIn(email, password, ageConfirmed13Plus);
      await hydrateSession(next, epoch);
    },
    [hydrateSession],
  );

  const signUpWithEmailPassword = useCallback(
    async (email: string, password: string, birth: BirthMonth) => {
      const epoch = sessionEpoch.current;
      const next = await passwordSignUp(email, password, birth);
      if (!next) return false;
      await hydrateSession(next, epoch);
      return true;
    },
    [hydrateSession],
  );

  const signInWithMagicLink = useCallback(async (email: string, birth: BirthMonth) => {
    await magicLinkSignIn(email, birth);
  }, []);

  const signInWithDemoAccount = useCallback(async () => {
    const epoch = sessionEpoch.current;
    const next = await demoSignIn();
    await hydrateSession(next, epoch);
  }, [hydrateSession]);

  const signOut = useCallback(async () => {
    const epoch = sessionEpoch.current;
    await signOutRemote();
    // A SIGNED_OUT event may already have cleared this owner; do not clear a newer sign-in.
    if (!mounted.current || (epoch !== sessionEpoch.current && sessionRef.current)) return;
    installSession(null);
    setProfile(null);
    setExtraRoles([]);
    setActiveRoleOverride(null);
    setRole('fan');
    await AsyncStorage.setItem(DEV_ROLE_KEY, 'fan');
  }, [installSession]);

  const roles = useMemo(() => {
    const merged = [...parseRoles(profile?.roles), ...extraRoles];
    return deriveRoles(role, { role: profile?.role, roles: merged });
  }, [extraRoles, profile, role]);
  const isAthlete = roles.includes('athlete');
  const isAdmin = studioUnlocked || isAdminAccess({ role, roles, profile });
  const isGuest = !session;
  const isVerified = Boolean(profile?.is_verified);
  // COPPA gate: only for a brand-new account's very first sign-in (Apple/Google have no sign-up
  // form to collect the checkbox on). A returning user always has `session.user` last_sign_in_at
  // far from created_at, so this stays false for every pre-existing account regardless of the
  // stored `age_confirmed_13_plus` value — see `.claude/agents/backend.md` "do not retroactively block".
  // MINOR-01: the birth columns exist only once the minor-accounts update is applied; until then the 13+ card stays.
  const hasBirthColumns = Boolean(profile && 'birth_year' in profile);
  const userIdForPrompt = session?.user?.id;
  useEffect(() => {
    if (!userIdForPrompt) return;
    let live = true;
    void AsyncStorage.getItem(birthPromptKey(userIdForPrompt)).then((until) => {
      if (live) setBirthPromptDismissed(Number(until) > Date.now());
    });
    return () => { live = false; };
  }, [userIdForPrompt]);
  const birthPrompt: 'required' | 'optional' | null =
    !session?.user || !profile || !hasBirthColumns || profile.birth_year != null || profile.age_blocked_at
      ? null
      : profile.age_check_required === true
        ? 'required'
        : birthPromptDismissed
          ? null
          : 'optional';
  const needsAgeConfirmation = hasBirthColumns
    ? birthPrompt === 'required'
    : Boolean(session?.user && profile && profile.age_confirmed_13_plus !== true && isNewAuthUser(session.user));
  const dismissBirthPrompt = useCallback(() => {
    setBirthPromptDismissed(true);
    if (userIdForPrompt) void AsyncStorage.setItem(birthPromptKey(userIdForPrompt), String(Date.now() + BIRTH_PROMPT_SNOOZE_MS));
  }, [userIdForPrompt]);

  const confirmAge13Plus = useCallback(async () => {
    if (!session?.user.id) return;
    await confirmAge13PlusRemote(session.user.id);
    setProfile((current) => (current ? { ...current, age_confirmed_13_plus: true } : current));
  }, [session?.user.id]);

  const recordBirthMonth = useCallback(async (year: number, month: number) => {
    const outcome = await recordMyBirthMonth(year, month);
    if (outcome === 'blocked') {
      await signOut();
      return outcome;
    }
    setProfile((current) => (current ? { ...current, birth_year: year, birth_month: month, age_confirmed_13_plus: true } : current));
    return outcome;
  }, [signOut]);
  const canReceiveTips = isAthlete;
  const activeRole: 'fan' | 'athlete' = useMemo(() => {
    if (!isAthlete) return 'fan';
    if (activeRoleOverride === 'fan' || activeRoleOverride === 'athlete') return activeRoleOverride;
    const stored = profile?.active_role;
    if (stored === 'fan' || stored === 'athlete') return stored;
    if (role === 'athlete') return 'athlete';
    return 'fan';
  }, [activeRoleOverride, isAthlete, profile?.active_role, role]);

  const addUserRole = useCallback(
    async (newRole: UserRole) => {
      setExtraRoles((current) => (current.includes(newRole) ? current : [...current, newRole]));
      if (newRole === 'athlete') setActiveRoleOverride('athlete');
      setProfile((current) => {
        if (!current) return current;
        const nextRoles = Array.from(new Set([...parseRoles(current.roles), newRole, 'fan']));
        return {
          ...current,
          roles: nextRoles,
          role: newRole === 'admin' ? 'admin' : newRole === 'athlete' ? 'athlete' : current.role,
          is_admin: newRole === 'admin' ? true : current.is_admin,
          active_role: newRole === 'athlete' ? 'athlete' : current.active_role,
        };
      });
      const remote = await addUserRoleRemote(newRole);
      if (remote && remote.length > 0) {
        setProfile((current) =>
          current
            ? {
                ...current,
                roles: remote,
                role: newRole === 'admin' ? 'admin' : newRole === 'athlete' ? 'athlete' : current.role,
                is_admin: newRole === 'admin' ? true : current.is_admin,
                active_role: newRole === 'athlete' ? 'athlete' : current.active_role,
              }
            : current,
        );
        await loadProfile(session?.user.id);
      }
    },
    [loadProfile, session?.user.id],
  );

  const completeAthleteOnboarding = useCallback(
    async (onboard: AthleteOnboarding) => {
      await addUserRole('athlete');
      await saveAthleteOnboardingRemote(session?.user.id, onboard);
      setProfile((current) =>
        current
          ? {
              ...current,
              school_id: onboard.team.id,
              athlete_division: onboard.team.division,
              athlete_sport: onboard.sport,
              athlete_jersey: onboard.jersey || null,
              athlete_position: onboard.position || null,
              athlete_class_year: onboard.classYear || null,
              team: onboard.team,
            }
          : current,
      );
    },
    [addUserRole, session?.user.id],
  );

  const setActiveRole = useCallback(
    async (nextRole: 'fan' | 'athlete') => {
      setActiveRoleOverride(nextRole);
      setProfile((current) => (current ? { ...current, active_role: nextRole } : current));
      if (!session?.user.id || !isSupabaseConfigured) return;
      await supabase.from('profiles').update({ active_role: nextRole }).eq('user_id', session.user.id);
    },
    [session?.user.id],
  );

  const updateProfile = useCallback(
    async (patch: ProfileEditPatch) => {
      setProfile((current) => (current ? { ...current, ...patch } : current));
      if (!session?.user.id || !isSupabaseConfigured) return;
      await supabase.from('profiles').update(patch).eq('user_id', session.user.id);
    },
    [session?.user.id],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      role,
      roles,
      activeRole,
      isAthlete,
      isAdmin,
      isGuest,
      needsAgeConfirmation,
      confirmAge13Plus,
      birthPrompt,
      recordBirthMonth,
      dismissBirthPrompt,
      studioUnlocked,
      canReceiveTips,
      isVerified,
      session,
      user: session?.user ?? null,
      profile,
      isSessionCurrent,
      loading,
      switchRole,
      previewAsRole,
      unlockStudio,
      lockStudio,
      setActiveRole,
      addUserRole,
      completeAthleteOnboarding,
      updateProfile,
      refreshProfile,
      signInWithApple,
      signInWithGoogle,
      signInWithEmailPassword,
      signUpWithEmailPassword,
      signInWithMagicLink,
      signInWithDemoAccount,
      signOut,
    }),
    [
      activeRole,
      addUserRole,
      canReceiveTips,
      completeAthleteOnboarding,
      confirmAge13Plus,
      birthPrompt,
      recordBirthMonth,
      dismissBirthPrompt,
      isAthlete,
      isAdmin,
      isGuest,
      isSessionCurrent,
      isVerified,
      loading,
      lockStudio,
      needsAgeConfirmation,
      previewAsRole,
      profile,
      refreshProfile,
      role,
      roles,
      session,
      setActiveRole,
      signInWithApple,
      signInWithGoogle,
      signInWithEmailPassword,
      signUpWithEmailPassword,
      signInWithMagicLink,
      signInWithDemoAccount,
      signOut,
      studioUnlocked,
      switchRole,
      unlockStudio,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

/**
 * @purpose Auth when present, null outside `AuthProvider` — for purely decorative consumers (UX-08 field lines)
 * that must never crash a screen or test that renders without the provider.
 */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
