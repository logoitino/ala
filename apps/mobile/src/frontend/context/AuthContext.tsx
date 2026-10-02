/**
 * Who is using the app: the Supabase session, the signed-in profile and role, guest browse markers, sign-in
 * (Apple / Google / Magic Link), the fan-or-athlete switch, and the owner "Studio unlock".
 * Everything else asks this context before gating a feature (`useAuth`). Profile edits write `profiles`;
 * role, verification and player link are server-owned and cannot be set from here.
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
} from '@/lib/auth';
import { deriveRoles, isAdminAccess, isUserRole, ROLE_HOME, addUserRoleRemote, parseRoles } from '@/lib/roles';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { subscribeProfileAura } from '@/lib/aura';
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
  /** Records the COPPA 13+ self-attestation for the signed-in fan (`AgeConfirmModal`). */
  confirmAge13Plus: () => Promise<void>;
  /** Local Studio session so `/admin` stays open while previewing Fan / Operator. */
  studioUnlocked: boolean;
  canReceiveTips: boolean;
  isVerified: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
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
  signUpWithEmailPassword: (email: string, password: string, ageConfirmed13Plus: boolean) => Promise<boolean>;
  signInWithMagicLink: (email: string, ageConfirmed13Plus?: boolean) => Promise<void>;
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
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [extraRoles, setExtraRoles] = useState<UserRole[]>([]);
  const [activeRoleOverride, setActiveRoleOverride] = useState<'fan' | 'athlete' | null>(null);
  const [studioUnlocked, setStudioUnlocked] = useState(false);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId || !isSupabaseConfigured) {
      setProfile(null);
      return null;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const next = (data as Profile | null) ?? null;
    if (next?.school_id) {
      next.team = await fetchSchoolTeam(next.school_id);
    } else {
      const local = await readAthleteOnboarding();
      if (next && local?.team) next.team = local.team;
    }
    setProfile(next);
    return next;
  }, []);

  const hydrateSession = useCallback(
    async (nextSession: Session | null) => {
      setSession(nextSession);
      if (nextSession?.user) {
        await ensureFanProfile(nextSession.user);
        await loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    },
    [loadProfile],
  );

  useEffect(() => {
    let active = true;

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

      if (nextSession?.user) {
        await ensureFanProfile(nextSession.user);
      }
      setSession(nextSession);
      const nextProfile = await loadProfile(nextSession?.user.id);
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
      };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        void ensureFanProfile(nextSession.user).then(() => loadProfile(nextSession.user.id));
      } else {
        setProfile(null);
      }
    });

    const stopDeepLinks = subscribeAuthDeepLinks((url) => {
      if (!url.includes('auth/callback') && !url.includes('access_token') && !url.includes('code=')) {
        return;
      }
      void completeAuthRedirect(url)
        .then((next) => {
          if (next) void hydrateSession(next);
        })
        .catch(() => undefined);
    });

    return () => {
      active = false;
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
    return loadProfile(session?.user.id);
  }, [loadProfile, session?.user.id]);

  const signInWithApple = useCallback(async () => {
    const next = await appleSignIn();
    await hydrateSession(next);
  }, [hydrateSession]);

  const signInWithGoogle = useCallback(async () => {
    const next = await googleSignIn();
    await hydrateSession(next);
  }, [hydrateSession]);

  const signInWithEmailPassword = useCallback(
    async (email: string, password: string, ageConfirmed13Plus?: boolean) => {
      const next = await passwordSignIn(email, password, ageConfirmed13Plus);
      await hydrateSession(next);
    },
    [hydrateSession],
  );

  const signUpWithEmailPassword = useCallback(
    async (email: string, password: string, ageConfirmed13Plus: boolean) => {
      const next = await passwordSignUp(email, password, ageConfirmed13Plus);
      if (!next) return false;
      await hydrateSession(next);
      return true;
    },
    [hydrateSession],
  );

  const signInWithMagicLink = useCallback(async (email: string, ageConfirmed13Plus?: boolean) => {
    await magicLinkSignIn(email, ageConfirmed13Plus);
  }, []);

  const signInWithDemoAccount = useCallback(async () => {
    const next = await demoSignIn();
    await hydrateSession(next);
  }, [hydrateSession]);

  const signOut = useCallback(async () => {
    await signOutRemote();
    setSession(null);
    setProfile(null);
    setExtraRoles([]);
    setActiveRoleOverride(null);
    setRole('fan');
    await AsyncStorage.setItem(DEV_ROLE_KEY, 'fan');
  }, []);

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
  const needsAgeConfirmation = Boolean(
    session?.user &&
      profile &&
      profile.age_confirmed_13_plus !== true &&
      isNewAuthUser(session.user),
  );

  const confirmAge13Plus = useCallback(async () => {
    if (!session?.user.id) return;
    await confirmAge13PlusRemote(session.user.id);
    setProfile((current) => (current ? { ...current, age_confirmed_13_plus: true } : current));
  }, [session?.user.id]);
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
      studioUnlocked,
      canReceiveTips,
      isVerified,
      session,
      user: session?.user ?? null,
      profile,
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
      isAthlete,
      isAdmin,
      isGuest,
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
