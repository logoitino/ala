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

import { useAuth } from '@/context/AuthContext';
import { telemetry } from '@/services/TelemetryManager';

export type SoftWallKind = 'malo' | 'crew' | 'wishlist' | 'signin';

export type SoftWallIntent = {
  kind: SoftWallKind;
  athleteName?: string;
  athleteId?: string;
  resume: () => void;
};

type SoftWallContextValue = {
  visible: boolean;
  /** Bumps every time the sheet is asked to open so a dropped iOS presentation can present again. */
  presentId: number;
  intent: SoftWallIntent | null;
  /**
   * @purpose Run `resume` when signed in; otherwise open SoftWallModal and stash the intent for after auth.
   */
  requireAuth: (intent: SoftWallIntent) => void;
  close: () => void;
};

const SoftWallContext = createContext<SoftWallContextValue | null>(null);

/**
 * @purpose Browse-first soft wall: guests can watch; Donate / Crew / gear goals require auth then resume.
 * @sideEffects Stashes intent until SoftWallModal completes Apple / Google / Magic Link; telemetry `soft_wall.*`.
 */
export function SoftWallProvider({ children }: { children: ReactNode }) {
  const { isGuest, session, loading, needsAgeConfirmation } = useAuth();
  const [intent, setIntent] = useState<SoftWallIntent | null>(null);
  const [presentId, setPresentId] = useState(0);
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
      if (!isGuest && session && !needsAgeConfirmation) {
        next.resume();
        return;
      }
      pendingResume.current = next.resume;
      armedForSession.current = true;
      setPresentId((current) => current + 1);
      setIntent(next);
      telemetry.trackFeature(`soft_wall.${next.kind}`, 'auth');
    },
    [isGuest, loading, needsAgeConfirmation, session],
  );

  // Close the sign-in sheet the instant a session exists, same as before — a brand-new fan
  // shouldn't be stuck staring at the Apple/Google/Magic-Link form while COPPA confirmation
  // runs in its own modal (AgeConfirmModal, mounted separately in app/_layout.tsx).
  useEffect(() => {
    if (isGuest || !session || !armedForSession.current) return;
    setIntent(null);
  }, [isGuest, session]);

  // Release the stashed action (donate checkout, Join Crew, gear goal — all money-adjacent) only once
  // BOTH a session exists AND, for brand-new Apple/Google/Magic-Link accounts, `needsAgeConfirmation`
  // has cleared. `AgeConfirmModal.confirmAge13Plus()` updates `AuthContext`'s `profile` state, which
  // recomputes `needsAgeConfirmation` to false and re-renders here via the `useAuth()` value — so this
  // effect re-fires on its own once confirmation lands; no polling needed. Returning users, and new
  // users who already confirmed via the Soft-Wall sign-up form's own checkbox, never have
  // `needsAgeConfirmation` true, so this adds no delay for them versus before.
  useEffect(() => {
    if (isGuest || !session || needsAgeConfirmation || !armedForSession.current) return;
    const resume = pendingResume.current;
    pendingResume.current = null;
    armedForSession.current = false;
    if (resume) {
      requestAnimationFrame(() => resume());
    }
  }, [isGuest, session, needsAgeConfirmation]);

  const value = useMemo(
    () => ({
      visible: Boolean(intent),
      presentId,
      intent,
      requireAuth,
      close,
    }),
    [close, intent, presentId, requireAuth],
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
