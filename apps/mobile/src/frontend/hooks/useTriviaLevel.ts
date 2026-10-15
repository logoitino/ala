/** QUIZ-04 personal level for the signed-in account (Rookie → Hall of Fame), from facts learned across every round
 * kind. The server keeps the highest level reached, so this hook only reads it; it never compares with anyone.
 * A missing migration ("not switched on") hides the level quietly; other failures keep honest retry wording.
 * @sideEffects One quiz_level read per identity (and on refresh) through lib/lifePlaybook.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { NOT_SWITCHED_ON } from '@/lib/rpc';
import { fetchTriviaLevel } from '@/lib/lifePlaybook';
import type { TriviaLevel } from '@shared/lifePlaybook';

type Scope = { key: string | null; profile: string | null; active: boolean; read: number; level: TriviaLevel | null; switchedOff: boolean; loading: boolean; error: string | null };

/** @purpose Identity-scoped level read; late replies from an earlier account or read are dropped. */
export function useTriviaLevel(identityKey: string | null, profileId: string | null) {
    const make = (): Scope => ({ key: identityKey, profile: profileId, active: false, read: 0, level: null, switchedOff: false, loading: false, error: null });
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
            const level = await fetchTriviaLevel();
            if (!current() || sequence !== scope.read) return;
            if (level.profile_id !== scope.profile) throw Error('identity mismatch');
            scope.level = level;
            scope.error = null;
        }
        catch (e) {
            if (!current() || sequence !== scope.read) return;
            if (e instanceof Error && e.message === NOT_SWITCHED_ON) { scope.switchedOff = true; scope.level = null; scope.error = null; }
            else scope.error = 'Your level didn’t load. Tap Refresh quiz to try again.';
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
    const visible = holder.current === scope && profileId !== null;
    return { level: visible ? scope.level : null, switchedOff: visible && scope.switchedOff, loading: visible && scope.loading, error: visible ? scope.error : null, refresh };
}
export type TriviaLevelState = ReturnType<typeof useTriviaLevel>;
