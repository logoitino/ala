/** QUIZ-02 identity-isolated account state, preferences and private terminal history; no prompt or capability.
 * @sideEffects Own sanitized reads, explicit preferences/Skip/CAS erasure and a settled optional weekly invitation claim.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '@/context/AuthContext';
import { claimTimedSportQuizInvitation, eraseTimedSportQuizHistory, fetchTimedSportQuiz, fetchTimedSportQuizHistory, saveTimedSportQuizPreferences, skipTimedSportQuiz } from '@/lib/sportQuiz';
import { NOT_SWITCHED_ON } from '@/lib/rpc';
import { TIMED_QUIZ_NOTICE_VERSION, type TimedQuizSnapshot, type TimedQuizHistoryPage, type TimedQuizPreferencesInput, type TimedQuizReceipt } from '@shared/timedSportQuiz';
export type SportQuizBusy = 'preferences' | 'invitation' | 'skip' | 'erase' | null;
type Pending = {
    kind: Exclude<SportQuizBusy, null | 'erase'>;
    id: string;
    week: string;
    version: number;
    payload?: TimedQuizPreferencesInput;
};
type Scope = {
    key: string | null;
    profile: string | null;
    active: boolean;
    read: number;
    historyRead: number;
    snapshot: TimedQuizSnapshot | null;
    history: TimedQuizHistoryPage | null;
    loading: boolean;
    historyLoading: boolean;
    error: string | null;
    historyError: string | null;
    busy: SportQuizBusy;
    pending: Pending | null;
    suppressed: boolean;
    preferenceUncertain: boolean;
    preferenceNeedsReview: boolean;
    offRequested: boolean;
    erasureUncertain: boolean;
};
// Exact server exception names are definite transactional refusals; transport/adapter failures remain uncertain.
const preferenceRefusals = new Set(['quiz_preferences_stale', 'quiz_preferences_invalid', 'quiz_request_conflict', 'quiz_request_limit', 'quiz_paused', 'quiz_not_enrolled', 'quiz_unavailable', 'quiz_ineligible', 'quiz_identity_changed']);
/** @purpose Captured identity and source sequences prevent delayed reads/writes from publishing to another account. */
export function useSportQuiz() {
    const auth = useAuth();
    const profileId = !auth.loading && !auth.isGuest && auth.user?.id && auth.profile?.id && auth.profile.user_id === auth.user.id && !auth.profile.age_blocked_at ? auth.profile.id : null;
    const identityKey = profileId ? JSON.stringify([auth.user!.id, profileId]) : null;
    const make = (): Scope => ({ key: identityKey, profile: profileId, active: false, read: 0, historyRead: 0, snapshot: null, history: null, loading: false, historyLoading: false, error: null, historyError: null, busy: null, pending: null, suppressed: false, preferenceUncertain: false, preferenceNeedsReview: false, offRequested: false, erasureUncertain: false });
    const holder = useRef(make());
    if (holder.current.key !== identityKey)
        holder.current = make();
    const scope = holder.current;
    const [, draw] = useState(0);
    const current = useCallback(() => holder.current === scope && scope.active && scope.key !== null, [scope]);
    const publish = useCallback(() => { if (current())
        draw(n => n + 1); }, [current]);
    const read = useCallback(async (reconcilePreferences = false) => { if (!current())
        return; const sequence = ++scope.read; scope.loading = true; publish(); try {
        const snapshot = await fetchTimedSportQuiz();
        if (!current() || sequence !== scope.read)
            return;
        if (snapshot.profile_id !== scope.profile && !(snapshot.profile_id === null && snapshot.availability === 'ineligible'))
            throw Error('identity mismatch');
        if (scope.snapshot?.history_version !== snapshot.history_version) {
            ++scope.historyRead;
            scope.history = null;
            scope.historyLoading = false;
        }
        scope.snapshot = snapshot;
        scope.error = null;
        scope.erasureUncertain = false;
        // A known refusal can be released after an explicit authoritative review. An unknown
        // write keeps its exact CAS request unless a newer version makes that old write obsolete.
        if (reconcilePreferences && snapshot.profile_id === scope.profile && scope.busy !== 'preferences' &&
            (scope.preferenceNeedsReview || (scope.pending?.kind === 'preferences' && snapshot.preferences.version > scope.pending.version))) {
            scope.pending = null;
            scope.preferenceNeedsReview = false;
            scope.preferenceUncertain = false;
        }
        scope.suppressed = scope.offRequested || snapshot.preferences.invitation_mode === 'off';
    }
    catch (error) {
        if (current() && sequence === scope.read) {
            // Keep the missing-migration signal so the quiz page can offer the local demo / apply packet.
            scope.error = error instanceof Error && error.message === NOT_SWITCHED_ON
                ? NOT_SWITCHED_ON
                : 'Sport Pop Quiz is unavailable. Refresh to check availability.';
        }
    }
    finally {
        if (current() && sequence === scope.read) {
            scope.loading = false;
            publish();
        }
    } }, [current, scope, publish]);
    const loadHistory = useCallback(async (more = false) => { if (!current())
        return; const before = more ? scope.history?.next_before ?? null : null; if (more && !before)
        return; const revision = scope.snapshot?.history_version; const sequence = ++scope.historyRead; scope.historyLoading = true; scope.historyError = null; publish(); try {
        const page = await fetchTimedSportQuizHistory(before);
        if (!current() || sequence !== scope.historyRead || revision !== scope.snapshot?.history_version)
            return;
        if (page.profile_id !== scope.profile)
            throw Error('identity mismatch');
        if (more && scope.history && scope.history.history_version !== page.history_version) {
            scope.historyError = 'Your history changed. Refresh private history before loading more.';
            return;
        }
        scope.history = more && scope.history && scope.history.history_version === page.history_version ? { ...page, items: [...scope.history.items, ...page.items] } : page;
    }
    catch {
        if (current() && sequence === scope.historyRead)
            scope.historyError = 'Your private history is unavailable. Refresh history to try again.';
    }
    finally {
        if (current() && sequence === scope.historyRead) {
            scope.historyLoading = false;
            publish();
        }
    } }, [current, scope, publish]);
    const refresh = useCallback(async () => { const hadHistory = scope.history !== null || scope.erasureUncertain; await read(true); if (current() && hadHistory)
        await loadHistory(); }, [read, current, scope, loadHistory]);
    useEffect(() => { scope.active = true; if (identityKey)
        void read(); return () => { scope.active = false; ++scope.read; ++scope.historyRead; scope.pending = null; }; }, [scope, identityKey, read]);
    const run = useCallback(async (pending: Pending, work: () => Promise<TimedQuizReceipt>) => { if (!current() || scope.busy)
        return null; scope.busy = pending.kind; scope.error = null; ++scope.read; scope.loading = false; publish(); try {
        const receipt = await work();
        if (!current())
            return null;
        if (receipt.profile_id !== scope.profile || receipt.request_id !== pending.id || receipt.operation !== pending.kind)
            throw Error('identity mismatch');
        scope.pending = null;
        if (pending.kind === 'preferences') {
            scope.preferenceUncertain = false;
            scope.preferenceNeedsReview = false;
            scope.offRequested = pending.payload?.invitation_mode === 'off';
            scope.suppressed = scope.offRequested;
        }
        await read();
        return current() ? receipt : null;
    }
    catch (error) {
        if (current()) {
            const refused = pending.kind === 'preferences' && error instanceof Error && preferenceRefusals.has(error.message.trim());
            if (pending.kind === 'preferences') {
                scope.preferenceUncertain = !refused;
                scope.preferenceNeedsReview = refused;
            }
            scope.error = refused ? 'Your choices were refused. Refresh and review current choices before trying again.' : pending.kind === 'skip' ? 'Skip was not confirmed. Refresh to check this week.' : pending.kind === 'preferences' ? 'Your choices were not confirmed. Refresh to check them or retry the same choices.' : 'The weekly invitation was not confirmed. Refresh to check availability.';
            publish();
        }
        return null;
    }
    finally {
        if (current()) {
            scope.busy = null;
            publish();
        }
    } }, [current, scope, publish, read]);
    const savePreferences = useCallback(async (payload: TimedQuizPreferencesInput) => {
        if (!current() || !scope.snapshot) return null;
        if (payload.invitation_mode === 'off') {
            scope.offRequested = true;
            scope.suppressed = true;
            publish();
        }
        if (scope.busy) return null;
        if (scope.loading || scope.preferenceNeedsReview) {
            scope.error = 'Refresh and review current choices before choosing different settings.';
            publish();
            return null;
        }
        let pending = scope.pending;
        if (pending && (pending.kind !== 'preferences' || JSON.stringify(pending.payload) !== JSON.stringify(payload))) {
            scope.error = 'Refresh and review the unconfirmed choices before choosing different settings.';
            publish();
            return null;
        }
        if (!pending) {
            try {
                pending = { kind: 'preferences', id: randomUUID(), week: scope.snapshot.week_start, version: scope.snapshot.preferences.version, payload: { ...payload } };
                scope.pending = pending;
            }
            catch { return null; }
        }
        const exact = pending;
        return run(exact, () => saveTimedSportQuizPreferences(exact.payload!, exact.version, exact.id, scope.profile!));
    }, [current, scope, publish, run]);
    const claimInvitation = useCallback(async () => { const s = scope.snapshot; if (!current() || scope.busy || scope.loading || scope.error || scope.suppressed || !s || s.availability !== 'ready' || s.week_spent || s.preferences.invitation_mode !== 'weekly' || s.preferences.notice_version !== TIMED_QUIZ_NOTICE_VERSION || s.preferences.last_invited_week === s.week_start)
        return null; if (scope.pending && scope.pending.kind !== 'invitation')
        return null; try {
        const p = scope.pending ?? { kind: 'invitation' as const, id: randomUUID(), week: s.week_start, version: s.preferences.version };
        scope.pending = p;
        return run(p, () => claimTimedSportQuizInvitation(p.week, p.id, scope.profile!));
    }
    catch {
        return null;
    } }, [current, scope, run]);
    const skip = useCallback(async () => { const s = scope.snapshot; if (!current() || scope.busy || scope.loading || !s || s.availability !== 'ready' || s.week_spent)
        return null; if (scope.pending && scope.pending.kind !== 'skip')
        return null; try {
        const p = scope.pending ?? { kind: 'skip' as const, id: randomUUID(), week: s.week_start, version: s.preferences.version };
        scope.pending = p;
        return run(p, () => skipTimedSportQuiz(p.week, p.id, scope.profile!));
    }
    catch {
        return null;
    } }, [current, scope, run]);
    const eraseHistory = useCallback(async (expectedVersion: number) => { if (!current() || scope.busy || scope.erasureUncertain || scope.loading || expectedVersion !== scope.snapshot?.history_version)
        return null; scope.busy = 'erase'; scope.error = null; ++scope.read; ++scope.historyRead; scope.historyLoading = false; publish(); try {
        const receipt = await eraseTimedSportQuizHistory(expectedVersion, scope.profile!);
        if (!current())
            return null;
        if (receipt.profile_id !== scope.profile)
            throw Error('identity mismatch');
        scope.history = null;
        scope.pending = null;
        await read();
        await loadHistory();
        return current() ? receipt : null;
    }
    catch {
        if (current()) {
            scope.erasureUncertain = true;
            scope.error = 'History clearing was not confirmed. Refresh, review the current history and confirm again if needed.';
            publish();
        }
        return null;
    }
    finally {
        if (current()) {
            scope.busy = null;
            publish();
        }
    } }, [current, scope, publish, read, loadHistory]);
    const visible = holder.current === scope && identityKey !== null;
    return { identityKey, profileId, snapshot: visible ? scope.snapshot : null, history: visible ? scope.history : null, loading: auth.loading || (!!identityKey && (!scope.active || scope.loading)), historyLoading: visible && scope.historyLoading, error: visible ? scope.error : null, historyError: visible ? scope.historyError : null, busy: visible ? scope.busy : null, invitationsSuppressed: visible && scope.suppressed, preferenceUncertain: visible && scope.preferenceUncertain, erasureUncertain: visible && scope.erasureUncertain, refresh, loadHistory, savePreferences, claimInvitation, skip, eraseHistory };
}
export type SportQuizState = ReturnType<typeof useSportQuiz>;
