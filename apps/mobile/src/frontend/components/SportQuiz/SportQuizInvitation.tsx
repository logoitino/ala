/** QUIZ-01 optional weekly discovery; the consuming Home/HQ owns navigation and identity/week local dismissal. */
import { StyleSheet, Text, View } from 'react-native';
import type { QuizSnapshot } from '@/lib/sportQuiz';
import type { SportQuizBusy } from '@/hooks/useSportQuiz';
import { colors, radii } from '@/constants/theme';
import { QuizButton } from './QuizButton';

export type SportQuizInvitationProps = {
  snapshot: QuizSnapshot | null; loading: boolean; error: string | null; busy: SportQuizBusy;
  onOpen: () => void; onSkip: () => Promise<unknown>; onDismiss?: () => void;
};
/** @purpose Offer Open/Resume without starting an assignment; Not now is local, while Skip asks the server. */
export function SportQuizInvitation({ snapshot, loading, error, busy, onOpen, onSkip, onDismiss }: SportQuizInvitationProps) {
  if (!snapshot || loading || error || snapshot.availability !== 'ready' || !['available', 'issued'].includes(snapshot.status)) return null;
  return <View style={styles.card}>
    <Text style={styles.title}>Sport Pop Quiz</Text>
    <Text style={styles.copy}>One small sport question this week. Learn something new and keep a private completion badge.</Text>
    <QuizButton label={snapshot.status === 'issued' ? 'Resume quiz' : 'Open quiz'} onPress={onOpen} />
    {onDismiss ? <QuizButton label="Not now" quiet onPress={onDismiss} /> : null}
    <QuizButton label="Skip this week" quiet disabled={!!busy} onPress={() => { void onSkip(); }} />
  </View>;
}
const styles = StyleSheet.create({ card: { gap: 10, padding: 16, borderRadius: radii.lg, backgroundColor: colors.accentSoft },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' }, copy: { color: colors.textMuted, fontSize: 16, lineHeight: 23 } });
