/** QUIZ-03 synthetic wire fixtures for rounds of up to five, groups, badges and recap. No account data; every shape
 * passes the real lib/sportQuiz validators so tests exercise the actual hook, SDK and screens.
 */
import type { TimedQuizAttemptSummary, TimedQuizQuestion, TimedQuizReceipt, TimedQuizResult, TimedQuizSnapshot, TimedQuizStartReceipt } from '@shared/timedSportQuiz';
import type { TriviaBadge, TriviaBadgeShelf, TriviaGroupPage, TriviaMyGroups, TriviaSeasonRecap } from '@shared/triviaPlayTogether';
import { quizNow, quizSnapshot } from './timedSportQuizFixtures';

/** @purpose A ready snapshot with rounds of five and group play switched on. */
export const roundSnapshot: TimedQuizSnapshot = { ...quizSnapshot, round_size: 5, groups_available: true,
    pools: [{ topic_category: 'sport', sport: 'Basketball', unseen_count: 8, allowed: true }, { topic_category: 'sport', sport: 'American football', unseen_count: 2, allowed: true }] };
const plus = (seconds: number) => new Date(Date.parse(quizNow) + seconds * 1000).toISOString();
/** @purpose Five synthetic questions; position 2 is true/false. */
export function roundQuestion(position: number, type: TimedQuizQuestion['question_type'] = position === 2 ? 'true_false' : 'choice4'): TimedQuizQuestion {
    return type === 'true_false'
        ? { id: `question-${position}`, question_key: `family-${position}`, version: 1, topic_category: 'sport', sport: 'Basketball', prompt: `True or false: fact number ${position} about basketball.`, options: ['True', 'False'], question_type: 'true_false' }
        : { id: `question-${position}`, question_key: `family-${position}`, version: 1, topic_category: 'sport', sport: 'Basketball', prompt: `Question number ${position} about basketball rules?`, options: ['One', 'Two', 'Three', 'Four'], question_type: type };
}
/** @purpose The round attempt summary at a position and state. */
export function roundAttempt(over: Partial<TimedQuizAttemptSummary> = {}): TimedQuizAttemptSummary {
    return { id: 'round-a', week_start: quizSnapshot.week_start, mode: 'round', status: 'issued', started_at: quizNow, expires_at: plus(30), duration_seconds: 30,
        closed_at: null, close_reason: null, effective_expired: false, correction_reason: null, round_state: 'item', position: 1, planned_items: 5, round_size: 5,
        next_by: null, answered_count: 0, short_round: false, group_id: null, ...over };
}
/** @purpose A closed item's private result (correct answer is option 1 / "False" for true/false). */
export function roundResult(position: number, option: number | null, status: TimedQuizResult['item_status'] = option === null ? 'expired' : 'answered'): TimedQuizResult {
    return { answered_option: option, correct_option: 1, was_correct: option === null ? null : option === 1, explanation: `Explanation for fact ${position}: it is the second choice.`,
        completed_at: option === null ? null : quizNow, position, item_status: status };
}
function receipt(operation: TimedQuizReceipt['operation'], request: string, outcome: string, attempt: TimedQuizAttemptSummary | null, result: TimedQuizResult | null): TimedQuizReceipt {
    return { contract_version: 2, profile_id: 'profile-a', request_id: request, operation, outcome, week_start: quizSnapshot.week_start, committed_at: quizNow, attempt, result, preferences: null };
}
/** @purpose Start (or a group start) issuing question 1 of `planned`. */
export function roundStart(request: string, planned = 5, type?: TimedQuizQuestion['question_type'], group: string | null = null): TimedQuizStartReceipt {
    return { ...receipt('start', request, 'started', roundAttempt({ planned_items: planned, short_round: planned < 5, group_id: group }), null), server_now: quizNow,
        active_question: roundQuestion(1, type), active_item: { position: 1, planned_items: planned, expires_at: plus(30) } };
}
/** @purpose Next issuing `position`. */
export function roundNext(request: string, position: number, planned = 5): TimedQuizStartReceipt {
    return { ...receipt('next', request, 'issued', roundAttempt({ position, planned_items: planned, short_round: planned < 5 }), null), server_now: quizNow,
        active_question: roundQuestion(position), active_item: { position, planned_items: planned, expires_at: plus(30) } };
}
/** @purpose Answer receipt: 'answered' (waits for Next) or, on the last item, 'completed'. */
export function roundAnswer(request: string, option: number, position: number, planned = 5, answered = position): TimedQuizReceipt {
    const last = position >= planned;
    return last
        ? receipt('answer', request, 'completed', roundAttempt({ status: 'completed', round_state: null, position, planned_items: planned, short_round: planned < 5, closed_at: quizNow, close_reason: 'answered', answered_count: answered }), roundResult(position, option))
        : receipt('answer', request, 'answered', roundAttempt({ round_state: 'between', position, planned_items: planned, short_round: planned < 5, next_by: plus(150), answered_count: answered }), roundResult(position, option));
}
/** @purpose Receipt read after an item ran out of time: the round waits for Next with the expired item's explanation. */
export function roundExpiredReceipt(request: string, position: number, operation: TimedQuizReceipt['operation'] = 'start'): TimedQuizReceipt {
    return receipt(operation, request, operation === 'start' ? 'started' : 'issued', roundAttempt({ round_state: 'between', position, next_by: plus(150), effective_expired: true }), roundResult(position, null));
}
/** @purpose Any operation's plain receipt (End etc.). */
export function roundPlain(operation: TimedQuizReceipt['operation'], request: string, outcome: string): TimedQuizReceipt {
    return receipt(operation, request, outcome, null, null);
}

