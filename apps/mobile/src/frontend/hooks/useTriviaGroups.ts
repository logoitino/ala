/** QUIZ-03 family challenge state: my groups, one open group page, and the create / join / leave / remove / renew /
 * theme / report actions. Identity-scoped like useSportQuiz: an account switch drops every pending response.
 * A join refusal is one ordinary message whatever the reason; codes are shown once and kept only in memory.
 * @sideEffects Group RPCs through lib/sportQuiz (no direct database calls, no storage of codes).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import {
    createTriviaGroup, fetchMyTriviaGroups, fetchTriviaGroup, joinTriviaGroup, leaveTriviaGroup, removeTriviaGroupMember,
    renewTriviaGroupCode, reportTriviaGroup, setTriviaGroupTheme,
    type TriviaGroupName, type TriviaGroupPage, type TriviaGroupRemoved, type TriviaMyGroups, type TriviaReportReason,
} from '@/lib/sportQuiz';

/** The single message every join refusal shows (wrong, expired, full, removed, blocked or a teen rule). */
export const TRIVIA_JOIN_REFUSED = 'That code didn’t work. Check it with the person who shared it.';
export type TriviaShownCode = { groupId: string; code: string; expiresAt: string | null };
type Busy = 'create' | 'join' | 'leave' | 'remove' | 'renew' | 'theme' | 'report' | null;
type Scope = {
    key: string | null; profile: string | null; active: boolean; read: number; pageRead: number;
    mine: TriviaMyGroups | null; page: TriviaGroupPage | TriviaGroupRemoved | null; openId: string | null;
    loading: boolean; error: string | null; notice: string | null; busy: Busy;
    code: TriviaShownCode | null; createRequest: { id: string; name: TriviaGroupName } | null;
};
/** Ordinary, readable messages for the backend's named refusals; anything else stays honest and generic. */
function friendly(error: unknown, fallback: string): string {
    const name = error instanceof Error ? error.message.trim() : '';
    switch (name) {
        case 'quiz_groups_paused': return 'Groups are paused right now. Your groups are safe.';
        case 'quiz_group_try_limit': return 'Too many codes tried today. Try again tomorrow.';
        case 'quiz_group_join_limit': return 'You’ve joined the most groups allowed for today. Try again tomorrow.';
        case 'quiz_group_member_limit': return 'You’re already in 5 groups. Leave one to join or make another.';
        case 'quiz_group_create_limit': return 'You’ve made 3 groups already. Leave one to make another.';
        case 'quiz_group_full': return 'This group is full (12 people), so it can’t have a new code.';
        case 'quiz_group_theme_invalid': return 'That sport has no questions yet. Pick another theme.';
        case 'quiz_group_report_limit': return 'You’ve sent the most reports allowed for today. Support can still help.';
        case 'quiz_group_not_owner': return 'Only the person who made the group can do that.';
        case 'quiz_group_not_member': return 'You’re not in this group anymore.';
        default: return fallback;
    }
}
/** @purpose One group area per signed-in identity; late responses from an earlier identity or page are ignored. */
export function useTriviaGroups(identityKey: string | null, profileId: string | null) {
    const make = (): Scope => ({ key: identityKey, profile: profileId, active: false, read: 0, pageRead: 0, mine: null, page: null, openId: null,
        loading: false, error: null, notice: null, busy: null, code: null, createRequest: null });
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
            const mine = await fetchMyTriviaGroups();
            if (!current() || sequence !== scope.read) return;
            if (mine.profile_id !== scope.profile) throw Error('identity mismatch');
            scope.mine = mine;
            scope.error = null;
        }
        catch {
            if (current() && sequence === scope.read) scope.error = 'Your groups didn’t load. Refresh to try again.';
        }
        finally {
            if (current() && sequence === scope.read) { scope.loading = false; publish(); }
        }
    }, [current, scope, publish]);
    const loadPage = useCallback(async (groupId: string) => {
        if (!current()) return;
        const sequence = ++scope.pageRead;
        try {
            const page = await fetchTriviaGroup(groupId);
            if (!current() || sequence !== scope.pageRead || scope.openId !== groupId) return;
            scope.page = page;
            scope.error = null;
        }
        catch (error) {
            if (current() && sequence === scope.pageRead) scope.error = friendly(error, 'This group didn’t load. Refresh to try again.');
        }
        finally {
            if (current() && sequence === scope.pageRead) publish();
        }
    }, [current, scope, publish]);
    useEffect(() => {
        scope.active = true;
        if (scope.profile) void refresh();
        return () => { scope.active = false; ++scope.read; ++scope.pageRead; scope.code = null; };
    }, [scope, refresh]);
    const open = useCallback((groupId: string) => {
        if (!current()) return;
        scope.openId = groupId; scope.page = null; scope.notice = null; scope.error = null;
        if (scope.code?.groupId !== groupId) scope.code = null;
        publish();
        void loadPage(groupId);
    }, [current, scope, publish, loadPage]);
    const close = useCallback(() => {
        if (!current()) return;
        ++scope.pageRead; scope.openId = null; scope.page = null; scope.code = null; scope.notice = null;
        publish();
        void refresh();
    }, [current, scope, publish, refresh]);
    /** Run one action at a time; a refusal shows its ordinary message, never a guess about what happened. */
    const run = useCallback(async <T,>(busy: Exclude<Busy, null>, work: () => Promise<T>, fallback: string): Promise<T | null> => {
        if (!current() || scope.busy) return null;
        scope.busy = busy; scope.error = null; scope.notice = null;
        publish();
        try {
            const value = await work();
            return current() ? value : null;
        }
        catch (error) {
            if (current()) scope.error = friendly(error, fallback);
            return null;
        }
        finally {
            if (current()) { scope.busy = null; publish(); }
        }
    }, [current, scope, publish]);
    const create = useCallback(async (name: TriviaGroupName) => {
        if (!current()) return null;
        // An unconfirmed create keeps its request UUID, so retrying the same name cannot make a second group.
        if (!scope.createRequest || scope.createRequest.name !== name) {
            try { scope.createRequest = { id: randomUUID(), name }; } catch { return null; }
        }
        const request = scope.createRequest;
        const page = await run('create', () => createTriviaGroup(request.name, null, request.id, scope.profile!), 'Your group wasn’t confirmed. Try again; it won’t make a second group.');
        if (!page) return null;
        scope.createRequest = null;
        scope.openId = page.group_id; scope.page = page;
        scope.code = page.code ? { groupId: page.group_id, code: page.code, expiresAt: page.code_expires_at } : null;
        scope.notice = page.code ? 'Your group is ready. Share the code with your family or friends.' : 'Your group is ready. Make a new code to share it.';
        publish();
        void refresh();
        return page;
    }, [current, scope, run, publish, refresh]);
    const join = useCallback(async (code: string) => {
        const clean = code.trim();
        if (!clean) return null;
        const result = await run('join', () => joinTriviaGroup(clean, scope.profile!), 'Joining wasn’t confirmed. Refresh your groups to check.');
        if (!result) return null;
        if (result.outcome === 'refused' || !result.group) {
            scope.error = TRIVIA_JOIN_REFUSED;
            publish();
            return result;
        }
        scope.openId = result.group.group_id; scope.page = result.group; scope.notice = 'You’re in! Play this week’s round from the group page.';
        publish();
        void refresh();
        return result;
    }, [scope, run, publish, refresh]);
    const leave = useCallback(async (groupId: string) => {
        const result = await run('leave', () => leaveTriviaGroup(groupId, scope.profile!), 'Leaving wasn’t confirmed. Refresh to check.');
        if (!result) return null;
        scope.openId = null; scope.page = null; scope.code = null; scope.notice = 'You left the group.';
        publish();
        void refresh();
        return result;
    }, [scope, run, publish, refresh]);
    const remove = useCallback(async (groupId: string, memberRef: string) => {
        const page = await run('remove', () => removeTriviaGroupMember(groupId, memberRef, scope.profile!), 'Removing wasn’t confirmed. Refresh the group to check.');
        if (!page) return null;
        scope.page = page;
        scope.code = page.code ? { groupId, code: page.code, expiresAt: page.code_expires_at } : null;
        scope.notice = page.code ? 'Removed. The old code stopped working; here is a new one.' : 'Removed.';
        publish();
        return page;
    }, [scope, run, publish]);
    const renew = useCallback(async (groupId: string) => {
        const receipt = await run('renew', () => renewTriviaGroupCode(groupId, scope.profile!), 'A new code wasn’t confirmed. Try again.');
        if (!receipt) return null;
        scope.code = { groupId, code: receipt.code, expiresAt: receipt.expires_at };
        scope.notice = 'New code ready. The old one no longer works.';
        publish();
        void loadPage(groupId);
        return receipt;
    }, [scope, run, publish, loadPage]);
    const setTheme = useCallback(async (groupId: string, theme: string | null) => {
        const page = await run('theme', () => setTriviaGroupTheme(groupId, theme, scope.profile!), 'The theme wasn’t saved. Try again.');
        if (!page) return null;
        scope.page = page;
        scope.notice = 'Theme saved. If this week’s questions were already picked, the new theme starts next week.';
        publish();
        return page;
    }, [scope, run, publish]);
    const report = useCallback(async (groupId: string, reason: TriviaReportReason) => {
        const receipt = await run('report', () => reportTriviaGroup(groupId, reason, scope.profile!), 'Your report wasn’t confirmed. Try again or contact Support.');
        if (!receipt) return null;
        scope.notice = 'Thanks. Our safety team will look at this group.';
        publish();
        return receipt;
    }, [scope, run, publish]);
    const visible = holder.current === scope && profileId !== null;
    return {
        mine: visible ? scope.mine : null, page: visible ? scope.page : null, openId: visible ? scope.openId : null, loading: visible && scope.loading,
        error: visible ? scope.error : null, notice: visible ? scope.notice : null, busy: visible ? scope.busy : null, code: visible ? scope.code : null,
        refresh, open, close, reloadPage: loadPage, create, join, leave, remove, renew, setTheme, report,
    };
}
export type TriviaGroupsState = ReturnType<typeof useTriviaGroups>;
