/** QUIZ-03 round of up to five: the open question with its own server deadline, the explanation with Next, and the
 * private round summary ("You learned N new facts"). Right or wrong shows per question, privately; never a score,
 * speed or rank. Image questions are never rendered in this build.
 * QUIZ-04 fun presentation (2026-10-15): the question card pops in and the answers cascade; jersey-number dots show
 * the round's progress; a shot-clock bar turns warm gold in the last 10 seconds; an answer press squishes with a
 * light tap cue; the reveal shows a rotating game-day kicker (confetti and a glow for a right answer, an encouraging
 * line and a soft wiggle for "not quite", "Whistle!" when time runs out); the explanation slides in and Next bounces
 * gently; the summary celebrates everyone who answered at least one question, right or wrong. Every effect has text
 * beside it, the plain verdicts and announcements are unchanged, and no effect delays an answer, Next or End.
 * QUIZ-05 (design §6.13): a fun fact (server topic 'athlete') shows "Fun fact: {first name}" and, after the reveal, the
 * athlete's card; a fun fact that no longer passes the server's check says "This fun fact isn’t available anymore."
 * with no answer, explanation, cheer or card. After a reveal, "Report a problem with this question" opens the reasons
 * sheet (when the screen passes `reports`); it sits apart from Next and never holds it.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, StyleSheet, Text, View } from 'react-native';
import type { TimedQuizRoundState } from '@/hooks/useTimedSportQuizRound';
import type { TimedQuizResult } from '@shared/timedSportQuiz';
import type { QuizCue } from '@/lib/quizSound';
import { colors, radii } from '@/constants/theme';
import { FOCAL, JADE_BORDER_GLOW } from '@/theme/motion';
import { CardShine } from '@/components/Effects/CardShine';
import { QuizButton } from './QuizButton';
import { CheerStage, InviteBounce, PopIn, Wiggle, useQuizFx } from './QuizFx';
import { FactsCountUp, QuestionDots, TimerBar } from './QuizProgress';
import { TIME_UP_CHEER, ZERO_FACTS_LINE, cheerFor, encouragementFor, roundCheerFor } from './quizCheers';
import { FUN_FACT_UNAVAILABLE, FunFactAthleteCard, FunFactHeader, factUnavailable, funFactTitle, isFunFact } from './FunFactMoment';
import { QuestionReportLink, reportable, type QuestionReports } from './QuestionReport';

/** Announce only a few milestones so screen readers hear the clock without a stream of numbers. */
function milestone(remaining: number, duration: number | null): string | null {
    if (remaining <= 10) return '10 seconds left';
    if (duration === 90 && remaining <= 30) return '30 seconds left';
    return null;
}
/** @purpose Move a screen reader to `target` once it is drawn, after the control the person pressed has gone (Back to
 * this week's rounds, Skip, About). Phones only: the browser build throws from findNodeHandle. Returns a cancel. */
