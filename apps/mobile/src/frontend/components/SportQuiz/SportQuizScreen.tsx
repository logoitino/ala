/** QUIZ-02 optional preparation, foreground timed round and own terminal history.
 * QUIZ-03 adds rounds of up to five with Next, true/false questions, the family challenge (groups), the badge shelf
 * and season recap, and a sport preselected from an athlete's profile.
 * QUIZ-04 adds the "This week" strip (separate personal / group / Life rounds), the personal level, the Life Playbook
 * opt-in card and home, and "Back to this week's rounds" after a round so another kind can start. Group pages never
 * show Life; a missing Life migration hides every Life piece.
 * QUIZ-04 fun presentation (2026-10-15): the screen mounts the effects provider (Reduce Motion, sound choice, page
 * focus), shows the "Sound on / Sound off" switch, and celebrates a level-up once when the level read after a round is
 * higher than the level before it. Effects never delay Start, an answer, Next or End, and leaving still ends a round.
 * QUIZ-05: one report state per account (`useQuestionReports`) is shared by the reveal and the round summary, so a
 * question reported at its reveal reads as reported in the summary too. A personal sport round for the Learn card's
 * sport, opened from that card, carries the athlete's player id to Start (`learnAthlete`); nothing on this screen names
 * the athlete.
 * @sideEffects Explicit account/round SDK actions and usable Back/account Home; no automatic Start or secret persistence.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, ScrollView, Text, View } from 'react-native';
import { useIsFocused, useRouter, type Href } from 'expo-router';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/context/AuthContext';
import { useSportQuiz, type SportQuizState } from '@/hooks/useSportQuiz';
import { useTimedSportQuizRound } from '@/hooks/useTimedSportQuizRound';
import { useTriviaGroups } from '@/hooks/useTriviaGroups';
import { useTriviaBadges } from '@/hooks/useTriviaBadges';
import { useLifePlaybook, lifeOn, lifeVisible } from '@/hooks/useLifePlaybook';
import { useTriviaLevel } from '@/hooks/useTriviaLevel';
import { LIFE_LEVELS, type LifeChapterId, type LifeLevel } from '@shared/lifePlaybook';
import { ROLE_HOME } from '@/lib/roles';
import { TIMED_QUIZ_NOTICE_VERSION, type TimedQuizTopic } from '@shared/timedSportQuiz';
import { QuizButton } from './QuizButton';
import { SportQuizPreparation } from './SportQuizPreparation';
import { SportQuizPreferences } from './SportQuizPreferences';
import { SportQuizHistory } from './SportQuizHistory';
import { RevealBanner, SportQuizRound, SportQuizRoundSummary, focusSoon, revealOf } from './SportQuizRound';
import { useQuestionReports } from './QuestionReport';
import { LevelUpCelebration, QuizFxProvider, QuizSoundToggle, useQuizFx } from './QuizFx';
import { SportQuizGroups } from './SportQuizGroups';
import { SportQuizGroupPage } from './SportQuizGroupPage';
import { SportQuizBadgeShelf } from './SportQuizBadgeShelf';
import { SportQuizAllowances } from './SportQuizAllowances';
import { SportQuizLevel } from './SportQuizLevel';
import { LifePlaybookCard } from './LifePlaybookCard';
import { LifePlaybookHome } from './LifePlaybookHome';
/** `life` is set (a chapter id, or null for any open chapter) only for a Life Playbook round. */
type PreparationIntent = { topic: TimedQuizTopic; sport: string | null; duration: 30 | 90; group: string | null; life?: LifeChapterId | null; key: string; generation: number };
type GroupPreparation = { groupId: string; label: string; theme: string | null };
const isForeground = () => (AppState.currentState === 'active' || AppState.currentState == null) && !(Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState !== 'visible');
/** @purpose Remount preparation/round with canonical identity, while navigation remains available during every state. */
export function SportQuizScreen({ initialSport = null, learnAthlete = null }: { initialSport?: string | null; learnAthlete?: string | null } = {}) { const quiz = useSportQuiz(); const focused = useIsFocused(); return <ScreenShell edges={['top', 'bottom', 'left', 'right']}><QuizFxProvider focused={focused}><SportQuizContent key={quiz.identityKey ?? 'unavailable'} quiz={quiz} initialSport={initialSport} learnAthlete={learnAthlete}/></QuizFxProvider></ScreenShell>; }
/** The level a round started at; `undefined` while no round is being watched. */
type LevelBaseline = LifeLevel | null | undefined;
/** @purpose The single-question (QUIZ-02) result: the same kicker and cue as a round's reveal, once per result. */
function TimedReveal({ result }: { result: { was_correct: boolean | null; answered_option: number | null; item_status?: string | null } }) {
    const fx = useQuizFx();
    const reveal = revealOf({ answered_option: result.answered_option, was_correct: result.was_correct, item_status: (result.item_status ?? 'answered') as never });
    useEffect(() => { if (reveal) fx.play(reveal); },
        // Once per result.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []);
    return reveal ? <RevealBanner reveal={reveal} sport={null} seed={1}/> : null;
}
function SportQuizContent({ quiz, initialSport, learnAthlete }: {
    quiz: SportQuizState;
    initialSport: string | null;
    learnAthlete: string | null;
}) {
    const auth = useAuth();
    const router = useRouter();
    const focused = useIsFocused();
    const changed = async () => { await quiz.refresh(); await quiz.loadHistory(); };
    const life = useLifePlaybook(quiz.identityKey, quiz.profileId);
    const level = useTriviaLevel(quiz.identityKey, quiz.profileId);
    const fx = useQuizFx();
    const round = useTimedSportQuizRound({ identityKey: quiz.identityKey, profileId: quiz.profileId, snapshot: quiz.snapshot, focused, onChanged: changed, life: life.snapshot });
    const groups = useTriviaGroups(quiz.identityKey, quiz.profileId);
    const badges = useTriviaBadges(quiz.identityKey, quiz.profileId);
    const reports = useQuestionReports(quiz.profileId);
    const [groupPrep, setGroupPrep] = useState<GroupPreparation | null>(null);
    // Where a screen reader goes after a control it pressed disappears: the strip (or the page title) after "Back to
    // this week's rounds", the skipped line after Skip.
    const titleRef = useRef<Text>(null);
    const weekRef = useRef<Text>(null);
    const skippedRef = useRef<Text>(null);
    const [refocus, setRefocus] = useState<{ to: 'week' | 'skipped'; n: number } | null>(null);
    useEffect(() => refocus ? focusSoon(refocus.to === 'skipped' ? skippedRef : weekRef.current ? weekRef : titleRef) : undefined, [refocus]);
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
    const begin = useCallback((choice: Pick<PreparationIntent, 'topic' | 'sport' | 'duration' | 'group' | 'life'>) => choice.life !== undefined
        ? round.startLife(choice.life, choice.duration) : choice.group
        ? round.startGroup(choice.group, choice.duration)
        // QUIZ-05: only the Learn card's own sport round carries the athlete hint.
        : round.start(choice.topic, choice.sport, choice.duration, learnAthlete && choice.topic === 'sport' && !!choice.sport && choice.sport.trim().toLowerCase() === initialSport?.trim().toLowerCase() ? learnAthlete : null),
    [round.start, round.startGroup, round.startLife, learnAthlete, initialSport]);
    useEffect(() => {
        if (!intent) return;
        if (!validIntent(intent)) { setIntent(null); return; }
        if (quiz.snapshot?.preferences.notice_version === TIMED_QUIZ_NOTICE_VERSION) {
            setIntent(null);
            void begin(intent);
        }
    }, [intent, focused, sourceKey, quiz.snapshot?.preferences.notice_version, begin, validIntent]);
    // A finished group round refreshes that group's page so the played mark and totals are current.
    const finishedGroup = round.ended ? round.groupId : null;
    useEffect(() => {
        if (!finishedGroup) return;
        setGroupPrep(null);
        void badges.refresh();
        void groups.refresh();
        if (groups.openId === finishedGroup) void groups.reloadPage(finishedGroup);
    }, [finishedGroup]); // eslint-disable-line react-hooks/exhaustive-deps -- run once per finished group round
    // Erasure (and other history changes) can clear levels; re-read them while no round is open, never on first mount.
    const historyVersion = quiz.snapshot?.history_version;
    const seenHistory = useRef(historyVersion);
    const roundOpen = !!round.live || !!round.between || round.closing || round.pendingStart;
    useEffect(() => {
        if (historyVersion === undefined || roundOpen) return;
        if (seenHistory.current === undefined) { seenHistory.current = historyVersion; return; }
        if (seenHistory.current === historyVersion) return;
        seenHistory.current = historyVersion;
        void level.refresh();
        void life.refresh();
    }, [historyVersion, roundOpen]); // eslint-disable-line react-hooks/exhaustive-deps -- refresh once per history revision
    // Level up: remember the level when a round opens; after it ends, a higher level read celebrates exactly once.
    const levelKey = level.level?.level ?? null;
    const levelBefore = useRef<LevelBaseline>(undefined);
    const [levelUp, setLevelUp] = useState<string | null>(null);
    useEffect(() => {
        if (roundOpen && !round.ended && levelBefore.current === undefined) levelBefore.current = levelKey;
        if (!roundOpen && !round.ended) { levelBefore.current = undefined; setLevelUp(null); }
    }, [roundOpen, round.ended, levelKey]);
    useEffect(() => {
        const before = levelBefore.current;
        if (!round.ended || !before || !level.level) return;
        if (LIFE_LEVELS.indexOf(level.level.level) > LIFE_LEVELS.indexOf(before)) {
            levelBefore.current = undefined;
            setLevelUp(level.level.level_label);
            fx.play('levelUp');
        }
    }, [round.ended, levelKey]); // eslint-disable-line react-hooks/exhaustive-deps -- compare once per level read
    // iOS ignores live regions, so the Turn on / Turn off confirmation is announced once (same pattern as SportQuizRound).
    useEffect(() => { if (life.notice && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility?.(life.notice); }, [life.notice]);
    // Any finished round can move the level, the Life week and badges; read them once when it ends.
    useEffect(() => {
        if (!round.ended) return;
        void level.refresh();
        void life.refresh();
        void badges.refresh();
    }, [round.ended]); // eslint-disable-line react-hooks/exhaustive-deps -- run once per finished round
    const home = () => { invalidatePreparation(); round.leave('left_page'); router.replace(ROLE_HOME[auth.role] as Href); };
    const back = () => { invalidatePreparation(); round.leave('left_page'); if (router.canGoBack())
        router.back();
    else
        router.replace(ROLE_HOME[auth.role] as Href); };
    const start = async (topic: TimedQuizTopic, sport: string | null, duration: 30 | 90, group: string | null = null, lifeChapter?: LifeChapterId | null) => {
        if (!s) return;
        const choice = { topic, sport, duration, group, life: lifeChapter, key: sourceKey, generation: preparation.current.generation };
        if (!validIntent(choice)) return;
        if (s.preferences.notice_version !== TIMED_QUIZ_NOTICE_VERSION) {
            const receipt = await quiz.savePreferences({ invitation_mode: s.preferences.invitation_mode, topic_mode: s.preferences.topic_mode, notice_version: TIMED_QUIZ_NOTICE_VERSION });
            if (receipt && validIntent(choice)) setIntent(choice);
            return;
        }
        await begin(choice);
    };
    const inRound = !!round.live || !!round.between || round.closing;
    const roundSummary = round.ended && round.mode === 'round' && !round.unavailableQuestion;
    const timedResult = round.result?.result && round.mode !== 'round' ? round.result.result : null;
    const idle = !inRound && !round.pendingStart;
    const sports = s ? [...new Set(s.pools.filter(p => p.topic_category === 'sport').map(p => p.sport))] : [];
    const groupsVisible = !!s && idle && (!!s.groups_available || !!groups.mine?.groups.length || !!groups.mine?.removed.length);
    // QUIZ-04 servers keep separate weekly spots; a QUIZ-03 server has one round a week for everything.
    const separate = !!s?.week_spent_by_kind;
    const groupSpent = !!s && (separate ? s.week_spent_by_kind!.group : s.week_spent);
    const playable = !!s && s.availability === 'ready' && !groupSpent && !!s.groups_available && idle && !round.ended;
    const playNote = !s ? null : separate
        ? (groupSpent ? 'You’ve played this week’s group round. Your own round is separate.' : round.ended ? 'Tap Back to this week’s rounds first.' : !s.groups_available ? 'Group rounds are paused right now.' : null)
        : s.week_spent || round.ended ? 'You’ve used this week’s round. Come back next week to play with your group.' : !s.groups_available ? 'Group rounds are paused right now.' : null;
    // Group pages never show Life; Life also hides entirely when its migration is missing.
    const groupPageOpen = !!groups.openId && groupsVisible;
    const lifeShown = !groupPageOpen && !life.switchedOff && lifeVisible(life.snapshot);
    const lifeRow = separate && !groupPageOpen && lifeOn(life.snapshot) ? life.snapshot : null;
    const lifeCanStart = idle && !round.ended && !groupPrep && lifeOn(life.snapshot);
    return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
 <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><QuizButton label="Back" quiet onPress={back}/><QuizButton label="Account Home" quiet onPress={home}/><QuizSoundToggle/></View>
 <Text ref={titleRef} accessibilityRole="header" style={{ fontSize: 28 }}>Sport Pop Quiz</Text><Text>Optional timed trivia · Testing only</Text>
 {quiz.loading && !s ? <Text>Checking quiz availability…</Text> : null}{!s && !quiz.loading && !quiz.error ? <Text>Trivia is not available for this account. You can keep browsing.</Text> : null}
 {quiz.error ? <Text accessibilityRole="alert">{quiz.error}</Text> : null}{round.error ? <Text accessibilityRole="alert">{round.error}</Text> : null}
 {life.error && !life.switchedOff ? <Text accessibilityRole="alert">{life.error}</Text> : null}
 <QuizButton label="Refresh quiz" quiet disabled={busy} onPress={() => { void quiz.refresh(); void life.refresh(); void level.refresh(); }}/>
 {s ? <><Text>{`UTC week starts ${s.week_start}; next week ${s.week_end}.`}</Text>
 {separate && idle && s.profile_id ? <SportQuizAllowances snapshot={s} life={lifeRow} headerRef={weekRef}/> : null}
 {idle && s.profile_id ? <SportQuizLevel state={level}/> : null}
 {s.availability !== 'ready' ? <Text>{s.availability === 'paused' ? 'Sport Pop Quiz is paused. Private history remains available.' : s.availability === 'not_enrolled' ? 'Trivia is not available for this account yet.' : 'Trivia is unavailable for this account right now.'}</Text> : null}
 {idle && !round.ended && s.availability === 'ready' && !s.week_spent && !groupPrep ? <SportQuizPreparation snapshot={s} busy={busy || quiz.loading} initialSport={initialSport} onStart={(...args) => { void start(...args); }}/> : null}
 {idle && !round.ended && s.availability === 'ready' && !groupSpent && groupPrep ? <SportQuizPreparation key={groupPrep.groupId} snapshot={s} busy={busy || quiz.loading} group={{ label: groupPrep.label, theme: groupPrep.theme }} onCancel={() => setGroupPrep(null)} onStart={(_topic, _sport, duration) => { void start('sport', null, duration, groupPrep.groupId); }}/> : null}
 {round.pendingStart ? <><Text>We couldn’t confirm Start. You can retry the same choices while this page stays open and before time runs out.</Text><QuizButton label="Retry original Start" disabled={busy} onPress={() => { void round.retryStart(); }}/></> : null}
 <SportQuizRound round={round} busy={busy} reports={reports}/>
 {inRound || round.pendingStart || s.attempt?.status === 'issued' ? <QuizButton label="End round" quiet disabled={quiz.busy==='erase'} onPress={() => round.leave('user_end')}/> : null}
 {round.unavailableQuestion ? <Text accessibilityRole="alert">This question isn’t available, so the round ended safely. You can keep browsing.</Text> : null}
 {roundSummary ? <SportQuizRoundSummary round={round} reports={reports}/> : null}
 {levelUp && round.ended ? <LevelUpCelebration label={levelUp}/> : null}
 {round.ended && !inRound ? <QuizButton label="Back to this week’s rounds" quiet onPress={() => { invalidatePreparation(); round.dismiss(); setRefocus(r => ({ to: 'week', n: (r?.n ?? 0) + 1 })); void quiz.refresh(); }}/> : null}
 {!inRound && !roundSummary && !round.unavailableQuestion && (round.ended || s.attempt?.status === 'expired' || s.attempt?.status === 'ended' || s.attempt?.status === 'issued') && !timedResult ? <Text>Round ended or unavailable on this view. Leaving the page, hiding the app or tapping End round ends a round, and no question comes back after leaving. You can keep browsing and check private history.</Text> : null}
 {timedResult ? <View style={{ gap: 10 }}><Text accessibilityRole="header">Trivia complete</Text><TimedReveal result={timedResult}/><Text>{timedResult.was_correct ? 'That’s right.' : 'Thanks for learning.'}</Text><Text>{timedResult.explanation}</Text><Text>Right or wrong, you get the same private badge. You’ll find it in your history below.</Text></View> : null}
 {!round.live && round.pendingAnswer?.uncertain ? <QuizButton label="Check my answer" disabled={busy} onPress={() => { void round.recoverAnswer(); }}/> : null}
 {s.attempt?.status === 'skipped' ? <Text ref={skippedRef}>{separate ? 'You skipped your round this week. Your other rounds aren’t affected. Come back whenever you like.' : 'Skipped for this week. Come back whenever you like.'}</Text> : null}
 {/* On QUIZ-04 servers Skip spends only the personal round, so the label says so. */}
 {s.availability === 'ready' && !s.week_spent && idle ? <QuizButton label={separate ? 'Skip my round this week' : 'Skip this week'} quiet disabled={busy || quiz.loading} onPress={() => { void quiz.skip().then(done => { if (done) setRefocus(r => ({ to: 'skipped', n: (r?.n ?? 0) + 1 })); }); }}/> : null}
 {groupsVisible && !groupPrep ? (groups.openId
        ? <SportQuizGroupPage groups={groups} sports={sports} playable={playable} playNote={playNote} onPlay={(groupId, label, theme) => setGroupPrep({ groupId, label, theme })} onBack={groups.close}/>
        : <SportQuizGroups groups={groups}/>) : null}
 {/* Kept mounted (empty until Turn on / Turn off) so Android reads the change; iOS gets the announcement above. */}
 {!groupPageOpen ? <Text accessibilityLiveRegion="polite" style={life.notice ? undefined : { position: 'absolute', width: 1, height: 1, opacity: 0 }}>{life.notice ?? ''}</Text> : null}
 {lifeShown && idle && !round.ended ? <LifePlaybookCard life={life}/> : null}
 {lifeShown && idle ? <LifePlaybookHome life={life} canStart={lifeCanStart} busy={busy || life.saving} onStart={(chapter, duration) => { void start('sport', null, duration, null, chapter); }}/> : null}
 {idle && s.profile_id ? <SportQuizBadgeShelf badges={badges}/> : null}
 <SportQuizPreferences snapshot={s} busy={!!quiz.busy} suppressed={quiz.invitationsSuppressed} uncertain={quiz.preferenceUncertain} onSave={p => { void quiz.savePreferences(p); }}/>
 <SportQuizHistory quiz={quiz} onBeforeErase={round.discardForHistoryErase} lifeKnown={lifeVisible(life.snapshot)}/></> : null}
 </ScrollView>;
}
