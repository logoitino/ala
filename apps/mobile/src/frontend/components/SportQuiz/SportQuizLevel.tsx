/** QUIZ-04 "Your level": one personal ladder (Rookie → Varsity → All-Star → Pro → Hall of Fame) from facts learned in
 * every kind of round. Shows the server's highest-reached level and progress to the next one. Private: no ranks,
 * other players or comparisons, and nothing about right answers or speed.
 */
import { Text, View } from 'react-native';
import type { TriviaLevelState } from '@/hooks/useTriviaLevel';
import { LIFE_LEVEL_LABELS } from '@shared/lifePlaybook';
import { colors, radii } from '@/constants/theme';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** @purpose Share of the way from this level's threshold to the next (0–1); 1 at the top level. */
export function levelProgress(level: { level: keyof typeof LIFE_LEVEL_LABELS; facts: number; next_at: number | null; thresholds: Record<string, number> }): number {
    if (level.next_at === null) return 1;
    const from = level.thresholds[level.level] ?? 0;
    const span = level.next_at - from;
    return span <= 0 ? 0 : Math.max(0, Math.min(1, (level.facts - from) / span));
}

/** @purpose The level card, or nothing while the level is not switched on. */
export function SportQuizLevel({ state }: { state: TriviaLevelState }) {
    const level = state.level;
    if (state.switchedOff || (!level && !state.error && !state.loading)) return null;
    return <View style={{ gap: 8 }}>
        <Text accessibilityRole="header">Your level</Text>
        {state.loading && !level ? <Text>Loading your level…</Text> : null}
        {state.error ? <Text accessibilityRole="alert">{state.error}</Text> : null}
        {level ? <View style={{ gap: 8, padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{level.level_label}</Text>
            <Text>{`${plural(level.facts, 'fact')} learned`}</Text>
            {level.next_level !== null && level.next_at !== null ? <>
                <View accessible accessibilityRole="progressbar" accessibilityLabel={`Progress to ${LIFE_LEVEL_LABELS[level.next_level]}`}
                    accessibilityValue={{ min: 0, max: 100, now: Math.round(levelProgress(level) * 100) }}
                    style={{ height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.round(levelProgress(level) * 100)}%`, height: '100%', backgroundColor: colors.primary }}/>
                </View>
                <Text>{`${plural(Math.max(0, level.next_at - level.facts), 'more fact')} to ${LIFE_LEVEL_LABELS[level.next_level]}`}</Text>
            </> : <Text>{`You’ve reached ${level.level_label}, the top level.`}</Text>}
            <Text style={{ color: colors.textMuted }}>Every answered question in any round counts, right or wrong. Levels never go down. Only you see your level.</Text>
        </View> : null}
    </View>;
}
