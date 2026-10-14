/** QUIZ-02 mounted, foreground-only round capability; nothing secret is persisted or returned by account reads.
 * @sideEffects Explicit Start/answer, exact receipt recovery and best-effort End; native/web lifecycle listeners.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { getRandomValues, randomUUID } from 'expo-crypto';
import { answerTimedSportQuiz, endTimedSportQuiz, fetchTimedSportQuizReceipt, startTimedSportQuiz } from '@/lib/sportQuiz';
import { TIMED_QUIZ_NOTICE_VERSION, type TimedQuizSnapshot, type TimedQuizStartInput, type TimedQuizReceipt, type TimedQuizQuestion, type TimedQuizTopic, type TimedQuizEndInput } from '@shared/timedSportQuiz';
export type TimedQuizRoundInput = {
    identityKey: string | null;
    profileId: string | null;
    snapshot: TimedQuizSnapshot | null;
    focused: boolean;
    onChanged: () => Promise<void>;
};
export type TimedQuizLive = {
    question: TimedQuizQuestion;
    attemptId: string;
};
type Scope = {
    key: string | null;
    profile: string | null;
    active: boolean;
    foreground: boolean;
    generation: number;
    start: TimedQuizStartInput | null;
    startAt: number;
    deadline: number;
    live: TimedQuizLive | null;
    answer: {
        id: string;
        option: number;
        uncertain: boolean;
        attemptId: string;
    } | null;
    busy: 'start' | 'answer' | 'recover' | null;
    error: string | null;
    result: TimedQuizReceipt | null;
    ended: boolean;
    endSent: boolean;
    erased: boolean;
};
const clock = () => performance.now();
/** @purpose A stopped generation can never reopen from a late response; every cleanup uses its captured canonical actor. */
export function useTimedSportQuizRound(input: TimedQuizRoundInput) {
    const latest = useRef(input);
    latest.current = input;
    const sourceKey = input.identityKey ? JSON.stringify([input.identityKey,input.snapshot?.week_start ?? null]) : null;
    const make = (): Scope => ({ key: sourceKey, profile: input.profileId, active: true, foreground: (AppState.currentState === 'active' || AppState.currentState == null) && !(Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState !== 'visible'), generation: 0, start: null, startAt: 0, deadline: 0, live: null, answer: null, busy: null, error: null, result: null, ended: false, endSent: false, erased: false });
    const holder = useRef<Scope>(make());
    if (holder.current.key !== sourceKey || holder.current.profile !== input.profileId)
        holder.current = make();
    const scope = holder.current;
    const [, draw] = useState(0);
    const valid = useCallback(() => holder.current === scope && scope.active && scope.key !== null && scope.profile !== null, [scope]);
    const publish = useCallback(() => { if (valid())
        draw(n => n + 1); }, [valid]);
    const clear = useCallback(() => { scope.live = null; if (scope.start)
        scope.start = { ...scope.start, session_secret: '' }; scope.ended = true; scope.busy = null; scope.error = null; ++scope.generation; }, [scope]);
    const leave = useCallback((reason: TimedQuizEndInput['reason'] = 'user_end') => {
        const original = scope.start;
        const own = latest.current.snapshot?.profile_id === scope.profile ? latest.current.snapshot?.attempt : null;
        const attempt = scope.live?.attemptId ?? (own?.status === 'issued' ? own.id : null);
        const week = original?.expected_week ?? own?.week_start;
        if (!original && !attempt) {
            scope.live = null;
            publish();
            return;
        }
        clear();
        publish();
        if (scope.endSent || !scope.profile || !week || (!original && !attempt))
            return;
        scope.endSent = true;
        let request: string;
        try {
            request = randomUUID();
        }
        catch {
            return;
        }
        // UUID cancellation also handles a Start that is still waiting on the network; End contains no capability.
        void endTimedSportQuiz({ attempt_id: original ? null : attempt, start_request_id: original?.request_id ?? null, expected_week: week, reason, request_id: request, expected_profile_id: scope.profile }).then(() => { if (valid())
            void latest.current.onChanged(); }).catch(() => { });
    }, [clear, publish, scope, valid]);
    useEffect(() => {
        return () => { leave(holder.current === scope ? 'left_page' : 'identity_change'); scope.active = false; clear(); };
    }, [scope, leave, clear]);
    useEffect(() => { if (!input.focused)
        leave('left_page'); }, [input.focused, leave]);
    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => { scope.foreground = state === 'active'; if (!scope.foreground)
            leave('background'); });
        const visibility = () => { if (document.visibilityState !== 'visible') {
            scope.foreground = false;
            leave('background');
        }
        else
            scope.foreground = true; };
        if (Platform.OS === 'web' && typeof document !== 'undefined')
            document.addEventListener('visibilitychange', visibility);
        const timer = setInterval(() => { if (scope.start && !scope.ended && clock() >= scope.deadline)
            leave('user_end');
        else if (scope.live)
            publish(); }, 250);
        return () => { subscription.remove(); clearInterval(timer); if (Platform.OS === 'web' && typeof document !== 'undefined')
            document.removeEventListener('visibilitychange', visibility); };
    }, [scope, leave, publish]);
    useEffect(() => { const s = input.snapshot; if (scope.start && !scope.ended && s && (s.profile_id !== scope.profile || s.availability !== 'ready' || s.week_start !== scope.start?.expected_week || s.attempt?.status === 'void' || s.attempt?.status === 'ended' || s.attempt?.status === 'expired'))
        leave('user_end'); }, [input.snapshot, scope, leave]);
    const start = useCallback(async (topic: TimedQuizTopic, sport: string | null, duration: 30 | 90) => {
        const s = latest.current.snapshot;
        if (!valid() || !latest.current.focused || !scope.foreground || scope.busy || scope.live || scope.ended || !s || s.profile_id !== scope.profile || s.availability !== 'ready' || s.week_spent || s.preferences.notice_version !== TIMED_QUIZ_NOTICE_VERSION)
            return null;
        if (!s.pools.some(p => p.allowed && p.unseen_count > 0 && p.topic_category === topic && (sport === null || p.sport === sport)))
            return null;
        if (!scope.start) {
            try {
                const bytes = getRandomValues(new Uint8Array(32));
                if (bytes.length !== 32)
                    throw Error('secure randomness unavailable');
                scope.start = { topic_category: topic, sport, duration_seconds: duration, expected_week: s.week_start, notice_version: TIMED_QUIZ_NOTICE_VERSION, request_id: randomUUID(), session_secret: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''), expected_profile_id: scope.profile! };
                scope.startAt = clock();
                scope.deadline = scope.startAt + duration * 1000;
            }
            catch {
                scope.error = 'Secure trivia setup is unavailable. You can leave or try later.';
                publish();
                return null;
            }
        }
        if (scope.start.topic_category !== topic || scope.start.sport !== sport || scope.start.duration_seconds !== duration) {
            scope.error = 'Retry the original Start choices or end this round.';
            publish();
            return null;
        }
        if (clock() >= scope.deadline) {
            leave('user_end');
            return null;
        }
        const generation = scope.generation;
        const exact = scope.start;
        const sentAt = clock();
        scope.busy = 'start';
        scope.error = null;
        publish();
        try {
            const receipt = await startTimedSportQuiz(exact);
            if (!valid() || generation !== scope.generation || !latest.current.focused || !scope.foreground)
                return null;
            if (receipt.profile_id !== scope.profile || receipt.request_id !== exact.request_id)
                throw Error('identity mismatch');
            const a = receipt.attempt;
            if (a?.status === 'issued' && a.duration_seconds !== exact.duration_seconds)
                throw Error('duration mismatch');
            const remaining = a?.expires_at ? Date.parse(a.expires_at) - Date.parse(receipt.server_now) : 0;
            // Full request elapsed time is a conservative delivery allowance; exact retry never extends the first deadline.
            scope.deadline = Math.min(scope.deadline, clock() + Math.max(0, remaining - (clock() - sentAt)));
            if (receipt.active_question && a?.status === 'issued' && clock() < scope.deadline) {
                scope.live = { question: receipt.active_question, attemptId: a.id };
            }
            else {
                clear();
                scope.result = receipt;
            }
            publish();
            if (valid())
                void latest.current.onChanged();
            return receipt;
        }
        catch {
            if (valid() && generation === scope.generation) {
                scope.error = 'Start was not confirmed. Retry the same Start while this page stays active, or end the round.';
                publish();
            }
            return null;
        }
        finally {
            if (valid() && generation === scope.generation) {
                scope.busy = null;
                publish();
            }
        }
    }, [valid, scope, publish, leave, clear]);
    const answer = useCallback(async (option: number) => {
        if (!valid() || scope.busy || !scope.live || !scope.start?.session_secret || !latest.current.focused || !scope.foreground || !Number.isInteger(option) || option < 0 || option > 3)
            return null;
        if (clock() >= scope.deadline) {
            leave('user_end');
            return null;
        }
        if (scope.answer && scope.answer.option !== option) {
            scope.error = 'Retry your original answer or check its result.';
            publish();
            return null;
        }
        if (!scope.answer) {
            try {
                scope.answer = { id: randomUUID(), option, uncertain: false, attemptId: scope.live.attemptId };
            }
            catch {
                scope.error = 'Answer setup is unavailable.';
                publish();
                return null;
            }
        }
        const pending = scope.answer;
        const generation = scope.generation;
        scope.busy = 'answer';
        scope.error = null;
        publish();
        try {
            const result = await answerTimedSportQuiz({ attempt_id: pending.attemptId, option: pending.option, request_id: pending.id, session_secret: scope.start.session_secret, expected_profile_id: scope.profile! });
            if (!valid() || scope.erased)
                return null;
            if (result.profile_id !== scope.profile || result.request_id !== pending.id)
                throw Error('identity mismatch');
            // A terminal answer is safe to recover after closure; it never brings a prompt or secret back.
            if (result.attempt?.status === 'completed' && result.result) {
                clear();
                scope.answer = null;
                scope.result = result;
                publish();
                void latest.current.onChanged();
                return result;
            }
            if (generation === scope.generation) {
                clear();
                scope.result = result;
                publish();
                void latest.current.onChanged();
            }
            return result;
        }
        catch {
            if (valid() && !scope.erased) {
                pending.uncertain = true;
                scope.error = 'Your answer was not confirmed. Retry only this answer while the round is open, or check its result after it ends.';
                publish();
            }
            return null;
        }
        finally {
            if (valid()) {
                scope.busy = null;
                publish();
            }
        }
    }, [valid, scope, publish, leave, clear]);
    const recoverAnswer = useCallback(async () => { if (!valid() || scope.erased || scope.busy || !scope.answer?.uncertain)
        return null; const pending = scope.answer; scope.busy = 'recover'; publish(); try {
        const result = await fetchTimedSportQuizReceipt(pending.id);
        if (!valid() || scope.erased)
            return null;
        if (result?.profile_id === scope.profile && result.operation === 'answer' && result.request_id === pending.id && result.attempt?.status === 'completed' && result.result) {
            clear();
            scope.result = result;
            scope.answer = null;
            scope.error = null;
            publish();
            void latest.current.onChanged();
            return result;
        }
        scope.error = 'No committed answer was confirmed. Refresh your private history.';
        return null;
    }
    catch {
        if (valid())
            scope.error = 'The answer result is unavailable. Refresh your private history.';
        return null;
    }
    finally {
        if (valid()) {
            scope.busy = null;
            publish();
        }
    } }, [valid, scope, publish, clear]);
    // Erasure owns the atomic server close/CAS. Sending End first would change its reviewed revision.
    const discardForHistoryErase = useCallback(() => {
        clear();
        scope.erased = true;
        scope.answer = null;
        scope.result = null;
        publish();
    }, [clear,scope,publish]);
    const retryStart = useCallback(async () => { const p = scope.start; return p ? start(p.topic_category, p.sport, p.duration_seconds) : null; }, [scope, start]);
    const visible = valid() && input.focused && scope.foreground;
    return { live: visible ? scope.live : null, remainingSeconds: scope.live ? Math.max(0, Math.ceil((scope.deadline - clock()) / 1000)) : 0, busy: valid() ? scope.busy : null, error: valid() ? scope.error : null, result: valid() ? scope.result : null, ended: valid() ? scope.ended : false, pendingStart: valid() && !!scope.start && !scope.live && !scope.ended, pendingAnswer: valid() && scope.answer ? { option: scope.answer.option, uncertain: scope.answer.uncertain } : null, start, retryStart, answer, recoverAnswer, discardForHistoryErase, leave };
}
