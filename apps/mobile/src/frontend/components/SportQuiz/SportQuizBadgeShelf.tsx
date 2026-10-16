/** QUIZ-03 badge shelf (Trivia Explorer, sport explorer badges, Family Challenger, Season Learner) with a per-badge
 * "Show to my groups" switch, and the private season recap. Badges are noncash: no Aura, money, votes or reach.
 * QUIZ-04: Life Playbook chapter badges are always private, so they have no switch (the server refuses one anyway).
 */
import { Pressable, Text, View } from 'react-native';
import type { TriviaBadgesState } from '@/hooks/useTriviaBadges';
import type { TriviaBadge } from '@shared/triviaPlayTogether';
import { colors, radii } from '@/constants/theme';
import { QuizButton } from './QuizButton';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
function when(badge: TriviaBadge): string {
    if (badge.kind === 'weekly' || badge.kind === 'family') return `Week of ${badge.period}`;
    if (badge.kind === 'season') return `Season ${badge.period}`;
    if (badge.kind === 'life') return 'Life Playbook chapter badge · Only you see it';
    return badge.sport ? `5 ${badge.sport} facts learned` : 'Earned';
}
/** @purpose Private shelf plus recap; each switch is a 44-point accessible toggle that saves one badge. */
export function SportQuizBadgeShelf({ badges }: { badges: TriviaBadgesState }) {
    const list = badges.badges;
    const recap = badges.recap;
    return <View style={{ gap: 12 }}>
        <Text accessibilityRole="header">Your badges</Text>
        <Text>Badges are private unless you choose to show one to your groups. They’re just for fun: no money, Aura or votes.</Text>
        {badges.loading && !list ? <Text>Loading your badges…</Text> : null}
        {badges.error ? <Text accessibilityRole="alert">{badges.error}</Text> : null}
        {list && !list.length ? <Text>Finish a round to earn your first badge.</Text> : null}
        {list?.map(badge => {
            const shown = badge.visibility === 'groups';
            return <View key={badge.id} style={{ gap: 6, padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{badge.label}</Text>
                <Text style={{ color: colors.textMuted }}>{when(badge)}</Text>
                {badge.kind === 'life' ? null : <Pressable accessibilityRole="switch" accessibilityLabel={`Show ${badge.label} to my groups`} accessibilityState={{ checked: shown, disabled: !!badges.saving }}
                    disabled={!!badges.saving} onPress={() => { void badges.setVisibility(badge.id, shown ? 'private' : 'groups'); }}
                    style={{ minHeight: 44, justifyContent: 'center' }}>
                    <Text>{shown ? '● Shown to my groups' : '○ Show to my groups'}</Text>
                </Pressable>}
            </View>;
        })}
        <Text accessibilityRole="header">Your season</Text>
        {recap ? <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text }}>{recap.facts === 0 ? 'No facts yet this season. Your first round starts the count.' : `This season you learned ${plural(recap.facts, 'fact')} across ${plural(recap.sports, 'sport')}`}</Text>
            {recap.per_sport.map(row => <Text key={row.sport}>{`${row.sport}: ${plural(row.facts, 'fact')}`}</Text>)}
            <Text style={{ color: colors.textMuted }}>{`Season ${recap.quarter}. Only you can see this.`}</Text>
        </View> : null}
        <QuizButton label="Refresh badges" quiet disabled={badges.loading} onPress={() => { void badges.refresh(); }}/>
    </View>;
}
