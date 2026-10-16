/**
 * One way for an admin desk to run a write: show which control is busy, ignore a second tap until the first
 * finishes, put the result or the error in one notice, then reload. The Stats, Branding/confirmers,
 * Check-ins panels and the People desk each carried their own copy of this (DATA-01 merge, 2026-10-13).
 */
import { useCallback, useRef, useState } from 'react';

/** The notice under a desk: the success line, or the error in red. */
export type AdminActionMessage = { text: string; tone: 'ok' | 'danger' };

/**
 * @purpose Busy label, single-flight guard and result notice for admin writes.
 * @param after Runs after each successful write (usually the desk's reload); the latest one is always used.
 * @returns `run(label, work, fallbackError?)` where `work` resolves to the success text; `busy` is the running
 *   label or null; `message` / `setMessage` drive the notice.
 */
export function useAdminAction(after?: () => Promise<unknown> | void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<AdminActionMessage | null>(null);
  // A ref, not state: a second tap can land before React re-renders with `busy` set.
  const inFlight = useRef(false);
  const afterRef = useRef(after);
  afterRef.current = after;

  const run = useCallback(async (label: string, work: () => Promise<string>, fallbackError = 'That did not work.') => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(label);
    setMessage(null);
    try {
      setMessage({ text: await work(), tone: 'ok' });
      await afterRef.current?.();
    } catch (caught) {
      setMessage({ text: caught instanceof Error ? caught.message : fallbackError, tone: 'danger' });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }, []);

  return { busy, message, setMessage, run };
}
