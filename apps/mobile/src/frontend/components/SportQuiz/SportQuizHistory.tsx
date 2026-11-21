/** QUIZ-02 own terminal learning/history; active prompts and public rankings never appear here.
 * QUIZ-03 rounds list each closed question privately (prompt, right or not, explanation); never a score or rank.
 * QUIZ-04: Life Playbook and group rounds sit in the same private history with a plain label; a corrected (voided)
 * question shows its correction note; the clear-history copy covers levels, and Life Playbook levels when Life is
 * known to this account (never a teaser otherwise).
 * QUIZ-05: a fun fact is labelled "Fun fact"; one the athlete removed shows the server's "Removed by the athlete" once
 * (no answer or explanation), and one that no longer passes the server's check shows "This fun fact isn’t available
 * anymore."
 * UX-13 aligns existing readable type and wrapping without changing any action or notice.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';
import type { SportQuizState } from '@/hooks/useSportQuiz';
import type { TimedQuizAttemptSummary } from '@shared/timedSportQuiz';
import { QuizButton } from './QuizButton';
import { FUN_FACT_REMOVED, FUN_FACT_UNAVAILABLE, factGoneText, factUnavailable, isFunFact } from './FunFactMoment';
import { TYPE, figtree } from '@/theme/fonts';
const KIND_LABEL: Record<NonNullable<TimedQuizAttemptSummary['round_kind']>, string | null> = { personal: null, group: 'Group round', life: 'Life Playbook round' };
/** @purpose CAS erasure needs an explicitly reviewed revision; unknown outcomes require Refresh/reconfirmation. */
export function SportQuizHistory({ quiz, onBeforeErase, lifeKnown = false }: {
    quiz: SportQuizState;
    onBeforeErase: () => void;
    /** Life is visible to this account (offered or turned on), so the erase copy may name it. */
    lifeKnown?: boolean;
}) {
    const [confirmation, setConfirmation] = useState<number | null>(null);
    const s = quiz.snapshot;
    const h = quiz.history;
    return <View style={{ gap: 12 }}><Text style={{ ...TYPE.section, ...figtree('700') }} accessibilityRole="header">Your private trivia history</Text>
 <Text style={{ ...figtree('400'), ...TYPE.body }}>Only you see this. Right or wrong, you get the same badge, just for fun.</Text>
 {quiz.historyLoading ? <Text style={{ ...figtree('400'), ...TYPE.body }}>Checking private history…</Text> : null}
 {quiz.historyError ? <Text style={{ ...figtree('400'), ...TYPE.body }} accessibilityRole="alert">{quiz.historyError}</Text> : null}
 <QuizButton label="Refresh private history" quiet disabled={!!quiz.busy || quiz.historyLoading} onPress={() => { setConfirmation(null); void quiz.refresh().then(() => quiz.loadHistory()); }}/>
 {h && !h.items.length ? <Text style={{ ...figtree('400'), ...TYPE.body }}>No retained learning history to show.</Text> : null}
 {h?.items.map(item => <View key={item.attempt.id} style={{ gap: 6 }}><Text style={{ ...figtree('400'), ...TYPE.body }}>{`Week starting ${item.attempt.week_start} · ${item.attempt.round_kind && KIND_LABEL[item.attempt.round_kind] ? `${KIND_LABEL[item.attempt.round_kind]} · ` : ''}${item.attempt.status}`}</Text>
 {item.question ? <Text style={{ ...figtree('400'), ...TYPE.body }}>{item.question.prompt}</Text> : null}{item.result ? <Text style={{ ...figtree('400'), ...TYPE.body }}>{item.result.explanation}</Text> : null}
 {item.items?.map(i => { const gone = factUnavailable(i.result); const removed = gone ? null : factGoneText(i.question);
  return <View key={i.position} style={{ gap: 2 }}><Text style={{ ...figtree('400'), ...TYPE.body }}>{`Question ${i.position}${isFunFact(i.question) ? ' (Fun fact)' : ''}: ${gone ? 'not available' : removed ? (removed === FUN_FACT_REMOVED ? 'removed' : 'not available') : i.status === 'void' ? 'corrected' : i.result.answered_option === null ? 'not answered' : i.result.was_correct ? 'right' : 'not quite'}`}</Text>
 {gone ? <Text style={{ ...figtree('400'), ...TYPE.body }}>{FUN_FACT_UNAVAILABLE}</Text> : removed ? <Text style={{ ...figtree('400'), ...TYPE.body }}>{removed}</Text> : <>
 <Text style={{ ...figtree('400'), ...TYPE.body }}>{i.question.prompt}</Text><Text style={{ ...figtree('400'), ...TYPE.body }}>{i.result.explanation}</Text>{i.status === 'void' || i.correction_reason ? <Text style={{ ...figtree('400'), ...TYPE.body }}>{`Correction: ${i.correction_reason ?? 'We corrected this question after review, so it doesn’t count.'}`}</Text> : null}</>}</View>; })}
 {item.badge ? <Text style={{ ...figtree('400'), ...TYPE.body }}>{item.badge.voided_at ? `${item.badge.label} · corrected/unavailable` : item.badge.label}</Text> : null}
 {item.attempt.correction_reason ? <Text style={{ ...figtree('400'), ...TYPE.body }}>{item.attempt.correction_reason}</Text> : null}
 {['ended', 'expired'].includes(item.attempt.status) ? <Text style={{ ...figtree('400'), ...TYPE.body }}>Round ended. You can keep browsing; older completion badges are unaffected.</Text> : null}</View>)}
 {h?.next_before ? <QuizButton label="More private history" quiet disabled={!!quiz.busy || quiz.historyLoading} onPress={() => { void quiz.loadHistory(true); }}/> : null}
 <Text style={{ ...figtree('400'), ...TYPE.body }}>{lifeKnown
        ? 'Clear history removes retained questions, exposure history, badges, your level, your Life Playbook chapter levels, receipts and associated participant audit. Preferences, notice acceptance, your Life Playbook setting and the history revision remain. All of this week’s rounds (your round, group round and Life Playbook round) stay used, with a minimal account/week guard for 35 days. After erasure, familiar questions may appear again.'
        : 'Clear history removes retained questions, exposure history, badges, your level, receipts and associated participant audit. Preferences, notice acceptance and the history revision remain. This week stays spent with a minimal account/week guard for 35 days. After erasure, familiar questions may appear again.'}</Text>
 {quiz.erasureUncertain ? <Text style={{ ...figtree('400'), ...TYPE.body }} accessibilityRole="alert">Clearing was not confirmed. Refresh, review the current history, then confirm again if needed.</Text> : null}
 <QuizButton label="Clear history and end this week" quiet disabled={!s || !!quiz.busy || quiz.loading || quiz.erasureUncertain} onPress={() => setConfirmation(s!.history_version)}/>
 {confirmation !== null && s && confirmation === s.history_version && !quiz.erasureUncertain ? <><Text style={{ ...figtree('400'), ...TYPE.body }}>This cannot restore erased learning history. Confirm clearing the history you just reviewed?</Text><QuizButton label="Confirm clear history" disabled={!!quiz.busy} onPress={() => { const revision = confirmation; setConfirmation(null); onBeforeErase(); void quiz.eraseHistory(revision); }}/><QuizButton label="Keep history" quiet onPress={() => setConfirmation(null)}/></> : null}
 </View>;
}
