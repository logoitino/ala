/** QUIZ-02 optional, claimed weekly invitation; never automatically starts or resumes a question (QUIZ-03: a round). */
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
export function SportQuizInvitation({ snapshot, loading, error, busy, onOpen, onSkip, onDismiss, overVideo = false }: SportQuizInvitationProps & { overVideo?: boolean }) {
    if (!snapshot || loading || error || snapshot.availability !== 'ready' || snapshot.week_spent || snapshot.preferences.invitation_mode !== 'weekly')
        return null;
    return <View style={[styles.card, overVideo && styles.cardVideo]}>
      <Text style={[styles.title, overVideo && styles.titleVideo]}>Sport Pop Quiz</Text>
      <Text style={[styles.copy, overVideo && styles.copyVideo]}>Ready for this week’s optional trivia round? Up to five questions, one at a time. Choose 30 or 90 seconds per question before Start. Right or wrong, you get the same private badge, just for fun.</Text>
      <QuizButton label="Ready for trivia" onPress={onOpen} />
      <View style={styles.row}>
        {onDismiss ? <QuizButton fill label="Not now" quiet onVideo={overVideo} onPress={onDismiss} /> : null}
        <QuizButton fill label="Skip this week" quiet onVideo={overVideo} disabled={!!busy} onPress={() => { void onSkip(); }} />
      </View>
    </View>;
}
const styles = StyleSheet.create({
  card: { gap: 8, padding: 12, borderRadius: radii.lg, backgroundColor: colors.accentSoft },
  cardVideo: { backgroundColor: 'rgba(14,19,21,0.92)', borderWidth: 1, borderColor: 'rgba(46,229,157,0.4)' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  titleVideo: { color: colors.onVideo },
  copy: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  copyVideo: { color: colors.onVideoMuted },
  row: { flexDirection: 'row', gap: 8 },
});
