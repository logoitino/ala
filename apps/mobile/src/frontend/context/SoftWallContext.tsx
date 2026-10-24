/**
 * Browse-first soft wall. A guest can watch a shared Highlight and two more swipes. Upload, Give,
 * Join Crew, gear goals, and Vault unlock need an account. `requireAuth(intent)` runs the action at
 * once when signed in; otherwise it opens `SoftWallModal`, remembers the intent, and resumes it after sign-in.
 */

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

export type SoftWallKind = 'malo' | 'crew' | 'wishlist' | 'exclusive' | 'signin' | 'upload' | 'browse';

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
 * @purpose Browse-first soft wall: a few Highlights are free; Upload / Give / Crew / gear goals / Vault require auth then resume.
 * @sideEffects Stashes intent until SoftWallModal completes Apple / Google / Magic Link; waits past sheet dismiss and AgeConfirmModal; telemetry `soft_wall.*`.
 */
/** SoftWallModal slide-away is ~180ms; wait past that before PaymentSheet / next modal. */
const RESUME_AFTER_SHEET_MS = 220;

export function SoftWallProvider({ children }: { children: ReactNode }) {
  const { isGuest, session, loading, needsAgeConfirmation, birthPrompt } = useAuth();
  const [intent, setIntent] = useState<SoftWallIntent | null>(null);
  const [presentId, setPresentId] = useState(0);
  const pendingResume = useRef<(() => void) | null>(null);
  const armedForSession = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimer.current != null) {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearResumeTimer();
    setIntent(null);
    pendingResume.current = null;
    armedForSession.current = false;
  }, [clearResumeTimer]);

  const requireAuth = useCallback(
    (next: SoftWallIntent) => {
      if (loading) return;
      if (!isGuest && session) {
        // AgeConfirmModal covers required and optional birth prompts — arm resume, do not reopen Soft-Wall.
        if (!needsAgeConfirmation && birthPrompt == null) {
          next.resume();
          return;
        }
        clearResumeTimer();
        pendingResume.current = next.resume;
        armedForSession.current = true;
        return;
      }
      clearResumeTimer();
      pendingResume.current = next.resume;
      armedForSession.current = true;
      setPresentId((current) => current + 1);
      setIntent(next);
      telemetry.trackFeature(`soft_wall.${next.kind}`, 'auth');
    },
    [birthPrompt, clearResumeTimer, isGuest, loading, needsAgeConfirmation, session],
  );

  // Close the sign-in sheet the instant a session exists, same as before — a brand-new fan
  // shouldn't be stuck staring at the Apple/Google/Magic-Link form while COPPA confirmation
  // runs in its own modal (AgeConfirmModal, mounted separately in app/_layout.tsx).
  useEffect(() => {
    if (isGuest || !session || !armedForSession.current) return;
    setIntent(null);
  }, [isGuest, session]);

  // Release the stashed action only once a session exists and AgeConfirmModal would not show
  // (`needsAgeConfirmation` / any `birthPrompt`). SoftWallModal's dismiss animation is ~180ms;
  // wait past that so Vault / Give PaymentSheet does not fight the sign-in sheet.
  useEffect(() => {
    if (isGuest || !session || needsAgeConfirmation || birthPrompt != null || !armedForSession.current) {
      return;
    }
    const resume = pendingResume.current;
    pendingResume.current = null;
    armedForSession.current = false;
    if (!resume) return;
    clearResumeTimer();
    resumeTimer.current = setTimeout(() => {
      resumeTimer.current = null;
      resume();
    }, RESUME_AFTER_SHEET_MS);
    return clearResumeTimer;
  }, [birthPrompt, clearResumeTimer, isGuest, needsAgeConfirmation, session]);

  useEffect(() => () => clearResumeTimer(), [clearResumeTimer]);
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
