/** QUIZ-04 "This week" strip: the personal, group and (only when turned on) Life Playbook rounds, each with its own
 * spot this week. Every state is written out in words (never colour alone). No streaks, counts of weeks or pressure:
 * missing a week costs nothing, and group play never uses up the player's own round.
 */
import type { RefObject } from 'react';
import { Text, View, type TextInstance } from 'react-native';
import type { TimedQuizSnapshot } from '@shared/timedSportQuiz';
import type { LifeSnapshot } from '@shared/lifePlaybook';
import { colors, radii } from '@/constants/theme';
import { figtree, TYPE } from '@/theme/fonts';

export type AllowanceState = 'ready' | 'played' | 'skipped' | 'none_left' | 'unavailable';
const WORDS: Record<AllowanceState, string> = {
    ready: 'Ready to play',
    played: 'Played this week',
    skipped: 'Skipped this week',
    none_left: 'No new questions right now',
    unavailable: 'Not available right now',
};
/** @purpose The personal round's state from the trivia snapshot (QUIZ-04 personal guard). */
export function personalAllowance(s: TimedQuizSnapshot): AllowanceState {
    const spent = s.week_spent_by_kind ? s.week_spent_by_kind.personal : s.week_spent;
    if (spent) return s.attempt?.status === 'skipped' && (s.attempt.round_kind ?? 'personal') === 'personal' ? 'skipped' : 'played';
    return s.availability === 'ready' ? 'ready' : 'unavailable';
}
/** @purpose The group round's state; it has its own weekly spot on QUIZ-04 servers. */
export function groupAllowance(s: TimedQuizSnapshot): AllowanceState {
    if (s.week_spent_by_kind?.group) return 'played';
    return s.groups_available ? 'ready' : 'unavailable';
}
/** @purpose The Life round's state from the account's own Life snapshot. */
export function lifeAllowance(l: LifeSnapshot): AllowanceState {
    if (l.week_spent) return 'played';
    if (l.availability === 'ready') return 'ready';
    return l.availability === 'empty' ? 'none_left' : 'unavailable';
}

function Row({ name, state }: { name: string; state: AllowanceState }) {
    const words = WORDS[state];
    // Wraps onto two lines at large text sizes instead of clipping.
    return <View accessible accessibilityLabel={`${name}: ${words}`} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12, rowGap: 4, minHeight: 44,
        alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <Text style={{ ...TYPE.body, ...figtree('600'), flexShrink: 1, color: colors.text }}>{name}</Text>
        <Text style={{ ...TYPE.body, ...figtree(), flexShrink: 1, color: colors.text }}>{state === 'ready' ? `● ${words}` : `○ ${words}`}</Text>
    </View>;
}

/** @purpose One row per weekly round; the Life row appears only when the account has Life turned on. `headerRef` lets
 * the screen return a screen reader here after "Back to this week's rounds". */
export function SportQuizAllowances({ snapshot, life, headerRef }: { snapshot: TimedQuizSnapshot; life: LifeSnapshot | null; headerRef?: RefObject<TextInstance | null> }) {
    return <View style={{ gap: 8 }}>
        <Text ref={headerRef} accessibilityRole="header" style={{ ...TYPE.section, ...figtree('700'), color: colors.text }}>This week</Text>
        <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>Each kind of round has its own spot this week. Group play never uses up your own round.</Text>
        <Row name="Your round" state={personalAllowance(snapshot)}/>
        <Row name="Group round" state={groupAllowance(snapshot)}/>
        {life ? <Row name="Life Playbook round" state={lifeAllowance(life)}/> : null}
        <Text style={{ ...TYPE.body, ...figtree(), color: colors.textMuted }}>Play when you like. Missing a week never costs you anything.</Text>
    </View>;
}