/** @purpose A group page as its creator sees it (member_ref present) or as a member (null). */
export function groupPage(over: Partial<TriviaGroupPage> = {}, owner = true): TriviaGroupPage {
    return { contract_version: 3, group_id: 'group-a', name_key: 'family', theme_sport: null, status: 'active', is_owner: owner, week_start: quizSnapshot.week_start,
        members: [
            { member_ref: owner ? 'a'.repeat(32) : null, display_name: 'Lani', is_owner: true, is_me: owner, played_this_week: true, badges: ['Trivia Explorer'] },
            { member_ref: owner ? 'b'.repeat(32) : null, display_name: 'Sione', is_owner: false, is_me: !owner, played_this_week: false, badges: [] },
        ],
        totals: { members: 2, played_this_week: 1, facts_this_week: null, facts_this_season: null },
        everyone_played: false, code_active: true, code_expires_at: owner ? plus(7 * 86400) : null, can_invite: owner, outcome: 'member', ...over };
}
/** @purpose The caller's groups list. */
export function myGroups(groups: TriviaMyGroups['groups'] = [], enabled = true): TriviaMyGroups {
    return { contract_version: 3, profile_id: 'profile-a', week_start: quizSnapshot.week_start, groups_enabled: enabled, groups, removed: [],
        limits: { created: groups.filter(g => g.is_owner).length, create_limit: 3, belong: groups.length, belong_limit: 5, max_members: 12 } };
}
/** @purpose Two badges: a weekly explorer and a sport explorer. */
export const shelfBadges: TriviaBadge[] = [
    { id: 'badge-w', label: 'Trivia Explorer', kind: 'weekly', sport: null, period: quizSnapshot.week_start, visibility: 'private', issued_at: quizNow },
    { id: 'badge-s', label: 'Basketball Explorer', kind: 'sport', sport: 'Basketball', period: 'lifetime', visibility: 'groups', issued_at: quizNow },
];
/** @purpose Shelf wrapper. */
export function badgeShelf(badges = shelfBadges): TriviaBadgeShelf { return { contract_version: 3, profile_id: 'profile-a', badges }; }
/** @purpose A season with 7 facts across 2 sports. */
export const seasonRecap: TriviaSeasonRecap = { contract_version: 3, profile_id: 'profile-a', quarter: '2026-Q4', starts_on: '2026-10-01', ends_before: '2027-01-01',
    facts: 7, sports: 2, rounds: 2, badges: 2, per_sport: [{ sport: 'Basketball', facts: 5 }, { sport: 'Rugby', facts: 2 }], per_topic: [{ topic_category: 'sport', facts: 7 }] };
