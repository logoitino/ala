/** QUIZ-03 badge shelf and season recap for the signed-in account. Private by default: a badge shows on the
 * person's group pages only after they switch "Show to my groups" on. Identity-scoped; late replies are dropped.
 * @sideEffects quiz_badge_shelf / quiz_season_recap reads and quiz_badge_visibility writes through lib/sportQuiz.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTriviaBadgeShelf, fetchTriviaSeasonRecap, setTriviaBadgeVisibility, type TriviaBadge, type TriviaSeasonRecap } from '@/lib/sportQuiz';

type Scope = {
    key: string | null; profile: string | null; active: boolean; read: number;
    badges: TriviaBadge[] | null; recap: TriviaSeasonRecap | null; loading: boolean; error: string | null; saving: string | null;
};
/** @purpose Read the shelf and recap together; toggling one badge updates only that badge from the server's reply. */
export function useTriviaBadges(identityKey: string | null, profileId: string | null) {
    const make = (): Scope => ({ key: identityKey, profile: profileId, active: false, read: 0, badges: null, recap: null, loading: false, error: null, saving: null });
    const holder = useRef(make());
    if (holder.current.key !== identityKey || holder.current.profile !== profileId) holder.current = make();
    const scope = holder.current;
    const [, draw] = useState(0);
    const current = useCallback(() => holder.current === scope && scope.active && scope.profile !== null, [scope]);
    const publish = useCallback(() => { if (current()) draw(n => n + 1); }, [current]);
    const refresh = useCallback(async () => {
        if (!current()) return;
        const sequence = ++scope.read;
        scope.loading = true;
        publish();
        try {
            const [shelf, recap] = await Promise.all([fetchTriviaBadgeShelf(), fetchTriviaSeasonRecap()]);
            if (!current() || sequence !== scope.read) return;
            if (shelf.profile_id !== scope.profile || recap.profile_id !== scope.profile) throw Error('identity mismatch');
            scope.badges = shelf.badges;
            scope.recap = recap;
            scope.error = null;
        }
        catch {
            if (current() && sequence === scope.read) scope.error = 'Your badges didn’t load. Refresh to try again.';
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
    const setVisibility = useCallback(async (badgeId: string, visibility: 'private' | 'groups') => {
        if (!current() || scope.saving) return null;
        scope.saving = badgeId; scope.error = null;
        publish();
        try {
            const saved = await setTriviaBadgeVisibility(badgeId, visibility, scope.profile!);
            if (!current()) return null;
            scope.badges = (scope.badges ?? []).map(b => b.id === saved.id ? { ...b, visibility: saved.visibility } : b);
            return saved;
        }
        catch {
            if (current()) scope.error = 'That change wasn’t saved. Try again.';
            return null;
        }
        finally {
            if (current()) { scope.saving = null; publish(); }
        }
    }, [current, scope, publish]);
    const visible = holder.current === scope && profileId !== null;
    return { badges: visible ? scope.badges : null, recap: visible ? scope.recap : null, loading: visible && scope.loading, error: visible ? scope.error : null,
        saving: visible ? scope.saving : null, refresh, setVisibility };
}
export type TriviaBadgesState = ReturnType<typeof useTriviaBadges>;
