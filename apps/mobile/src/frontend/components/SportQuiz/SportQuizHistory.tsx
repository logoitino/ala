/** QUIZ-02 own terminal learning/history; active prompts and public rankings never appear here. */
import { useState } from 'react';
import { Text, View } from 'react-native';
import type { SportQuizState } from '@/hooks/useSportQuiz';
import { QuizButton } from './QuizButton';
/** @purpose CAS erasure needs an explicitly reviewed revision; unknown outcomes require Refresh/reconfirmation. */
export function SportQuizHistory({ quiz, onBeforeErase }: {
    quiz: SportQuizState;
    onBeforeErase: () => void;
}) {
    const [confirmation, setConfirmation] = useState<number | null>(null);
    const s = quiz.snapshot;
    const h = quiz.history;
    return <View style={{ gap: 12 }}><Text accessibilityRole="header">Your private trivia history</Text>
 <Text>Private, noncash completion acknowledgments. Right and wrong answers have the same badge.</Text>
 {quiz.historyLoading ? <Text>Checking private history…</Text> : null}
 {quiz.historyError ? <Text accessibilityRole="alert">{quiz.historyError}</Text> : null}
 <QuizButton label="Refresh private history" quiet disabled={!!quiz.busy || quiz.historyLoading} onPress={() => { setConfirmation(null); void quiz.refresh().then(() => quiz.loadHistory()); }}/>
 {h && !h.items.length ? <Text>No retained learning history to show.</Text> : null}
 {h?.items.map(item => <View key={item.attempt.id} style={{ gap: 6 }}><Text>{`Week starting ${item.attempt.week_start} · ${item.attempt.status}`}</Text>
 {item.question ? <Text>{item.question.prompt}</Text> : null}{item.result ? <Text>{item.result.explanation}</Text> : null}
 {item.badge ? <Text>{item.badge.voided_at ? `${item.badge.label} · corrected/unavailable` : item.badge.label}</Text> : null}
 {item.attempt.correction_reason ? <Text>{item.attempt.correction_reason}</Text> : null}
 {['ended', 'expired'].includes(item.attempt.status) ? <Text>Round ended. You can keep browsing; older completion badges are unaffected.</Text> : null}</View>)}
 {h?.next_before ? <QuizButton label="More private history" quiet disabled={!!quiz.busy || quiz.historyLoading} onPress={() => { void quiz.loadHistory(true); }}/> : null}
 <Text>Clear history removes retained questions, exposure history, badges, receipts and associated participant audit. Preferences, notice acceptance and the history revision remain. This week stays spent with a minimal account/week guard for 35 days. After erasure, familiar questions may appear again.</Text>
 {quiz.erasureUncertain ? <Text accessibilityRole="alert">Clearing was not confirmed. Refresh, review the current history, then confirm again if needed.</Text> : null}
 <QuizButton label="Clear history and end this week" quiet disabled={!s || !!quiz.busy || quiz.loading || quiz.erasureUncertain} onPress={() => setConfirmation(s!.history_version)}/>
 {confirmation !== null && s && confirmation === s.history_version && !quiz.erasureUncertain ? <><Text>This cannot restore erased learning history. Confirm clearing the history you just reviewed?</Text><QuizButton label="Confirm clear history" disabled={!!quiz.busy} onPress={() => { const revision = confirmation; setConfirmation(null); onBeforeErase(); void quiz.eraseHistory(revision); }}/><QuizButton label="Keep history" quiet onPress={() => setConfirmation(null)}/></> : null}
 </View>;
}
