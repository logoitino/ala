/** QUIZ-02 optional preparation, foreground timed round and own terminal history.
 * @sideEffects Explicit account/round SDK actions and usable Back/account Home; no automatic Start or secret persistence.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, ScrollView, Text, View } from 'react-native';
import { useIsFocused, useRouter, type Href } from 'expo-router';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/context/AuthContext';
import { useSportQuiz, type SportQuizState } from '@/hooks/useSportQuiz';
import { useTimedSportQuizRound } from '@/hooks/useTimedSportQuizRound';
import { ROLE_HOME } from '@/lib/roles';
import { TIMED_QUIZ_NOTICE_VERSION, type TimedQuizTopic } from '@shared/timedSportQuiz';
import { QuizButton } from './QuizButton';
import { SportQuizPreparation } from './SportQuizPreparation';
import { SportQuizPreferences } from './SportQuizPreferences';
import { SportQuizHistory } from './SportQuizHistory';
type PreparationIntent = { topic: TimedQuizTopic; sport: string | null; duration: 30 | 90; key: string; generation: number };
const isForeground = () => (AppState.currentState === 'active' || AppState.currentState == null) && !(Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState !== 'visible');
/** @purpose Remount preparation/round with canonical identity, while navigation remains available during every state. */
export function SportQuizScreen() { const quiz = useSportQuiz(); return <ScreenShell edges={['top', 'bottom', 'left', 'right']}><SportQuizContent key={quiz.identityKey ?? 'unavailable'} quiz={quiz}/></ScreenShell>; }
function SportQuizContent({ quiz }: {
    quiz: SportQuizState;
}) {
    const auth = useAuth();
    const router = useRouter();
    const focused = useIsFocused();
    const changed = async () => { await quiz.refresh(); await quiz.loadHistory(); };
    const round = useTimedSportQuizRound({ identityKey: quiz.identityKey, profileId: quiz.profileId, snapshot: quiz.snapshot, focused, onChanged: changed });
    const s = quiz.snapshot;
    const busy = !!quiz.busy || !!round.busy;
    const sourceKey = JSON.stringify([quiz.identityKey, s?.week_start ?? null]);
    const preparation = useRef({ key: sourceKey, generation: 0, active: true, focused, foreground: isForeground() });
    // Invalidate synchronously: returning before a notice response must not revive the earlier choice.
    if (preparation.current.key !== sourceKey || (preparation.current.focused && !focused))
        ++preparation.current.generation;
    preparation.current.key = sourceKey;
    preparation.current.focused = focused;
    const [intent, setIntent] = useState<PreparationIntent | null>(null);
    const invalidatePreparation = useCallback(() => { ++preparation.current.generation; setIntent(null); }, []);
    const validIntent = useCallback((choice: PreparationIntent) => {
        const p = preparation.current;
        return p.active && p.focused && p.foreground && isForeground() && choice.key === p.key && choice.generation === p.generation;
    }, []);
    useEffect(() => {
        preparation.current.active = true;
        const subscription = AppState.addEventListener('change', state => {
            preparation.current.foreground = state === 'active';
            if (!preparation.current.foreground) invalidatePreparation();
        });
        const visibility = () => {
            preparation.current.foreground = isForeground();
            if (!preparation.current.foreground) invalidatePreparation();
        };
        if (Platform.OS === 'web' && typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
        return () => {
            preparation.current.active = false;
            ++preparation.current.generation;
            subscription.remove();
            if (Platform.OS === 'web' && typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility);
        };
    }, [invalidatePreparation]);
    useEffect(() => { if (quiz.identityKey && focused && quiz.snapshot)
        void quiz.loadHistory(); }, [quiz.identityKey, focused, quiz.snapshot?.history_version, quiz.loadHistory]);
    useEffect(() => {
        if (!intent) return;
        if (!validIntent(intent)) { setIntent(null); return; }
        if (quiz.snapshot?.preferences.notice_version === TIMED_QUIZ_NOTICE_VERSION) {
            setIntent(null);
            void round.start(intent.topic, intent.sport, intent.duration);
        }
    }, [intent, focused, sourceKey, quiz.snapshot?.preferences.notice_version, round.start, validIntent]);
    const home = () => { invalidatePreparation(); round.leave('left_page'); router.replace(ROLE_HOME[auth.role] as Href); };
    const back = () => { invalidatePreparation(); round.leave('left_page'); if (router.canGoBack())
        router.back();
    else
        router.replace(ROLE_HOME[auth.role] as Href); };
    const start = async (topic: TimedQuizTopic, sport: string | null, duration: 30 | 90) => {
        if (!s) return;
        const choice = { topic, sport, duration, key: sourceKey, generation: preparation.current.generation };
        if (!validIntent(choice)) return;
        if (s.preferences.notice_version !== TIMED_QUIZ_NOTICE_VERSION) {
            const receipt = await quiz.savePreferences({ invitation_mode: s.preferences.invitation_mode, topic_mode: s.preferences.topic_mode, notice_version: TIMED_QUIZ_NOTICE_VERSION });
            if (receipt && validIntent(choice)) setIntent(choice);
            return;
        }
        await round.start(topic, sport, duration);
    };
    return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
 <View style={{ flexDirection: 'row', gap: 12 }}><QuizButton label="Back" quiet onPress={back}/><QuizButton label="Account Home" quiet onPress={home}/></View>
 <Text accessibilityRole="header" style={{ fontSize: 28 }}>Sport Pop Quiz</Text><Text>Optional timed trivia · Testing only</Text>
 {quiz.loading && !s ? <Text>Checking quiz availability…</Text> : null}{!s && !quiz.loading && !quiz.error ? <Text>Trivia is not available for this account. You can keep browsing.</Text> : null}
 {quiz.error ? <Text accessibilityRole="alert">{quiz.error}</Text> : null}{round.error ? <Text accessibilityRole="alert">{round.error}</Text> : null}
 <QuizButton label="Refresh quiz" quiet disabled={busy} onPress={() => { void quiz.refresh(); }}/>
 {s ? <><Text>{`UTC week starts ${s.week_start}; next week ${s.week_end}.`}</Text>
 {s.availability !== 'ready' ? <Text>{s.availability === 'paused' ? 'Sport Pop Quiz is paused. Private history remains available.' : s.availability === 'not_enrolled' ? 'Trivia is not available for this account yet.' : 'Trivia is unavailable for this account right now.'}</Text> : null}
 {!round.live && !round.pendingStart && !round.ended && s.availability === 'ready' && !s.week_spent ? <SportQuizPreparation snapshot={s} busy={busy || quiz.loading} onStart={(...args) => { void start(...args); }}/> : null}
 {round.pendingStart ? <><Text>Start is unconfirmed. Only the original choices can be retried on this foreground view before its original deadline.</Text><QuizButton label="Retry original Start" disabled={busy} onPress={() => { void round.retryStart(); }}/></> : null}
 {round.live ? <View style={{ gap: 12 }}><Text accessibilityRole="header">{round.live.question.sport}</Text><Text>{round.live.question.prompt}</Text><Text accessibilityLabel="Time remaining">{round.remainingSeconds} seconds remaining</Text>
 {round.live.question.options.map((option, index) => <QuizButton key={index} label={`Answer ${index + 1}: ${option}`} disabled={busy || !!round.pendingAnswer} onPress={() => { void round.answer(index); }}/>)}
 {round.pendingAnswer?.uncertain ? <><Text>{`Your selected answer: ${round.live.question.options[round.pendingAnswer.option]}. Result not confirmed.`}</Text><QuizButton label="Retry this answer" disabled={busy} onPress={() => { if (round.pendingAnswer)
                void round.answer(round.pendingAnswer.option); }}/></> : null}</View> : null}
 {round.live || round.pendingStart || s.attempt?.status === 'issued' ? <QuizButton label="End round" quiet disabled={quiz.busy==='erase'} onPress={() => round.leave('user_end')}/> : null}
 {!round.live && (round.ended || s.attempt?.status === 'expired' || s.attempt?.status === 'ended' || s.attempt?.status === 'issued') && !round.result?.result ? <Text>Round ended or unavailable on this view. No question is resumed after leaving. You can keep browsing and check private history.</Text> : null}
 {round.result?.result ? <View style={{ gap: 10 }}><Text accessibilityRole="header">Trivia complete</Text><Text>{round.result.result.was_correct ? 'That’s right.' : 'Thanks for learning.'}</Text><Text>{round.result.result.explanation}</Text><Text>Right or wrong, the completion badge is private and noncash. Check the confirmed badge in your history below.</Text></View> : null}
 {!round.live && round.pendingAnswer?.uncertain ? <QuizButton label="Check committed answer" disabled={busy} onPress={() => { void round.recoverAnswer(); }}/> : null}
 {s.attempt?.status === 'skipped' ? <Text>Skipped for this week. Come back whenever you like.</Text> : null}
 {s.availability === 'ready' && !s.week_spent && !round.pendingStart && !round.live ? <QuizButton label="Skip this week" quiet disabled={busy || quiz.loading} onPress={() => { void quiz.skip(); }}/> : null}
 <SportQuizPreferences snapshot={s} busy={!!quiz.busy} suppressed={quiz.invitationsSuppressed} uncertain={quiz.preferenceUncertain} onSave={p => { void quiz.savePreferences(p); }}/>
 <SportQuizHistory quiz={quiz} onBeforeErase={round.discardForHistoryErase}/></> : null}
 </ScrollView>;
}
