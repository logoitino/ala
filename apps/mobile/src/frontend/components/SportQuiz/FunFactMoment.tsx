/** QUIZ-05 "Fun fact: {first name}" moment in a personal round (design §6.13; §6 overrides §1–§5).
 * The server marks a fun fact (topic 'athlete') and fills the athlete's words for this viewer only. This file shows:
 * - the header "Fun fact: {first name}" over the question and its reveal;
 * - after the reveal, the athlete's card: first name, sport and photo through the privacy-aware public profile read
 *   (`getPublicProfiles`, the same helper the profile sheets use), with initials when there is no photo. No Donate,
 *   no money words, no follow or profile link;
 * - the plain lines for a fun fact that no longer passes the server's check ("This fun fact isn’t available anymore.",
 *   with no card) and for one the athlete removed (history shows the server's "Removed by the athlete").
 * Effects reuse QuizFx `PopIn` (a plain fade with Reduce Motion). Nothing here waits before Next.
 * @sideEffects `get_public_profiles` (one read per card) through lib/privacy.
 */
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { TimedQuizQuestion, TimedQuizResult } from '@shared/timedSportQuiz';
import { getPublicProfiles } from '@/lib/privacy';
import { colors, radii } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';
import { PopIn } from './QuizFx';

export const FUN_FACT_UNAVAILABLE = 'This fun fact isn’t available anymore.';
/** The server's wording when the athlete removed a fun fact (shown as sent, in history). */
export const FUN_FACT_REMOVED = 'Removed by the athlete';

/** @purpose True when the server marked this question as a fun fact (Know your athlete). */
export function isFunFact(question: Pick<TimedQuizQuestion, 'topic_category'> | null | undefined): boolean {
    return question?.topic_category === 'athlete';
}
/** @purpose "Fun fact: {first name}", or "Fun fact" when the server sends no name. */
export function funFactTitle(question: Pick<TimedQuizQuestion, 'fun_fact'> | null | undefined): string {
    const name = question?.fun_fact?.first_name?.trim();
    return name ? `Fun fact: ${name}` : 'Fun fact';
}
/** @purpose The item closed because the fun fact no longer passes the server's check: nothing about it is shown. */
export function factUnavailable(result: Pick<TimedQuizResult, 'item_status'> | null | undefined): boolean {
    return result?.item_status === 'fact_unavailable';
}
/** The server's other wording, when the fun fact went away for an account reason (not the athlete's choice). */
const FUN_FACT_GONE = 'No longer available';
/** @purpose The server's line when a fun fact was removed ("Removed by the athlete" / "No longer available"), else null.
 * The server puts it in place of the prompt (and the explanation), so history shows it once and nothing else. */
export function factGoneText(question: Pick<TimedQuizQuestion, 'topic_category' | 'prompt'> | null | undefined): string | null {
    if (!isFunFact(question)) return null;
    const text = question!.prompt.trim().replace(/\.$/, '');
    return text === FUN_FACT_REMOVED || text === FUN_FACT_GONE ? text : null;
}

/** @purpose The header over a fun-fact question and its reveal. */
export function FunFactHeader({ question }: { question: Pick<TimedQuizQuestion, 'fun_fact'> | null | undefined }) {
    return <PopIn from="pop" style={styles.header}>
        <Text aria-hidden style={styles.headerEmoji}>⭐</Text>
        <Text accessibilityRole="header" style={styles.headerText}>{funFactTitle(question)}</Text>
    </PopIn>;
}

function initials(name: string): string {
    return name.trim().slice(0, 2).toUpperCase() || '?';
}

/** @purpose The athlete's card after a fun fact's reveal. Shown only when the server sends the card (visible fact). */
export function FunFactAthleteCard({ card }: { card: TimedQuizResult['fun_fact'] | null | undefined }) {
    const firstName = card?.first_name?.trim() ?? '';
    const playerId = card?.athlete_player_id ?? null;
    const [extra, setExtra] = useState<{ avatarUrl: string | null; sport: string | null }>({ avatarUrl: null, sport: null });
    useEffect(() => {
        if (!playerId) return;
        let live = true;
        // Photo and sport follow the athlete's privacy (profiles_public); a failed read keeps the initials.
        getPublicProfiles({ playerIds: [playerId] }).then(rows => {
            const row = rows[0];
            if (!live || !row) return;
            setExtra({ avatarUrl: row.avatar_url?.trim() || null, sport: row.athlete_sport?.trim() || null });
        }, () => {});
        return () => { live = false; };
    }, [playerId]);
    if (!firstName || !playerId) return null;
    const label = extra.sport ? `${firstName}, ${extra.sport}` : firstName;
    return <PopIn delay={180} from="up" style={styles.card}>
        <View accessible accessibilityLabel={`Fun fact shared by ${label}`} style={styles.cardRow}>
            {extra.avatarUrl
                ? <Image testID="fun-fact-photo" source={{ uri: extra.avatarUrl }} style={styles.avatar} accessibilityIgnoresInvertColors aria-hidden/>
                : <View testID="fun-fact-initials" aria-hidden style={[styles.avatar, styles.initials]}><Text style={styles.initialsText}>{initials(firstName)}</Text></View>}
            <View style={styles.cardText}>
                <Text style={styles.cardName}>{firstName}</Text>
                {extra.sport ? <Text style={styles.cardSport}>{extra.sport}</Text> : null}
                <Text style={styles.cardNote}>{`Shared by ${firstName}`}</Text>
            </View>
        </View>
    </PopIn>;
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: radii.md, borderWidth: 2, borderColor: FOCAL.electricViolet, backgroundColor: FOCAL.mistViolet },
    headerEmoji: { fontSize: 18 },
    headerText: { fontSize: 17, fontWeight: '800', color: FOCAL.violetInk },
    card: { padding: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 52, height: 52, borderRadius: 26 },
    initials: { alignItems: 'center', justifyContent: 'center', backgroundColor: FOCAL.mistViolet, borderWidth: 1, borderColor: FOCAL.electricViolet },
    initialsText: { fontSize: 18, fontWeight: '800', color: FOCAL.violetInk },
    cardText: { flexShrink: 1, gap: 2 },
    cardName: { fontSize: 17, fontWeight: '800', color: colors.text },
    cardSport: { fontSize: 14, color: colors.textMuted },
    cardNote: { fontSize: 13, color: colors.textMuted },
});