export function focusSoon(target: RefObject<View | Text | null>): () => void {
    if (Platform.OS === 'web') return () => {};
    const timer = setTimeout(() => {
        const node = target.current ? findNodeHandle(target.current) : null;
        if (node != null) AccessibilityInfo.setAccessibilityFocus?.(node);
    }, 150);
    return () => clearTimeout(timer);
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
function verdict(result: TimedQuizResult | null): string {
    if (!result) return 'This question closed.';
    if (result.item_status === 'fact_unavailable') return FUN_FACT_UNAVAILABLE;
    if (result.item_status === 'void') return 'We corrected this question, so it’s not part of your round.';
    if (result.answered_option === null) return result.item_status === 'ended' ? 'Not answered before the round ended.' : 'Time ran out on this one.';
    return result.was_correct ? 'That’s right!' : 'Not quite. Here’s the fact:';
}
/** How a closed question turned out, for the kicker, the cue and the wiggle. Corrected or round-ended items get none. */
type Reveal = 'correct' | 'notQuite' | 'timeUp';
/** @purpose Classify a closed question's private result; null for a corrected (void) or round-ended item. */
export function revealOf(result: Pick<TimedQuizResult, 'answered_option' | 'was_correct' | 'item_status'> | null): Reveal | null {
    if (!result || result.item_status === 'void' || result.item_status === 'fact_unavailable') return null;
    if (result.answered_option === null) return result.item_status === 'ended' ? null : 'timeUp';
    return result.was_correct ? 'correct' : 'notQuite';
}
const CUE: Record<Reveal, QuizCue> = { correct: 'correct', notQuite: 'notQuite', timeUp: 'timeUp' };
/** @purpose The game-day kicker above the verdict: a sport cheer with confetti, an encouragement, or the whistle.
 * `seed` (the question number) rotates the line so each question sounds fresh. */
export function RevealBanner({ reveal, sport, seed }: { reveal: Reveal; sport: string | null | undefined; seed: number }) {
    if (reveal === 'correct') return <CheerStage text={cheerFor(sport, seed)} tone="cheer" burst="small"/>;
    if (reveal === 'notQuite') return <CheerStage text={encouragementFor(seed)} tone="encourage"/>;
    return <CheerStage text={TIME_UP_CHEER} tone="whistle"/>;
}
/** @purpose Facts learned = answered, uncorrected questions. Shared by the summary and its tests. */
export function factsLearned(round: Pick<TimedQuizRoundState, 'entries'>): number {
    return round.entries.filter(e => e.result.answered_option !== null && e.result.item_status !== 'void' && e.result.item_status !== 'fact_unavailable').length;
}

/** @purpose The live item, its explanation step and the end-of-round summary, all driven by the round hook. */
export function SportQuizRound({ round, busy, reports = null }: { round: TimedQuizRoundState; busy: boolean; reports?: QuestionReports | null }) {
    const fx = useQuizFx();
    const live = round.live;
    const item = round.item;
    const between = round.between;
    const note = live ? milestone(round.remainingSeconds, round.duration) : null;
    // Android reads the polite live region below; iOS needs one explicit announcement per milestone.
    useEffect(() => { if (note && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility?.(note); }, [note]);
    // After Next, tell screen readers which question is up (focus stays where it was otherwise).
    const itemLabel = item ? `Question ${item.position} of ${item.planned}` : null;
    // A fun fact adds its header ("Fun fact: {first name}") to the same announcement, so it is heard without hunting.
    // Read through a ref so the reveal (when `live` clears) does not announce the question again.
    const factTitle = useRef<string | null>(null);
    factTitle.current = live && isFunFact(live.question) ? funFactTitle(live.question) : null;
    useEffect(() => { if (itemLabel) AccessibilityInfo.announceForAccessibility?.(factTitle.current ? `${itemLabel}. ${factTitle.current}` : itemLabel); }, [itemLabel]);
    // One reveal cue per question: the whistle while time-up is being checked, otherwise the explanation's outcome.
    const whistle = round.closing && !round.pendingAnswer;
    const revealPosition = between ? between.position : whistle ? item?.position ?? null : null;
    const reveal = between ? revealOf(between.result) : whistle ? 'timeUp' : null;
    const cued = useRef(0);
    useEffect(() => {
        if (revealPosition === null) { if (!live) cued.current = 0; return; }
        if (!reveal || cued.current === revealPosition) return;
        cued.current = revealPosition;
        fx.play(CUE[reveal]);
    }, [revealPosition, reveal, live, fx]);
    if (live) {
        const trueFalse = live.question.question_type === 'true_false';
        const warm = round.remainingSeconds <= 10;
        // The answer is sent first; the tap cue is synchronous and cannot hold it up.
        const pick = (index: number) => { void round.answer(index); fx.play('tap'); };
        return <View style={{ gap: 12 }}>
            {item ? <Text accessibilityRole="header">{`Question ${item.position} of ${item.planned}`}</Text> : null}
            {item ? <QuestionDots planned={item.planned} done={item.position - 1} current={item.position}/> : null}
            {isFunFact(live.question) ? <FunFactHeader key={`fact-${item?.position ?? 0}`} question={live.question}/> : null}
            <PopIn key={item?.position ?? 0} from="pop" style={styles.questionCard}>
                {isFunFact(live.question) ? null : <Text style={{ color: colors.textMuted }}>{live.question.sport}</Text>}
                <Text style={{ fontSize: 20, fontWeight: '600', color: colors.text }}>{live.question.prompt}</Text>
            </PopIn>
            <TimerBar remaining={round.remainingSeconds} duration={round.duration}/>
            <Text accessibilityLabel={`${round.remainingSeconds} seconds left`} style={warm ? styles.warmClock : undefined}>{`${round.remainingSeconds} seconds left`}</Text>
            {/* Screen-reader only: the visible counter above already shows the time, so the milestone is not drawn twice. */}
            <Text accessibilityLiveRegion="polite" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>{note ?? ''}</Text>
            {trueFalse
                ? <View style={{ flexDirection: 'row', gap: 12 }}>{live.question.options.map((option, index) => <PopIn key={`${item?.position}-${index}`} delay={80 + index * 70} style={{ flex: 1 }}>
                    <QuizButton big label={option} selected={round.pendingAnswer?.option === index} disabled={busy || !!round.pendingAnswer} onPress={() => pick(index)}/></PopIn>)}</View>
                : live.question.options.map((option, index) => <PopIn key={`${item?.position}-${index}`} delay={80 + index * 70}>
                    <QuizButton label={`Answer ${index + 1}: ${option}`} selected={round.pendingAnswer?.option === index} disabled={busy || !!round.pendingAnswer} onPress={() => pick(index)}/></PopIn>)}
            {round.pendingAnswer?.uncertain ? <><Text>{`You picked: ${live.question.options[round.pendingAnswer.option]}. We couldn’t confirm it yet.`}</Text><QuizButton label="Retry this answer" disabled={busy} onPress={() => { if (round.pendingAnswer)
                void round.answer(round.pendingAnswer.option); }}/></> : null}
        </View>;
    }
    if (round.closing) return <View style={{ gap: 8 }}>
        {whistle ? <CheerStage text={TIME_UP_CHEER} tone="whistle"/> : null}
        <Text accessibilityRole="header">Time’s up</Text><Text accessibilityLiveRegion="polite">Checking the answer…</Text>
    </View>;
    if (between) {
        const last = between.position >= between.planned;
        const shown = revealOf(between.result);
        const gone = factUnavailable(between.result);
        const fact = isFunFact(between.question);
        const hasAnswer = !gone && !!between.result && !!between.question && between.result.correct_option < between.question.options.length;
        return <PopIn key={`between-${between.position}`} from="right" style={{ gap: 10 }}>
            <Text accessibilityRole="header">{`Question ${between.position} of ${between.planned}`}</Text>
            <QuestionDots planned={between.planned} done={between.position}/>
            {fact ? <FunFactHeader question={between.question}/> : null}
            {shown ? <RevealBanner reveal={shown} sport={fact ? null : between.question?.sport} seed={between.position}/> : null}
            {between.question && !gone ? <Text style={{ color: colors.textMuted }}>{between.question.prompt}</Text> : null}
            <Wiggle active={shown === 'notQuite'}>
                <Text accessibilityLiveRegion="polite" style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>{verdict(between.result)}</Text>
            </Wiggle>
            {/* The right answer is highlighted with a border and a check mark (not colour alone); it glows after a right answer. */}
            {hasAnswer ? <View testID={shown === 'correct' ? 'quiz-answer-glow' : undefined} style={[styles.answerChip, shown === 'correct' && JADE_BORDER_GLOW]}>
                <Text aria-hidden style={styles.answerCheck}>✓</Text>
                <Text style={styles.answerText}>{`Answer: ${between.question!.options[between.result!.correct_option]}`}</Text>
            </View> : null}
            {between.result && !gone ? <PopIn delay={140} from="right" style={styles.factCard}><Text>{between.result.explanation}</Text></PopIn> : null}
            {fact && !gone ? <FunFactAthleteCard card={between.result?.fun_fact}/> : null}
            {!gone && between.result && between.result.item_status !== 'void' && reportable(between.question, reports) ? <QuestionReportLink question={between.question} reports={reports!}/> : null}
            <Text style={{ color: colors.textMuted }}>Tap Next when you’re ready. The round waits about two minutes. Leaving this page now ends the round.</Text>
            <InviteBounce><QuizButton label={last ? 'See my round' : 'Next'} disabled={busy} onPress={() => { void round.next(); }}/></InviteBounce>
            {round.pendingNext?.uncertain ? <Text>Next wasn’t confirmed yet. Tapping Next again sends the same request.</Text> : null}
        </PopIn>;
    }
    return null;
}

/** @purpose The private end-of-round summary; also covers a round ended by leaving and a short (small pool) round.
 * Anyone who answered at least one question gets the same celebration (equal rewards): a kicker with confetti, the
 * counting medal, the badge card with a shine and the round fanfare. Zero facts gets a short friendly line instead. */
export function SportQuizRoundSummary({ round, reports = null }: { round: TimedQuizRoundState; reports?: QuestionReports | null }) {
    const fx = useQuizFx();
    const entries = round.entries;
    const outcome = round.result?.outcome ?? null;
    const learned = factsLearned(round);
    const ended = round.endedEarly || outcome === 'ended' || outcome === 'expired';
    const celebrate = learned > 0;
    useEffect(() => { if (celebrate) fx.play('roundComplete'); },
        // Once per summary: the fanfare must not replay when the screen re-renders.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []);
    return <View style={{ gap: 10 }}>
        <Text accessibilityRole="header">{ended ? 'Round ended' : 'Round complete'}</Text>
        {celebrate ? <CheerStage text={roundCheerFor(learned)} tone="round" burst="big"/> : null}
        {celebrate ? <FactsCountUp to={learned}/> : null}
        <Text accessibilityLiveRegion="polite" style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{learned === 0 ? 'No new facts this time, and that’s okay.' : `You learned ${plural(learned, 'new fact')}`}</Text>
        {learned === 0 ? <Text>{ZERO_FACTS_LINE}</Text> : null}
        {ended ? <Text>A round ends if you leave this page (even during an explanation), hide the app, wait too long at an explanation or tap End round. Questions you didn’t see are saved for another week.</Text> : null}
        {round.shortRound ? <Text>{`This round had ${plural(round.planned ?? entries.length, 'question')} because that’s all the new ones we have for this topic right now. We never repeat a question.`}</Text> : null}
        {outcome === 'pool_exhausted' ? <Text>That’s every new question we have for this topic right now, so the round stopped early.</Text> : null}
        {outcome === 'week_closed' ? <Text>The trivia week is ending, so the round stopped here.</Text> : null}
        {celebrate ? <PopIn from="pop" delay={200} style={styles.badgeCard}>
            {fx.still ? null : <CardShine loopMs={3400} width={60} tint="rgba(255,215,0,0.35)"/>}
            <View style={styles.badgeTitleRow}><Text aria-hidden style={styles.badgeEmoji}>🏅</Text><Text style={styles.badgeTitle}>Trivia Explorer badge</Text></View>
            <Text>Right or wrong, every answered round earns the same private Trivia Explorer badge. Only you see this summary.</Text>
        </PopIn> : null}
        {entries.map((entry, index) => {
            const gone = factUnavailable(entry.result);
            const fact = isFunFact(entry.question);
            return <PopIn key={entry.position} delay={260 + index * 60} style={{ gap: 4 }}>
                <Text style={{ fontWeight: '600', color: colors.text }}>{`Question ${entry.position}: ${gone ? 'not available' : entry.result.answered_option === null ? 'not answered' : entry.result.item_status === 'void' ? 'corrected' : entry.result.was_correct ? 'right' : 'not quite'}`}</Text>
                {fact && !gone ? <FunFactHeader question={entry.question}/> : null}
                {gone ? <Text>{FUN_FACT_UNAVAILABLE}</Text> : <>
                    {entry.question ? <Text style={{ color: colors.textMuted }}>{entry.question.prompt}</Text> : null}
                    <Text>{entry.result.explanation}</Text>
                    {fact ? <FunFactAthleteCard card={entry.result.fun_fact}/> : null}
                    {entry.result.item_status !== 'void' && reportable(entry.question, reports) ? <QuestionReportLink question={entry.question} reports={reports!}/> : null}
                </>}
            </PopIn>;
        })}
    </View>;
}

const styles = StyleSheet.create({
    questionCard: { gap: 6, padding: 16, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    warmClock: { color: FOCAL.goldInk, fontWeight: '700' },
    answerChip: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radii.md, borderWidth: 2, borderColor: FOCAL.jadeInk, backgroundColor: FOCAL.mistJade },
    answerCheck: { fontSize: 18, fontWeight: '900', color: FOCAL.jadeInk },
    answerText: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: colors.text },
    factCard: { padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    badgeCard: { gap: 6, padding: 14, borderRadius: radii.lg, borderWidth: 2, borderColor: FOCAL.electricGold, backgroundColor: FOCAL.mistGold, overflow: 'hidden' },
    badgeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    badgeEmoji: { fontSize: 22 },
    badgeTitle: { fontSize: 18, fontWeight: '800', color: FOCAL.goldInk },
});
