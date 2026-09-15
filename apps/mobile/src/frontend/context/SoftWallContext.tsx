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
import type { SoftWallKind as SharedSoftWallKind } from '@tapuai/shared-types';

import { useAuth } from '@/context/AuthContext';
import { telemetry } from '@/services/TelemetryManager';

export type SoftWallKind = SharedSoftWallKind | 'signin';

export type SoftWallIntent = {
  kind: SoftWallKind;
  athleteName?: string;
  athleteId?: string;
  resume: () => void;
};

type SoftWallContextValue = {
  visible: boolean;
  intent: SoftWallIntent | null;
  /**
   * @purpose Run `resume` when signed in; otherwise open SoftWallModal and stash the intent for after auth.
   */
  requireAuth: (intent: SoftWallIntent) => void;
  close: () => void;
};

const SoftWallContext = createContext<SoftWallContextValue | null>(null);

/**
 * @purpose Browse-first soft wall: guests can watch; Mālo / Crew / Chip In / exclusive Vault require auth then resume.
 * @sideEffects Stashes intent until SoftWallModal completes Apple / Google / Magic Link; telemetry `soft_wall.*`.
 */
export function SoftWallProvider({ children }: { children: ReactNode }) {
  const { isGuest, session, loading } = useAuth();
  const [intent, setIntent] = useState<SoftWallIntent | null>(null);
  const pendingResume = useRef<(() => void) | null>(null);
  const armedForSession = useRef(false);

  const close = useCallback(() => {
    setIntent(null);
    pendingResume.current = null;
    armedForSession.current = false;
  }, []);

  const requireAuth = useCallback(
    (next: SoftWallIntent) => {
      if (loading) return;
      if (!isGuest && session) {
        next.resume();
        return;
      }
      pendingResume.current = next.resume;
      armedForSession.current = true;
      setIntent(next);
      telemetry.trackFeature(`soft_wall.${next.kind}`, 'auth');
    },
    [isGuest, loading, session],
  );

  useEffect(() => {
    if (isGuest || !session || !armedForSession.current) return;
    const resume = pendingResume.current;
    pendingResume.current = null;
    armedForSession.current = false;
    setIntent(null);
    if (resume) {
      requestAnimationFrame(() => resume());
    }
  }, [isGuest, session]);

  const value = useMemo(
    () => ({
      visible: Boolean(intent),
      intent,
      requireAuth,
      close,
    }),
    [close, intent, requireAuth],
  );

  return <SoftWallContext.Provider value={value}>{children}</SoftWallContext.Provider>;
}

export function useSoftWall(): SoftWallContextValue {
  const context = useContext(SoftWallContext);
  if (!context) {
    throw new Error('useSoftWall must be used within SoftWallProvider');
  }
  return context;
}
