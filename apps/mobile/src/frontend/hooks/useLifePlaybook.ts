/** QUIZ-04 Life Playbook participant state for the signed-in account: the Life snapshot, the age-allowed chapters the
 * server returns, own chapter progress, and the private opt-in (Turn on / Turn off with its own CAS version).
 * A missing migration or RPC ("not switched on") hides every Life piece quietly; other failures keep honest retry
 * wording that never names Life, so nothing teases a feature this account cannot see. Identity-scoped; late replies
 * are dropped.
 * @sideEffects quiz_life_snapshot / quiz_life_chapters / quiz_life_progress reads and quiz_life_preferences writes
 *   through lib/lifePlaybook; no telemetry, storage or payment calls.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { NOT_SWITCHED_ON } from '@/lib/rpc';
import { fetchLifeChapters, fetchLifeProgress, fetchLifeSnapshot, saveLifePreferences } from '@/lib/lifePlaybook';
import type { LifeChapters, LifeProgress, LifeSnapshot } from '@shared/lifePlaybook';

type Scope = {
    key: string | null; profile: string | null; active: boolean; read: number;
    snapshot: LifeSnapshot | null; chapters: LifeChapters | null; progress: LifeProgress | null;
    switchedOff: boolean; loading: boolean; error: string | null; saving: boolean; saveError: string | null;
    /** Plain confirmation after the person's own Turn on / Turn off, read out by the screen's live region. */
    notice: string | null;
};
/** @purpose Retry wording for a failed read; it never says "Life" because Life may be hidden for this account. */
export const LIFE_READ_ERROR = 'Part of this page didn’t load. Check your connection and tap Refresh quiz to try again.';
const notSwitchedOn = (e: unknown) => e instanceof Error && e.message === NOT_SWITCHED_ON;

/** @purpose Life is shown only when the server says it is available (or the account already opted in and may turn it off). */
export function lifeVisible(s: LifeSnapshot | null): boolean {
    if (!s || !s.profile_id) return false;
    return ['not_opted_in', 'ready', 'empty'].includes(s.availability) || s.preferences?.life_opt_in === true;
}
/** @purpose The account has turned Life on and the server can serve it now (chapters and Start may show). */
export function lifeOn(s: LifeSnapshot | null): boolean {
    return !!s && !!s.profile_id && s.preferences?.life_opt_in === true && (s.availability === 'ready' || s.availability === 'empty');
}

/** @purpose Read the snapshot first; chapters and progress only once the account has opted in and Life can be served. */
export function useLifePlaybook(identityKey: string | null, profileId: string | null) {
    const make = (): Scope => ({ key: identityKey, profile: profileId, active: false, read: 0, snapshot: null, chapters: null, progress: null,
        switchedOff: false, loading: false, error: null, saving: false, saveError: null, notice: null });
    const holder = useRef(make());
    if (holder.current.key !== identityKey || holder.current.profile !== profileId) holder.current = make();
    const scope = holder.current;
    const [, draw] = useState(0);
    const current = useCallback(() => holder.current === scope && scope.active && scope.profile !== null, [scope]);
    const publish = useCallback(() => { if (current()) draw(n => n + 1); }, [current]);
    const refresh = useCallback(async () => {
        if (!current() || scope.switchedOff) return;
        const sequence = ++scope.read;
        scope.loading = true;
        publish();
        try {
            const snapshot = await fetchLifeSnapshot();
            if (!current() || sequence !== scope.read) return;
            if (snapshot.profile_id !== null && snapshot.profile_id !== scope.profile) throw Error('identity mismatch');
            let chapters: LifeChapters | null = null;
            let progress: LifeProgress | null = null;
            if (lifeOn(snapshot)) {
                [chapters, progress] = await Promise.all([fetchLifeChapters(), fetchLifeProgress()]);
                if (!current() || sequence !== scope.read) return;
                if (chapters.profile_id !== scope.profile || progress.profile_id !== scope.profile) throw Error('identity mismatch');
            }
            scope.snapshot = snapshot;
            scope.chapters = chapters;
            scope.progress = progress;
            scope.error = null;
        }
        catch (e) {
            if (!current() || sequence !== scope.read) return;
            if (notSwitchedOn(e)) {
                // The Life migration is not applied: hide everything and stop asking.
                scope.switchedOff = true;
                scope.snapshot = null; scope.chapters = null; scope.progress = null; scope.error = null;
            }
            else scope.error = LIFE_READ_ERROR;
        }
        finally {
            if (current() && sequence === scope.read) { scope.loading = false; publish(); }
        }
    }, [current, scope, publish]);
    useEffect(() => {
        scope.active = true;
        if (scope.profile) void refresh();
        return () => { scope.active = false; ++scope.read; };
    }, [scope, refresh]);
    /** @purpose Turn on (sends the Life notice version) or Turn off (ends an open Life round on the server). */
    const setOptIn = useCallback(async (optIn: boolean) => {
        const s = scope.snapshot;
        if (!current() || scope.saving || !s?.profile_id) return null;
        scope.saving = true; scope.saveError = null; scope.notice = null;
        publish();
        try {
            const receipt = await saveLifePreferences(optIn, s.preferences?.life_version ?? 0, scope.profile!);
            if (!current()) return null;
            scope.snapshot = { ...s, preferences: receipt.preferences };
            scope.notice = optIn ? 'Life Playbook is on.' : 'Life Playbook is off.';
            scope.saving = false;
            publish();
            void refresh();
            return receipt;
        }
        catch (e) {
            if (current()) scope.saveError = notSwitchedOn(e) ? 'This setting isn’t switched on yet. Nothing was changed.'
                : optIn ? 'Life Playbook wasn’t turned on. Check your connection and try again.' : 'Life Playbook wasn’t turned off. Check your connection and try again.';
            return null;
        }
        finally {
            if (current()) { scope.saving = false; publish(); }
        }
    }, [current, scope, publish, refresh]);
    const visible = holder.current === scope && profileId !== null;
    return { snapshot: visible ? scope.snapshot : null, chapters: visible ? scope.chapters : null, progress: visible ? scope.progress : null,
        switchedOff: visible && scope.switchedOff, loading: visible && scope.loading, error: visible ? scope.error : null,
        saving: visible && scope.saving, saveError: visible ? scope.saveError : null, notice: visible ? scope.notice : null, refresh, setOptIn };
}
export type LifePlaybookState = ReturnType<typeof useLifePlaybook>;
