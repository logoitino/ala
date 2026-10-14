/** QUIZ-02 optional, claimed weekly invitation; never automatically starts or resumes a question. */
import { StyleSheet, Text, View } from 'react-native';
import type { TimedQuizSnapshot } from '@shared/timedSportQuiz';
import type { SportQuizBusy } from '@/hooks/useSportQuiz';
import { colors, radii } from '@/constants/theme';
import { QuizButton } from './QuizButton';
export type SportQuizInvitationProps = {
    snapshot: TimedQuizSnapshot | null;
    loading: boolean;
    error: string | null;
    busy: SportQuizBusy;
    onOpen: () => void;
    onSkip: () => Promise<unknown>;
    onDismiss?: () => void;
};
/** @purpose Ready opens preparation; Not now is local, while Skip explicitly spends this week. */
export function SportQuizInvitation({ snapshot, loading, error, busy, onOpen, onSkip, onDismiss }: SportQuizInvitationProps) {
    if (!snapshot || loading || error || snapshot.availability !== 'ready' || snapshot.week_spent || snapshot.preferences.invitation_mode !== 'weekly')
        return null;
    return <View style={styles.card}><Text style={styles.title}>Sport Pop Quiz</Text><Text style={styles.copy}>Ready for one optional question? Choose 30 or 90 seconds before Start. Right or wrong, completion earns a private noncash badge.</Text>
 <QuizButton label="Ready for trivia" onPress={onOpen}/>{onDismiss ? <QuizButton label="Not now" quiet onPress={onDismiss}/> : null}<QuizButton label="Skip this week" quiet disabled={!!busy} onPress={() => { void onSkip(); }}/></View>;
}
const styles = StyleSheet.create({ card: { gap: 10, padding: 16, borderRadius: radii.lg, backgroundColor: colors.accentSoft }, title: { color: colors.text, fontSize: 20, fontWeight: '700' }, copy: { color: colors.textMuted, fontSize: 16, lineHeight: 23 } });
