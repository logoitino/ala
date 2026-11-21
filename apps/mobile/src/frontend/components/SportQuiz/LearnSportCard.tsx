/** QUIZ-03 "Learn {sport} with {first name}" card on someone else's athlete profile. Opens /sport-quiz with the sport
 * preselected for the viewer's own weekly round: no extra opportunity and no link between the athlete and the viewer's
 * answers. Hidden unless trivia is ready for this viewer and the sport has unseen approved questions.
 * QUIZ-05 copy fix (design §6.7): the athlete may see a private, bucketed monthly count for their own fun facts, never who
 * played, so the card no longer says the athlete "doesn't see it". It also passes the athlete's player id (`?athlete=`)
 * so that round can start through quiz_learn_start; the server validates it.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { learnableSport, useTriviaAvailability } from '@/hooks/useTriviaAvailability';
import { colors, radii } from '@/constants/theme';
import { SportIcon } from '@/components/UI/SportIcon';
import { FOCAL } from '@/theme/motion';
import { figtree, TYPE } from '@/theme/fonts';
import { QuizButton } from './QuizButton';

/** @purpose Visibility gate; the router is only touched once the card is actually shown. */
export function LearnSportCard({ sport, athleteName, athletePlayerId = null }: { sport: string | null | undefined; athleteName: string; athletePlayerId?: string | null }) {
    const snapshot = useTriviaAvailability();
    const learnable = learnableSport(snapshot, sport);
    const firstName = athleteName.trim().split(/\s+/)[0] ?? '';
    if (!learnable || !firstName) return null;
    return <LearnSportCardBody sport={learnable} firstName={firstName} athletePlayerId={athletePlayerId}/>;
}
function LearnSportCardBody({ sport, firstName, athletePlayerId }: { sport: string; firstName: string; athletePlayerId: string | null }) {
    const router = useRouter();
    const title = `Learn ${sport} with ${firstName}`;
    return <View style={styles.card}>
        <View style={styles.heading}><SportIcon sport={sport} size={16} color={FOCAL.violetInk} /><Text accessibilityRole="header" style={styles.title}>{title}</Text></View>
        <Text style={styles.copy}>{`A quick trivia round about ${sport}, using your own weekly round. Your answers are just for you. ${firstName} never sees who played, only a rough monthly count if one of their fun facts comes up.`}</Text>
        <QuizButton label={title} onPress={() => router.push({ pathname: '/sport-quiz', params: athletePlayerId ? { sport, athlete: athletePlayerId } : { sport } } as unknown as Href)}/>
    </View>;
}
const styles = StyleSheet.create({
    card: { gap: 8, padding: 12, marginTop: 4, borderRadius: radii.lg, backgroundColor: FOCAL.mistViolet },
    heading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { ...TYPE.section, ...figtree('700'), color: FOCAL.violetInk, flexShrink: 1 },
    copy: { ...TYPE.body, ...figtree(), color: colors.textMuted },
});
