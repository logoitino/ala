/** QUIZ-02 mounted, foreground-only round capability, extended by QUIZ-03 for rounds of up to five with Next.
 * Each item keeps its own server deadline; the explanation waits for an explicit Next (exact request UUID and expected
 * position on retry). Nothing secret is persisted or returned by account reads; leaving at any point ends the round.
 * QUIZ-04: every round has a kind (personal, group or life) with its own weekly guard; End names that kind. A Life round
 * starts only through quiz_life_start (Life notice, optional chapter, 90 s default) and then uses the same Next / answer
 * / End path. After a round ends, dismiss() clears it so another kind's round can start on the same page.
 * @sideEffects Explicit Start/answer/Next, exact receipt recovery and best-effort End; native/web lifecycle listeners.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { getRandomValues, randomUUID } from 'expo-crypto';
import { answerTimedSportQuiz, endTimedSportQuiz, fetchTimedSportQuizReceipt, nextTriviaItem, startTimedSportQuiz, startTriviaGroupRound } from '@/lib/sportQuiz';
import { startLifeRound } from '@/lib/lifePlaybook';
import { LIFE_NOTICE_VERSION, type LifeChapterId, type LifeSnapshot } from '@shared/lifePlaybook';
import {
    TIMED_QUIZ_NOTICE_VERSION, type TimedQuizSnapshot, type TimedQuizStartInput, type TimedQuizReceipt, type TimedQuizQuestion, type TimedQuizTopic,
    type TimedQuizEndInput, type TimedQuizResult, type TimedQuizActiveItem, type TimedQuizAttemptSummary, type TimedQuizRoundKind,
} from '@shared/timedSportQuiz';
export type TimedQuizRoundInput = {
    identityKey: string | null;
    profileId: string | null;
    snapshot: TimedQuizSnapshot | null;
    focused: boolean;
    onChanged: () => Promise<void>;
    /** QUIZ-04: the account's own Life snapshot; a Life round starts only while it reads ready and unspent. */
    life?: LifeSnapshot | null;
};
export type TimedQuizLive = {
    question: TimedQuizQuestion;
    attemptId: string;
};
/** One closed question of this round, kept only in memory for the private round summary. */
export type TimedQuizRoundEntry = { position: number; question: TimedQuizQuestion | null; result: TimedQuizResult };
/** The explanation step: the item closed (answered or out of time) and the round waits for Next. */
export type TimedQuizBetween = { attemptId: string; position: number; planned: number; question: TimedQuizQuestion | null; result: TimedQuizResult | null };
type StartRequest = TimedQuizStartInput & { group_id: string | null; kind: TimedQuizRoundKind; chapter: LifeChapterId | null };
type Choice = { kind: TimedQuizRoundKind; topic: TimedQuizTopic; sport: string | null; group: string | null; chapter: LifeChapterId | null };
/** Life availabilities that mean the account can no longer play Life (the server also closes the round). */
const LIFE_LOST = ['ineligible', 'unavailable', 'paused', 'not_enrolled', 'off', 'not_opted_in'];
type Closing = { attemptId: string; position: number; planned: number; question: TimedQuizQuestion | null; request: string; tries: number };
type PendingNext = { id: string; expectedPosition: number; attemptId: string; firstSentAt: number; uncertain: boolean };
type Scope = {
    key: string | null;
    profile: string | null;
    active: boolean;
    foreground: boolean;
    generation: number;
    start: StartRequest | null;
    observedAttempt: Pick<NonNullable<TimedQuizSnapshot['attempt']>, 'id' | 'week_start' | 'status' | 'round_kind'> | null;
    startAt: number;
    deadline: number;
    live: TimedQuizLive | null;
    answer: {
        id: string;
        option: number;
        uncertain: boolean;
        attemptId: string;
    } | null;
    busy: 'start' | 'answer' | 'recover' | 'next' | null;
    error: string | null;
    result: TimedQuizReceipt | null;
    ended: boolean;
    endSent: boolean;
    erased: boolean;
    // QUIZ-03 round state (all in memory; cleared with the scope).
    mode: 'timed' | 'round' | null;
    item: { position: number; planned: number } | null;
    issueRequest: string | null;
    between: TimedQuizBetween | null;
    closing: Closing | null;
    next: PendingNext | null;
    nextDeadline: number;
    entries: TimedQuizRoundEntry[];
    roundSize: number | null;
    planned: number | null;
    shortRound: boolean;
    endedEarly: boolean;
    unavailableQuestion: boolean;
};
const clock = () => performance.now();
/** Used until the server's own next_by arrives (the backend gap is about two minutes). */
const NEXT_WINDOW_MS = 120000;
const NEXT_SAFETY_MS = 3000;
const CLOSE_RETRIES = 5;
const CLOSE_RETRY_MS = 1000;
/** @purpose A stopped generation can never reopen from a late response; every cleanup uses its captured canonical actor. */
export function useTimedSportQuizRound(input: TimedQuizRoundInput) {
    const latest = useRef(input);
    latest.current = input;
    const sourceKey = input.identityKey ? JSON.stringify([input.identityKey,input.snapshot?.week_start ?? null]) : null;
    const make = (): Scope => ({ key: sourceKey, profile: input.profileId, active: true, foreground: (AppState.currentState === 'active' || AppState.currentState == null) && !(Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState !== 'visible'), generation: 0, start: null, observedAttempt: null, startAt: 0, deadline: 0, live: null, answer: null, busy: null, error: null, result: null, ended: false, endSent: false, erased: false,
        mode: null, item: null, issueRequest: null, between: null, closing: null, next: null, nextDeadline: 0, entries: [], roundSize: null, planned: null, shortRound: false, endedEarly: false, unavailableQuestion: false });
    const holder = useRef<Scope>(make());
    if (holder.current.key !== sourceKey || holder.current.profile !== input.profileId)
        holder.current = make();
    const scope = holder.current;
    // Only this scope observes its current own summary. An empty departing scope cannot
    // borrow a newly established account/week's attempt through the latest-input ref.
    const observed = input.snapshot?.profile_id === scope.profile && input.snapshot.attempt?.week_start === input.snapshot.week_start ? input.snapshot.attempt : null;
    scope.observedAttempt = observed ? { id: observed.id, week_start: observed.week_start, status: observed.status, round_kind: observed.round_kind } : null;
    const [, draw] = useState(0);
    const valid = useCallback(() => holder.current === scope && scope.active && scope.key !== null && scope.profile !== null, [scope]);
    const publish = useCallback(() => { if (valid())
        draw(n => n + 1); }, [valid]);
    const clear = useCallback(() => { scope.live = null; if (scope.start)
        scope.start = { ...scope.start, session_secret: '' }; scope.ended = true; scope.busy = null; scope.error = null; ++scope.generation;
        scope.between = null; scope.closing = null; scope.next = null; scope.item = null; }, [scope]);
    const leave = useCallback((reason: TimedQuizEndInput['reason'] = 'user_end') => {
        const original = scope.start;
        const own = scope.observedAttempt;
        const attempt = scope.live?.attemptId ?? scope.between?.attemptId ?? (own?.status === 'issued' ? own.id : null);
        const week = original?.expected_week ?? own?.week_start;
        if (!original && !attempt) {
            scope.live = null;
            publish();
            return;
        }
        if (!scope.ended && scope.mode === 'round') scope.endedEarly = true;
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
        // QUIZ-04: End names the round kind so it spends only that week's guard.
        const roundKind = original ? original.kind : (own?.round_kind ?? 'personal');
        void endTimedSportQuiz({ attempt_id: original ? null : attempt, start_request_id: original?.request_id ?? null, expected_week: week, reason, request_id: request, expected_profile_id: scope.profile, round_kind: roundKind }).then(() => { if (valid())
            void latest.current.onChanged(); }).catch(() => { });
    }, [clear, publish, scope, valid]);
    /** Keep one entry per position; a later receipt never erases a question we already showed. */
    const record = useCallback((entry: TimedQuizRoundEntry) => {
        const prior = scope.entries.find(e => e.position === entry.position);
        const merged = { ...entry, question: entry.question ?? prior?.question ?? null };
        scope.entries = [...scope.entries.filter(e => e.position !== entry.position), merged].sort((a, b) => a.position - b.position);
    }, [scope]);
    const trackRound = useCallback((a: TimedQuizAttemptSummary | null) => {
        if (!a || a.mode !== 'round') return;
        scope.mode = 'round';
        if (typeof a.round_size === 'number') scope.roundSize = a.round_size;
        if (typeof a.planned_items === 'number') scope.planned = a.planned_items;
        scope.shortRound = a.short_round === true || (scope.planned !== null && scope.roundSize !== null && scope.planned < scope.roundSize);
    }, [scope]);
    /** Open one issued item; an image question is never shown in this build, so the round ends safely instead. */
    const openItem = useCallback((question: TimedQuizQuestion, attemptId: string, item: TimedQuizActiveItem | null | undefined, request: string, deadline: number) => {
        if (question.question_type === 'image_choice') {
            scope.unavailableQuestion = true;
            leave('user_end');
            return false;
        }
        scope.live = { question, attemptId };
        scope.item = item ? { position: item.position, planned: item.planned_items } : null;
        if (item) scope.planned = item.planned_items;
        scope.issueRequest = request;
        scope.deadline = deadline;
        scope.answer = null;
        scope.between = null;
        scope.closing = null;
        return true;
    }, [scope, leave]);
    const nextDeadlineFor = useCallback((a: TimedQuizAttemptSummary, r: TimedQuizResult | null, expired: boolean) => {
        const nb = a.next_by ? Date.parse(a.next_by) : NaN;
        const ref = r?.completed_at ? Date.parse(r.completed_at) : a.expires_at ? Date.parse(a.expires_at) : NaN;
        const gap = Number.isFinite(nb) && Number.isFinite(ref) && nb > ref ? nb - ref : NEXT_WINDOW_MS;
        // An out-of-time item started its Next window at the (conservative) local deadline, not when we heard about it.
        const base = expired ? Math.min(clock(), scope.deadline) : clock();
        return base + Math.max(0, gap - NEXT_SAFETY_MS);
    }, [scope]);
    /**
     * Apply a round receipt carrying the latest closed item. Returns true when it moved the round to the explanation
     * step or to its end. `question`/`position` describe the item this client last showed.
     */
    const applyRoundReceipt = useCallback((receipt: TimedQuizReceipt, question: TimedQuizQuestion | null, position: number) => {
        const a = receipt.attempt;
        const r = receipt.result;
        if (!a || a.mode !== 'round') return false;
        trackRound(a);
        if (a.status === 'issued' && a.round_state === 'between' && r && typeof a.position === 'number') {
            if (typeof r.position === 'number' && r.position !== a.position) return false;
            const shown = a.position === position ? question : null;
            record({ position: a.position, question: shown, result: r });
            scope.nextDeadline = nextDeadlineFor(a, r, r.answered_option === null);
            scope.live = null;
            scope.closing = null;
            scope.answer = null;
            scope.between = { attemptId: a.id, position: a.position, planned: a.planned_items ?? scope.planned ?? a.position, question: shown ?? scope.entries.find(e => e.position === a.position)?.question ?? null, result: r };
            publish();
            void latest.current.onChanged();
            return true;
        }
        if (a.status !== 'issued') {
            if (r) {
                const at = typeof r.position === 'number' ? r.position : typeof a.position === 'number' ? a.position : position;
                if (at >= 1) record({ position: at, question: at === position ? question : null, result: r });
            }
            clear();
            scope.answer = null;
            scope.result = receipt;
            publish();
            void latest.current.onChanged();
            return true;
        }
        return false;
    }, [scope, trackRound, record, nextDeadlineFor, publish, clear]);
    const settleClosing = useCallback(async (): Promise<void> => {
        const c = scope.closing;
        if (!valid() || !c || scope.busy || scope.erased) return;
        const generation = scope.generation;
        scope.busy = 'recover';
        publish();
        let retry = false;
        try {
            const receipt = await fetchTimedSportQuizReceipt(c.request);
            if (!valid() || generation !== scope.generation || scope.closing !== c || scope.erased) return;
            if (!receipt || receipt.profile_id !== scope.profile || receipt.request_id !== c.request) throw Error('receipt mismatch');
            if (!applyRoundReceipt(receipt, c.question, c.position)) throw Error('item still open');
        }
        catch {
            if (!valid() || generation !== scope.generation || scope.closing !== c) return;
            c.tries += 1;
            if (c.tries < CLOSE_RETRIES) retry = true;
            else {
                // Next settles the item on the server, so the round can continue without the explanation.
                scope.between = { attemptId: c.attemptId, position: c.position, planned: c.planned, question: c.question, result: null };
                scope.closing = null;
                scope.error = 'We couldn’t load that answer’s explanation. You can still tap Next or end the round.';
            }
        }
        finally {
            if (valid() && generation === scope.generation) {
                scope.busy = null;
                publish();
            }
        }
        if (retry) setTimeout(() => { if (valid() && generation === scope.generation) void settleClosing(); }, CLOSE_RETRY_MS);
    }, [scope, valid, publish, applyRoundReceipt]);
    /** The item's own deadline passed: no more answers; fetch the server's closed-item explanation. */
    const closeItem = useCallback(() => {
        const live = scope.live;
        if (!live || !scope.item || !scope.issueRequest) {
            leave('user_end');
            return;
        }
        scope.closing = { attemptId: live.attemptId, position: scope.item.position, planned: scope.item.planned, question: live.question, request: scope.issueRequest, tries: 0 };
        scope.live = null;
        scope.answer = null;
        scope.nextDeadline = scope.deadline + NEXT_WINDOW_MS - NEXT_SAFETY_MS;
        publish();
        void settleClosing();
    }, [scope, leave, publish, settleClosing]);
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
        const timer = setInterval(() => {
            if (scope.start && !scope.ended) {
                const now = clock();
                if (scope.mode === 'round') {
                    if (scope.live) {
                        if (now >= scope.deadline && scope.busy !== 'answer') closeItem();
                    }
                    else if (scope.between || scope.closing || scope.next) {
                        // Waiting too long at an explanation ends the round, like the server's next_by window.
                        if (now >= scope.nextDeadline) leave('user_end');
                    }
                    else if (now >= scope.deadline) leave('user_end');
                }
                else if (now >= scope.deadline) {
                    leave('user_end');
                    return;
                }
            }
            if (scope.live) publish();
        }, 250);
        return () => { subscription.remove(); clearInterval(timer); if (Platform.OS === 'web' && typeof document !== 'undefined')
            document.removeEventListener('visibilitychange', visibility); };
    }, [scope, leave, publish, closeItem]);
    useEffect(() => {
        const s = input.snapshot;
        const kind = scope.start?.kind;
        if (!scope.start || scope.ended || !s) return;
        // Only an attempt of this round's kind can say this round closed (the snapshot may show another kind's attempt).
        const sameKind = !s.attempt?.round_kind || s.attempt.round_kind === kind;
        // A Life round does not depend on the personal topic pools ('unavailable' there means only that they ran out).
        const triviaLost = kind === 'life' ? ['paused', 'not_enrolled', 'ineligible'].includes(s.availability) : s.availability !== 'ready';
        const life = input.life;
        const lifeLost = kind === 'life' && !!life && (life.profile_id !== scope.profile || LIFE_LOST.includes(life.availability));
        if (s.profile_id !== scope.profile || triviaLost || lifeLost || s.week_start !== scope.start.expected_week
            || (sameKind && (s.attempt?.status === 'void' || s.attempt?.status === 'ended' || s.attempt?.status === 'expired')))
            leave('user_end');
    }, [input.snapshot, input.life, scope, leave]);
    const begin = useCallback(async (choice: Choice, duration: 30 | 90) => {
        const s = latest.current.snapshot;
        const life = latest.current.life ?? null;
        const kind = choice.kind;
        if (!valid() || !latest.current.focused || !scope.foreground || scope.busy || scope.live || scope.ended || !s || s.profile_id !== scope.profile || s.preferences.notice_version !== TIMED_QUIZ_NOTICE_VERSION)
            return null;
        if (kind === 'personal' && (s.availability !== 'ready' || s.week_spent || !s.pools.some(p => p.allowed && p.unseen_count > 0 && p.topic_category === choice.topic && (choice.sport === null || p.sport === choice.sport))))
            return null;
        // QUIZ-04 servers keep a separate group guard; a QUIZ-03 server has only the one weekly guard.
        if (kind === 'group' && (s.availability !== 'ready' || !s.groups_available || choice.group === null || (s.week_spent_by_kind ? s.week_spent_by_kind.group : s.week_spent)))
            return null;
        if (kind === 'life' && (!life || life.profile_id !== scope.profile || life.availability !== 'ready' || life.week_spent || life.week_start !== s.week_start || life.preferences?.life_opt_in !== true))
            return null;
        if (!scope.start) {
            try {
                const bytes = getRandomValues(new Uint8Array(32));
                if (bytes.length !== 32)
                    throw Error('secure randomness unavailable');
                scope.start = { topic_category: choice.topic, sport: choice.sport, duration_seconds: duration, expected_week: s.week_start, notice_version: TIMED_QUIZ_NOTICE_VERSION, request_id: randomUUID(), session_secret: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''), expected_profile_id: scope.profile!, group_id: choice.group, kind, chapter: choice.chapter };
                scope.startAt = clock();
                scope.deadline = scope.startAt + duration * 1000;
            }
            catch {
                scope.error = 'Secure trivia setup is unavailable. You can leave or try later.';
                publish();
                return null;
            }
        }
        if (scope.start.kind !== kind || scope.start.chapter !== choice.chapter || scope.start.topic_category !== choice.topic || scope.start.sport !== choice.sport || scope.start.duration_seconds !== duration || scope.start.group_id !== choice.group) {
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
            const { group_id: group, kind: _kind, chapter, ...personal } = exact;
            const receipt = exact.kind === 'life'
                ? await startLifeRound({ expected_week: exact.expected_week, request_id: exact.request_id, session_secret: exact.session_secret, expected_profile_id: exact.expected_profile_id,
                    notice_version: LIFE_NOTICE_VERSION, chapter, duration_seconds: exact.duration_seconds })
                : group === null ? await startTimedSportQuiz(personal)
                : await startTriviaGroupRound({ group_id: group, duration_seconds: exact.duration_seconds, expected_week: exact.expected_week, notice_version: exact.notice_version, request_id: exact.request_id, session_secret: exact.session_secret, expected_profile_id: exact.expected_profile_id });
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
                scope.mode = a.mode === 'round' ? 'round' : 'timed';
                trackRound(a);
                openItem(receipt.active_question, a.id, receipt.active_item, exact.request_id, scope.deadline);
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
    }, [valid, scope, publish, leave, clear, trackRound, openItem]);
    const start = useCallback((topic: TimedQuizTopic, sport: string | null, duration: 30 | 90) => begin({ kind: 'personal', topic, sport, group: null, chapter: null }, duration), [begin]);
    /** @purpose QUIZ-03 group round from that group's page; QUIZ-04 spends only the group guard, never the personal one. */
    const startGroup = useCallback((groupId: string, duration: 30 | 90) => begin({ kind: 'group', topic: 'sport', sport: null, group: groupId, chapter: null }, duration), [begin]);
    /** @purpose QUIZ-04 Life round through quiz_life_start (null chapter = any open chapter); the same round UI after Start. */
    const startLife = useCallback((chapter: LifeChapterId | null, duration: 30 | 90) => begin({ kind: 'life', topic: 'sport', sport: null, group: null, chapter }, duration), [begin]);
    const answer = useCallback(async (option: number) => {
        if (!valid() || scope.busy || !scope.live || !scope.start?.session_secret || !latest.current.focused || !scope.foreground || !Number.isInteger(option) || option < 0 || option > 3 || option >= scope.live.question.options.length)
            return null;
        if (clock() >= scope.deadline) {
            if (scope.mode === 'round') closeItem();
            else leave('user_end');
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
                scope.error = 'We couldn’t send your answer. You can end the round.';
                publish();
                return null;
            }
        }
        const pending = scope.answer;
        const shownQuestion = scope.live.question;
        const shownPosition = scope.item?.position ?? 1;
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
            if (result.attempt?.mode === 'round') {
                if (generation !== scope.generation) {
                    // Already left: keep the committed fact for the summary, never reopen the round.
                    if (result.result) record({ position: result.result.position ?? shownPosition, question: shownQuestion, result: result.result });
                    publish();
                    return result;
                }
                if (applyRoundReceipt(result, shownQuestion, shownPosition)) return result;
                clear();
                scope.result = result;
                publish();
                void latest.current.onChanged();
                return result;
            }
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
    }, [valid, scope, publish, leave, clear, closeItem, record, applyRoundReceipt]);
    /** @purpose QUIZ-03 Next: one request UUID and expected position per explanation, reused exactly on every retry. */
    const next = useCallback(async () => {
        const b = scope.between;
        if (!valid() || scope.busy || !b || !scope.start?.session_secret || !latest.current.focused || !scope.foreground)
            return null;
        if (clock() >= scope.nextDeadline) {
            leave('user_end');
            return null;
        }
        if (b.position >= b.planned) {
            // The last item has no Next on the server; re-read its receipt to reach the summary instead.
            if (!scope.issueRequest) { leave('user_end'); return null; }
            scope.closing = { attemptId: b.attemptId, position: b.position, planned: b.planned, question: b.question, request: scope.issueRequest, tries: 0 };
            scope.between = null;
            publish();
            void settleClosing();
            return null;
        }
        if (scope.next && (scope.next.expectedPosition !== b.position || scope.next.attemptId !== b.attemptId))
            scope.next = null;
        if (!scope.next) {
            try {
                scope.next = { id: randomUUID(), expectedPosition: b.position, attemptId: b.attemptId, firstSentAt: clock(), uncertain: false };
            }
            catch {
                scope.error = 'Next is unavailable. You can end the round.';
                publish();
                return null;
            }
        }
        const pending = scope.next;
        const generation = scope.generation;
        const secret = scope.start.session_secret;
        const duration = scope.start.duration_seconds;
        const sentAt = clock();
        scope.busy = 'next';
        scope.error = null;
        publish();
        try {
            const receipt = await nextTriviaItem({ attempt_id: pending.attemptId, expected_position: pending.expectedPosition, request_id: pending.id, session_secret: secret, expected_profile_id: scope.profile! });
            if (!valid() || generation !== scope.generation || !latest.current.focused || !scope.foreground || scope.erased)
                return null;
            if (receipt.profile_id !== scope.profile || receipt.request_id !== pending.id)
                throw Error('identity mismatch');
            const a = receipt.attempt;
            if (receipt.active_question && receipt.active_item && a?.status === 'issued' && a.round_state === 'item') {
                const remaining = Date.parse(receipt.active_item.expires_at) - Date.parse(receipt.server_now);
                // As with Start, an exact retry never extends the item's time beyond the first Next press.
                const deadline = Math.min(pending.firstSentAt + duration * 1000, clock() + Math.max(0, remaining - (clock() - sentAt)));
                scope.next = null;
                trackRound(a);
                openItem(receipt.active_question, a.id, receipt.active_item, pending.id, deadline);
                publish();
                void latest.current.onChanged();
                return receipt;
            }
            if (!applyRoundReceipt(receipt, null, -1))
                throw Error('unexpected Next receipt');
            scope.next = null;
            return receipt;
        }
        catch {
            if (valid() && generation === scope.generation) {
                pending.uncertain = true;
                scope.error = 'Next wasn’t confirmed. Tap Next to try again, or end the round.';
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
    }, [valid, scope, publish, leave, trackRound, openItem, applyRoundReceipt, settleClosing]);
    const recoverAnswer = useCallback(async () => { if (!valid() || scope.erased || scope.busy || !scope.answer?.uncertain)
        return null; const pending = scope.answer; const shownQuestion = scope.live?.question ?? null; const shownPosition = scope.item?.position ?? 1; scope.busy = 'recover'; publish(); try {
        const result = await fetchTimedSportQuizReceipt(pending.id);
        if (!valid() || scope.erased)
            return null;
        if (result?.profile_id === scope.profile && result.operation === 'answer' && result.request_id === pending.id && result.attempt?.mode === 'round' && result.result) {
            record({ position: result.result.position ?? shownPosition, question: shownQuestion, result: result.result });
            if (result.attempt.status !== 'issued') scope.result = result;
            scope.answer = null;
            scope.error = null;
            publish();
            void latest.current.onChanged();
            return result;
        }
        if (result?.profile_id === scope.profile && result.operation === 'answer' && result.request_id === pending.id && result.attempt?.status === 'completed' && result.result) {
            clear();
            scope.result = result;
            scope.answer = null;
            scope.error = null;
            publish();
            void latest.current.onChanged();
            return result;
        }
        scope.error = 'We couldn’t find a saved answer. Refresh your private history.';
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
    } }, [valid, scope, publish, clear, record]);
    // Erasure owns the atomic server close/CAS. Sending End first would change its reviewed revision.
    const discardForHistoryErase = useCallback(() => {
        clear();
        scope.erased = true;
        scope.answer = null;
        scope.result = null;
        scope.entries = [];
        publish();
    }, [clear,scope,publish]);
    const retryStart = useCallback(async () => { const p = scope.start; return p ? begin({ kind: p.kind, topic: p.topic_category, sport: p.sport, group: p.group_id, chapter: p.chapter }, p.duration_seconds) : null; }, [scope, begin]);
    // A finished round stays on screen (its summary) until dismissed; a fresh scope can then start another kind's round.
    const makeLatest = useRef(make);
    makeLatest.current = make;
    /** @purpose QUIZ-04 "Back to this week's rounds": only after the round ended; nothing is sent (the round is closed). */
    const dismiss = useCallback(() => {
        if (!valid() || !scope.ended) return;
        scope.endSent = true;
        holder.current = makeLatest.current();
        draw(n => n + 1);
    }, [valid, scope]);
    const visible = valid() && input.focused && scope.foreground;
    const ok = valid();
    return { live: visible ? scope.live : null, remainingSeconds: scope.live ? Math.max(0, Math.ceil((scope.deadline - clock()) / 1000)) : 0, busy: ok ? scope.busy : null, error: ok ? scope.error : null, result: ok ? scope.result : null, ended: ok ? scope.ended : false, pendingStart: ok && !!scope.start && !scope.live && !scope.ended && scope.mode === null, pendingAnswer: ok && scope.answer ? { option: scope.answer.option, uncertain: scope.answer.uncertain } : null, start, startGroup, retryStart, answer, recoverAnswer, discardForHistoryErase, leave,
        mode: ok ? scope.mode : null, item: visible ? scope.item : null, between: visible ? scope.between : null, closing: visible && !!scope.closing, next, pendingNext: ok && scope.next ? { uncertain: scope.next.uncertain } : null,
        entries: ok ? scope.entries : [], roundSize: ok ? scope.roundSize : null, planned: ok ? scope.planned : null, shortRound: ok && scope.shortRound, endedEarly: ok && scope.endedEarly,
        unavailableQuestion: ok && scope.unavailableQuestion, groupId: ok ? scope.start?.group_id ?? null : null, duration: ok ? scope.start?.duration_seconds ?? null : null,
        kind: ok ? scope.start?.kind ?? null : null, startLife, dismiss };
}
export type TimedQuizRoundState = ReturnType<typeof useTimedSportQuizRound>;
