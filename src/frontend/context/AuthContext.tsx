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

import { ROLE_HOME } from '@/lib/roles';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types/database';

const DEV_ROLE_KEY = 'tapuai.devRole';

type AuthContextValue = {
  role: UserRole;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  switchRole: (role: UserRole) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isUserRole(value: string | null | undefined): value is UserRole {
  return (
    value === 'guest' ||
    value === 'fan' ||
    value === 'athlete' ||
    value === 'parent' ||
    value === 'operator' ||
    value === 'booster' ||
    value === 'sponsor' ||
    value === 'admin'
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('guest');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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
    setProfile(next);
    return next;
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const storedRole = await AsyncStorage.getItem(DEV_ROLE_KEY);
      const nextSession = isSupabaseConfigured
        ? (await supabase.auth.getSession()).data.session
        : null;

      if (!active) return;

      setSession(nextSession);
      const nextProfile = await loadProfile(nextSession?.user.id);
      if (!active) return;

      if (isUserRole(storedRole)) {
        setRole(storedRole);
      } else if (nextProfile && isUserRole(nextProfile.role)) {
        setRole(nextProfile.role);
      } else {
        setRole('guest');
      }
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
      void loadProfile(nextSession?.user.id);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const switchRole = useCallback(
    async (nextRole: UserRole) => {
      setRole(nextRole);
      await AsyncStorage.setItem(DEV_ROLE_KEY, nextRole);
      router.replace(ROLE_HOME[nextRole] as Href);
    },
    [router],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      role,
      session,
      user: session?.user ?? null,
      profile,
      loading,
      switchRole,
    }),
    [loading, profile, role, session, switchRole],
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
