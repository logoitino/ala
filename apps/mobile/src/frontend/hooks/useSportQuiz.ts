/**
 * QUIZ-01 optional weekly learning, scoped to both authenticated and canonical account identity.
 * @sideEffects Own quiz SDK reads/writes and an in-memory answer request UUID; no storage, queue or telemetry.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '@/context/AuthContext';
import { answerSportQuiz, fetchSportQuiz, skipSportQuiz, startSportQuiz, type QuizSnapshot } from '@/lib/sportQuiz';

export type SportQuizBusy = 'start' | 'answer' | 'skip' | null;
export type SportQuizPendingAnswer = { option: number; uncertain: boolean };
export type SportQuizState = {
  snapshot: QuizSnapshot | null; loading: boolean; error: string | null; busy: SportQuizBusy;
  pendingAnswer: SportQuizPendingAnswer | null;
  refresh: () => Promise<void>; start: (sport: string) => Promise<QuizSnapshot | null>;
  answer: (option: number) => Promise<QuizSnapshot | null>; skip: () => Promise<QuizSnapshot | null>;
};
type Pending = SportQuizPendingAnswer & { attemptId: string; week: string; requestId: string };
type Scope = { key: string | null; epoch: number; active: boolean; read: number; loading: boolean; busy: SportQuizBusy; snapshot: QuizSnapshot | null; error: string | null; pending: Pending | null };
type ViewState = { epoch: number; snapshot: QuizSnapshot | null; loading: boolean; error: string | null; busy: SportQuizBusy };
const unavailable = 'Sport Pop Quiz is unavailable. Refresh to try again.';

/** @purpose Reject stale reads/writes across account switches and retain uncertain answers for exact, explicit retry. */
export function useSportQuiz(): SportQuizState {
  const auth = useAuth();
  const key = !auth.loading && !auth.isGuest && auth.user?.id && auth.profile?.id
    && auth.profile.user_id === auth.user.id && !auth.profile.age_blocked_at
    ? JSON.stringify([auth.user.id, auth.profile.id]) : null;
  const scope = useRef<Scope>({ key, epoch: 0, active: false, read: 0, loading: false, busy: null, snapshot: null, error: null, pending: null });
  // Invalidate synchronously before a mismatched identity can render or an old completion can publish.
  if (scope.current.key !== key) scope.current = { key, epoch: scope.current.epoch + 1, active: false, read: 0, loading: false, busy: null, snapshot: null, error: null, pending: null };
  const epoch = scope.current.epoch;
  const [view, setView] = useState<ViewState>({ epoch: -1, snapshot: null, loading: false, error: null, busy: null });
  const current = useCallback(() => key !== null && scope.current.key === key && scope.current.epoch === epoch && scope.current.active, [epoch, key]);
  const publish = useCallback(() => {
    if (!current()) return;
    const next = scope.current;
    setView(old => current() ? { epoch, snapshot: next.snapshot, loading: next.loading, error: next.error, busy: next.busy } : old);
  }, [current, epoch]);
  const accept = useCallback((snapshot: QuizSnapshot) => {
    if (!current()) return;
    const s = scope.current;
    s.snapshot = snapshot; s.error = null;
    if (s.pending && (snapshot.week_start !== s.pending.week || snapshot.attempt?.id !== s.pending.attemptId || snapshot.attempt.status !== 'issued')) s.pending = null;
    publish();
  }, [current, publish]);
  const read = useCallback(async (afterWrite = false) => {
    if (!current() || (scope.current.busy && !afterWrite)) return;
    const sequence = ++scope.current.read;
    scope.current.loading = true; publish();
    try {
      const next = await fetchSportQuiz();
      if (current() && sequence === scope.current.read) accept(next);
    } catch {
      if (current() && sequence === scope.current.read) { scope.current.error = unavailable; publish(); }
    } finally {
      if (current() && sequence === scope.current.read) { scope.current.loading = false; publish(); }
    }
  }, [accept, current, publish]);
  const refresh = useCallback(() => read(), [read]);
  useEffect(() => {
    scope.current.active = true;
    if (key) void read();
    else setView({ epoch, snapshot: null, loading: false, error: null, busy: null });
    return () => { if (scope.current.epoch === epoch) scope.current.active = false; };
  }, [epoch, key, read]);

  const run = useCallback(async (kind: Exclude<SportQuizBusy, null>, work: () => Promise<QuizSnapshot>) => {
    if (!current() || scope.current.busy) return null;
    scope.current.busy = kind; scope.current.error = null; scope.current.loading = false; ++scope.current.read; publish();
    try {
      const next = await work();
      if (!current()) return null;
      accept(next);
      await read(true); // A prior identity cannot launch or publish this follow-up read.
      return current() ? scope.current.snapshot : null;
    } catch {
      if (current()) {
        if (kind === 'answer' && scope.current.pending) scope.current.pending.uncertain = true;
        scope.current.error = kind === 'answer'
          ? 'We could not confirm your answer. Refresh to check it, or retry the same answer.' : unavailable;
        publish();
      }
      return null;
    } finally {
      if (current()) { scope.current.busy = null; publish(); }
    }
  }, [accept, current, publish, read]);
  const start = useCallback(async (sport: string) => {
    const s = scope.current;
    if (!current() || s.busy || s.loading || s.error || s.snapshot?.availability !== 'ready' || s.snapshot.status !== 'available' || !s.snapshot.sports.includes(sport)) return null;
    return run('start', () => startSportQuiz(sport));
  }, [current, run]);
  const answer = useCallback(async (option: number) => {
    const s = scope.current; const a = s.snapshot?.attempt;
    if (!current() || s.busy || s.loading || !Number.isInteger(option) || option < 0 || option > 3
      || s.snapshot?.availability !== 'ready' || a?.status !== 'issued' || !a.question) return null;
    if (s.pending && s.pending.option !== option) {
      s.error = 'Retry your original answer or refresh to check its result.'; publish(); return null;
    }
    if (!s.pending) {
      try { s.pending = { attemptId: a.id, week: s.snapshot.week_start, option, requestId: randomUUID(), uncertain: false }; }
      catch { s.error = unavailable; publish(); return null; }
    }
    const pending = s.pending;
    return run('answer', () => answerSportQuiz(pending.attemptId, pending.option, pending.requestId));
  }, [current, publish, run]);
  const skip = useCallback(async () => {
    const s = scope.current;
    if (!current() || s.busy || s.loading || s.error || s.pending || s.snapshot?.availability !== 'ready' || !['available','issued'].includes(s.snapshot.status)) return null;
    return run('skip', skipSportQuiz);
  }, [current, run]);
  const visible = view.epoch === epoch && key !== null;
  const pending = key && scope.current.pending;
  return { snapshot: visible ? view.snapshot : null, loading: auth.loading || (!!key && (!visible || view.loading)),
    error: visible ? view.error : null, busy: visible ? view.busy : null,
    pendingAnswer: pending ? { option: pending.option, uncertain: pending.uncertain } : null, refresh, start, answer, skip };
}
