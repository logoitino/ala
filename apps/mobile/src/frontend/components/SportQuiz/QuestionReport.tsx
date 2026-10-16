/** QUIZ-05 "Report a problem with this question" (design §6.9 and §6.13; §6 overrides §1–§5).
 * After a question's reveal a small link opens a sheet with fixed reasons only: Wrong answer / Confusing / Not okay,
 * plus "Shares something private" on fun facts. There is no free text. Afterwards: "Thanks. We'll take a look." The
 * already-reported, daily-limit and intake-paused replies are said plainly and never claim a report counted or paused
 * anything (the server never says either). The link and sheet are separate from Next: Next is never disabled, held or
 * delayed by a report, and a report can still finish after the round moves on.
 * The link appears only for questions from a QUIZ-05 server (they carry `shuffled`), so an older server never offers a
 * report it cannot take.
 * @sideEffects `quiz_report` through lib/freshQuestions; an iOS announcement for the confirmation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TimedQuizQuestion } from '@shared/timedSportQuiz';
import { reportTriviaQuestion, TRIVIA_QUESTION_REPORT_LABELS, type TriviaQuestionReportReason } from '@/lib/freshQuestions';
import { NOT_SWITCHED_ON } from '@/lib/rpc';
import { colors, radii } from '@/constants/theme';
import { QuizButton } from './QuizButton';
import { isFunFact } from './FunFactMoment';

/** How a report went, in the words the sheet shows. 'sending' is in flight. */
export type ReportState = 'sending' | 'reported' | 'already' | 'limit' | 'paused' | 'closed' | 'unavailable' | 'failed';
export const REPORT_WORDS: Record<Exclude<ReportState, 'sending'>, string> = {
    reported: 'Thanks. We’ll take a look.',
    already: 'You already reported this question. Thanks, we have it.',
    limit: 'You’ve sent the most reports for today. You can report again tomorrow.',
    paused: 'We’re not taking reports right now. Please try again later.',
    closed: 'You can report a question once its answer is shown.',
    unavailable: 'Reporting isn’t available right now.',
    failed: 'Your report didn’t send. Check your connection and try again.',
};
/** States after which this question's report is finished (no more reasons are offered). */
const FINAL: ReportState[] = ['reported', 'already'];

/** @purpose Report state per question for one account, shared by the reveal and the round summary. */
export function useQuestionReports(profileId: string | null) {
    const [states, setStates] = useState<Record<string, ReportState>>({});
    const live = useRef(true);
    useEffect(() => () => { live.current = false; }, []);
    const send = useCallback(async (questionId: string, reason: TriviaQuestionReportReason) => {
        if (!profileId) return;
        setStates(s => ({ ...s, [questionId]: 'sending' }));
        let next: ReportState;
        try {
            const receipt = await reportTriviaQuestion(questionId, reason, profileId);
            next = receipt.outcome === 'already_reported' ? 'already' : receipt.outcome === 'paused' ? 'paused' : 'reported';
        } catch (e) {
            const text = e instanceof Error ? e.message : '';
            next = text.includes('quiz_report_limit') ? 'limit' : text.includes('quiz_report_not_allowed') ? 'closed'
                : text === NOT_SWITCHED_ON || text.includes('quiz_unavailable') ? 'unavailable' : 'failed';
        }
        if (live.current) setStates(s => ({ ...s, [questionId]: next }));
    }, [profileId]);
    return { profileId, stateFor: (questionId: string): ReportState | null => states[questionId] ?? null, send };
}
export type QuestionReports = ReturnType<typeof useQuestionReports>;

/** @purpose True when this question can be reported from here (a QUIZ-05 question with a signed-in account). */
export function reportable(question: TimedQuizQuestion | null | undefined, reports: QuestionReports | null | undefined): question is TimedQuizQuestion {
    return !!question && !!reports?.profileId && typeof question.shuffled === 'boolean';
}

/** @purpose The quiet link under a revealed question and the reasons sheet it opens. */
export function QuestionReportLink({ question, reports }: { question: TimedQuizQuestion; reports: QuestionReports }) {
    const [open, setOpen] = useState(false);
    const state = reports.stateFor(question.id);
    const fact = isFunFact(question);
    const reasons: TriviaQuestionReportReason[] = fact ? ['wrong_answer', 'confusing', 'not_okay', 'private'] : ['wrong_answer', 'confusing', 'not_okay'];
    const words = state && state !== 'sending' ? REPORT_WORDS[state] : null;
    // iOS ignores live regions: announce the outcome once (Android reads the polite region in the sheet).
    useEffect(() => { if (words && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility?.(words); }, [words]);
    const done = !!state && FINAL.includes(state);
    // The spoken name matches the words on screen (WCAG 2.5.3), so a voice-control user can say what they see.
    const linkWords = done ? 'Reported. Thanks.' : 'Report a problem with this question';
    return <View>
        <Pressable accessibilityRole="button" accessibilityLabel={linkWords} onPress={() => setOpen(true)} style={styles.link}>
            <Text style={styles.linkText}>{linkWords}</Text>
        </Pressable>
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
            <View style={styles.backdrop}>
                <View style={styles.sheet} accessibilityViewIsModal>
                    <Text accessibilityRole="header" style={styles.title}>Report a problem with this question</Text>
                    {!done ? <Text style={styles.hint}>Pick one reason. Your round keeps going.</Text> : null}
                    {!done ? reasons.map(reason => <QuizButton key={reason} quiet label={TRIVIA_QUESTION_REPORT_LABELS[reason]} disabled={state === 'sending'}
                        onPress={() => { void reports.send(question.id, reason); }}/>) : null}
                    {/* Kept mounted so Android reads the outcome as soon as it arrives. */}
                    <Text accessibilityLiveRegion="polite" style={words ? styles.outcome : styles.offscreen}>{state === 'sending' ? 'Sending…' : words ?? ''}</Text>
                    <QuizButton label={done ? 'Done' : 'Close'} onPress={() => setOpen(false)}/>
                </View>
            </View>
        </Modal>
    </View>;
}

const styles = StyleSheet.create({
    link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
    linkText: { color: colors.textMuted, fontSize: 14, textDecorationLine: 'underline' },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet: { gap: 10, padding: 20, paddingBottom: 28, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, backgroundColor: colors.surface },
    title: { fontSize: 18, fontWeight: '800', color: colors.text },
    hint: { fontSize: 14, color: colors.textMuted },
    outcome: { fontSize: 16, fontWeight: '600', color: colors.text },
    offscreen: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
