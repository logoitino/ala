/** QUIZ-03 "Learn {sport} with {first name}" card on someone else's athlete profile. Opens /sport-quiz with the sport
 * preselected for the viewer's own weekly round: no extra opportunity, no link between the athlete and the viewer's
 * answers, and nothing is shown to the athlete. Hidden unless trivia is ready for this viewer and the sport has
 * unseen approved questions.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { learnableSport, useTriviaAvailability } from '@/hooks/useTriviaAvailability';
import { colors, radii } from '@/constants/theme';
import { QuizButton } from './QuizButton';

/** @purpose Visibility gate; the router is only touched once the card is actually shown. */
export function LearnSportCard({ sport, athleteName }: { sport: string | null | undefined; athleteName: string }) {
    const snapshot = useTriviaAvailability();
    const learnable = learnableSport(snapshot, sport);
    const firstName = athleteName.trim().split(/\s+/)[0] ?? '';
    if (!learnable || !firstName) return null;
    return <LearnSportCardBody sport={learnable} firstName={firstName}/>;
}
function LearnSportCardBody({ sport, firstName }: { sport: string; firstName: string }) {
    const router = useRouter();
    const title = `Learn ${sport} with ${firstName}`;
    return <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.copy}>{`A quick trivia round about ${sport}, using your own weekly round. Just for you: ${firstName} doesn’t see it.`}</Text>
        <QuizButton label={title} onPress={() => router.push({ pathname: '/sport-quiz', params: { sport } } as unknown as Href)}/>
    </View>;
}
const styles = StyleSheet.create({
    card: { gap: 8, padding: 16, marginHorizontal: 16, marginTop: 12, borderRadius: radii.lg, backgroundColor: colors.accentSoft },
    title: { color: colors.text, fontSize: 18, fontWeight: '700' },
    copy: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
});
