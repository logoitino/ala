/**
 * QUIZ-01 optional sport choice, own question/result and private completion/correction history.
 * @sideEffects Own useSportQuiz RPC actions and explicit Back/account Home navigation; no automatic assignment.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/context/AuthContext';
import { useSportQuiz } from '@/hooks/useSportQuiz';
import { ROLE_HOME } from '@/lib/roles';
import { colors, radii } from '@/constants/theme';
import { QuizButton } from './QuizButton';

/** @purpose A dismissible learning view; only server-confirmed completion/skip/badges are presented as durable. */
export function SportQuizScreen() {
  const auth = useAuth(); const router = useRouter(); const quiz = useSportQuiz();
  const s = quiz.snapshot; const a = s?.attempt; const result = a?.result;
  const home = () => router.replace(ROLE_HOME[auth.role] as Href);
  const leave = () => { if (router.canGoBack()) router.back(); else home(); };
  const active = s?.availability === 'ready';
  const blocked = quiz.loading || !!quiz.busy;
  const canSkip = active && !!s && ['available', 'issued'].includes(s.status) && !quiz.pendingAnswer && !quiz.error;
  const question = a?.status === 'issued' && active ? a.question : null;
  const notice = s?.availability === 'paused' ? 'Sport Pop Quiz is paused. You can still view your private history.'
    : s?.availability === 'not_enrolled' ? 'Sport Pop Quiz is not available for this account yet.'
      : s?.availability === 'ineligible' ? 'Sport Pop Quiz is not available for this account.'
        : s?.availability === 'unavailable' ? 'Sport Pop Quiz is unavailable right now.' : null;
  return <ScreenShell edges={['top', 'bottom', 'left', 'right']}>
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.navigation}><QuizButton label="Back" quiet onPress={leave} /><QuizButton label="Account Home" quiet onPress={home} /></View>
      <Text accessibilityRole="header" style={styles.heading}>Sport Pop Quiz</Text>
      <Text style={styles.copy}>Optional weekly learning · Testing only</Text>
      <Text style={styles.copy}>One question each week. Right or wrong, completion can earn a private Sport Learner badge.</Text>
      {quiz.loading && !s ? <Text style={styles.copy}>Checking quiz availability…</Text> : null}
      {!s && !quiz.loading && !quiz.error ? <Text style={styles.copy}>Sport Pop Quiz is not available for this account. You can keep browsing.</Text> : null}
      {quiz.error ? <Text accessibilityRole="alert" style={styles.notice}>{quiz.error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {a?.unavailable_reason ? <Text style={styles.notice}>{a.unavailable_reason}</Text> : null}
      <QuizButton label="Refresh quiz" quiet disabled={!!quiz.busy} onPress={() => { void quiz.refresh(); }} />
      {s ? <>
        <Text style={styles.copy}>{`UTC week starts ${s.week_start}. The next week starts ${s.week_end}.`}</Text>
        {active && s.status === 'available' && !quiz.error ? <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.title}>Choose your sport</Text>
          {s.sports.map(sport => <QuizButton key={sport} label={`Choose ${sport}`} disabled={blocked} onPress={() => { void quiz.start(sport); }} />)}
        </View> : null}
        {question ? <View style={styles.panel}>
          <Text style={styles.title}>{question.sport}</Text><Text style={styles.question}>{question.prompt}</Text>
          {question.options.map((option, index) => <QuizButton key={index} label={`Answer ${index + 1}: ${option}`}
            disabled={blocked || quiz.pendingAnswer !== null || !!quiz.error} onPress={() => { void quiz.answer(index); }} />)}
          {quiz.pendingAnswer?.uncertain ? <>
            <Text style={styles.copy}>{`Your answer: ${question.options[quiz.pendingAnswer.option]}. Its result has not been confirmed.`}</Text>
            <QuizButton label="Retry this answer" disabled={blocked} onPress={() => { if (quiz.pendingAnswer) void quiz.answer(quiz.pendingAnswer.option); }} />
          </> : null}
        </View> : null}
        {canSkip ? <QuizButton label="Skip this week" quiet disabled={blocked} onPress={() => { void quiz.skip(); }} /> : null}
        {s.status === 'skipped' ? <Text style={styles.notice}>Skipped for this week. Come back whenever you like.</Text> : null}
        {a?.status === 'completed' && result ? <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.title}>Quiz complete</Text>
          <Text style={styles.copy}>{result.was_correct ? 'That’s right.' : 'Thanks for learning.'}</Text>
          <Text style={styles.copy}>{result.explanation}</Text>
        </View> : null}
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.title}>Your private badges</Text>
          <Text style={styles.copy}>Private, noncash completion acknowledgments.</Text>
          {s.badges.length === 0 ? <Text style={styles.copy}>No private badges to show.</Text> : s.badges.map(badge => <View key={badge.id} style={styles.badge}>
            <Text style={styles.title}>{badge.label}</Text><Text style={styles.copy}>{`Week starting ${badge.week_start}`}</Text>
          </View>)}
          {s.corrections.length ? <Text accessibilityRole="header" style={styles.title}>Corrections</Text> : null}
          {s.corrections.map(correction => <View key={correction.attempt_id}>
            <Text style={styles.copy}>{`Week starting ${correction.week_start}`}</Text><Text style={styles.copy}>{correction.reason}</Text>
          </View>)}
        </View>
      </> : null}
    </ScrollView>
  </ScreenShell>;
}
const styles = StyleSheet.create({
  page: { padding: 20, gap: 16 }, navigation: { flexDirection: 'row', gap: 12 }, heading: { color: colors.text, fontSize: 28, fontWeight: '700' },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: 16, gap: 12 },
  title: { color: colors.text, fontSize: 19, fontWeight: '600' }, copy: { color: colors.textMuted, fontSize: 16, lineHeight: 23 },
  question: { color: colors.text, fontSize: 21, lineHeight: 29 }, notice: { color: colors.text, fontSize: 16, lineHeight: 23 },
  badge: { padding: 12, borderRadius: radii.md, backgroundColor: colors.goldSoft, gap: 4 },
});
