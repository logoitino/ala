/** QUIZ-04 fun presentation demo (2026-10-15, owner request): a dev-only page that shows the real trivia components
 * (round, reveal, summary, level-up, Life chapter cards, Sound switch, effects) driven by a local scripted round.
 * Demo only: no database, no network, nothing saved, no badge or level changes. It is mounted only by
 * `app/dev/trivia-preview.tsx`, which redirects to Home in production builds, and it is not linked from any menu.
 * The five sample questions are copied from the reviewed banks (`supabase/content/trivia_starter_bank.json` and
 * `life_playbook_bank.json`) so the page needs no data access.
 * @sideEffects One local 250 ms ticker while a demo question is open (cleared on leave/unmount); sound via QuizFx.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { ScreenShell } from '@/components/ScreenShell';
import { PlayNavBar } from '@/components/UI/PlayNavBar';
import type { TimedQuizRoundState } from '@/hooks/useTimedSportQuizRound';
import type { LifePlaybookState } from '@/hooks/useLifePlaybook';
import type { TimedQuizQuestion, TimedQuizResult } from '@shared/timedSportQuiz';
import { radii } from '@/constants/theme';
import { FOCAL } from '@/theme/motion';
import { QuizButton } from './QuizButton';
import { LevelUpCelebration, QuizFxProvider, QuizSoundToggle } from './QuizFx';
import { SportQuizRound, SportQuizRoundSummary } from './SportQuizRound';
import { LifePlaybookHome } from './LifePlaybookHome';

/** @purpose The preview exists in local and test builds only; a store build (`EXPO_PUBLIC_APP_ENV=production`) never shows it. */
export function triviaPreviewAvailable(): boolean {
    return process.env.EXPO_PUBLIC_APP_ENV !== 'production';
}

type Sample = TimedQuizQuestion & { correct: number; explanation: string };
const q = (id: string, topic: TimedQuizQuestion['topic_category'], sport: string, prompt: string, options: string[], correct: number, explanation: string): Sample =>
    ({ id, question_key: id, version: 1, topic_category: topic, sport, prompt, options, question_type: options.length === 2 ? 'true_false' : 'choice4', correct, explanation });
/** One sport fact plus history, the job site, and practice fuel, copied from the starter bank. */
const SAMPLES: Sample[] = [
    q('demo-1', 'sport', 'Basketball', 'How high above the floor is the rim of a regulation basketball hoop?', ['8 feet', '9 feet', '10 feet', '12 feet'], 2,
        'The rim is 10 feet above the floor. That height has stayed the same since the game’s early days, from high school gyms to the pros.'),
    q('demo-2', 'general', 'General', 'The Constitution is the highest law in the United States.', ['True', 'False'], 0,
        'True! The Constitution sits above other laws in the United States. Public officials promise to support it.'),
    q('demo-3', 'general', 'General', 'What does an electrician work with in a building?', ['Wiring and electrical systems', 'Only the paint on the walls', 'The grass on the field', 'The lines on a court'], 0,
        'An electrician installs and looks after wiring and electrical systems. That work brings light and power into a building.'),
    q('demo-4', 'general', 'General', 'Why do people on a construction site wear hard hats?', ['To protect the head from falling objects', 'To keep the score', 'To carry water', 'To mark the team captain'], 0,
        'A hard hat protects the head. Tools and materials can fall on a job site.'),
    q('demo-5', 'general', 'General', 'After practice, muscles rebuild using which nutrient?', ['Protein', 'Food coloring', 'Sand', 'Chalk'], 0,
        'Protein is a nutrient the body uses when muscles rebuild after practice. Beans, eggs, milk, fish, and meat provide it. A parent or a doctor can help with meals.'),
];
const PLANNED = SAMPLES.length;
const DEMO_SECONDS = 30;
/** Pretend network time before a reveal, so the pressed state is visible. */
const FAKE_SERVER_MS = 350;

type Entry = TimedQuizRoundState['entries'][number];
type Scene = { kind: 'idle' | 'live' | 'closing' | 'between' | 'summary' | 'life'; position: number; deadline: number; picked: number | null;
    entries: Entry[]; between: Entry | null; levelUp: string | null; endedEarly: boolean };
const IDLE: Scene = { kind: 'idle', position: 0, deadline: 0, picked: null, entries: [], between: null, levelUp: null, endedEarly: false };

function resultFor(position: number, option: number | null): TimedQuizResult {
    const s = SAMPLES[position - 1];
    return { answered_option: option, correct_option: s.correct, was_correct: option === null ? null : option === s.correct, explanation: s.explanation,
        completed_at: option === null ? null : new Date().toISOString(), position, item_status: option === null ? 'expired' : 'answered' };
}
const entryFor = (position: number, option: number | null): Entry => ({ position, question: SAMPLES[position - 1], result: resultFor(position, option) });

/** Chapter cards for the Life Playbook view (shape of the server reads; local only). */
const LIFE_CHAPTERS = [
    { id: 'money_huddle', title: 'Money Huddle', framing: 'Calling the play before you spend', position: 1, open: true, unseen_count: 5 },
    { id: 'savings_season', title: 'Savings Season', framing: 'Building your bench', position: 2, open: true, unseen_count: 5 },
    { id: 'scam_defense', title: 'Scam Defense', framing: 'Defense wins', position: 3, open: true, unseen_count: 5 },
    { id: 'smart_plays', title: 'Smart Plays', framing: 'Good calls every day', position: 4, open: false, unseen_count: 0 },
] as const;
const DEMO_LIFE = {
    snapshot: { contract_version: 4, profile_id: 'demo', availability: 'ready', preferences: { life_opt_in: true }, week_spent: false, round_size: 5 },
    chapters: { chapters: LIFE_CHAPTERS },
    progress: { chapters: LIFE_CHAPTERS.map((c, i) => ({ id: c.id, title: c.title, approved_count: 10, seen_count: i * 2, progress: 0, facts: i * 2, rank: 0, level: 'rookie', level_label: 'Rookie', badge_earned: i === 1 })) },
    loading: false, saving: false, saveError: null, error: null, notice: null, switchedOff: false,
    setOptIn: async () => null, refresh: async () => {},
} as unknown as LifePlaybookState;

/** @purpose The demo page: scripted round controls plus the real trivia components. */
export function TriviaPreview() {
    const focused = useIsFocused();
    const [scene, setScene] = useState<Scene>(IDLE);
    const [, tick] = useState(0);
    // Each scene change remounts the round view, so entrances, cheers and confetti replay.
    const [sceneKey, setSceneKey] = useState(0);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const go = (next: Scene) => { timers.current.forEach(clearTimeout); timers.current = []; setScene(next); setSceneKey(k => k + 1); };
    const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
    const ask = (position: number, base: Scene) => go({ ...base, kind: 'live', position, deadline: Date.now() + DEMO_SECONDS * 1000, picked: null, between: null });
    const remaining = scene.kind === 'live' ? Math.max(0, Math.ceil((scene.deadline - Date.now()) / 1000)) : 0;

    // A real ticking clock for the open question; time running out shows the whistle, then the fact.
    useEffect(() => {
        if (scene.kind !== 'live' || scene.picked !== null) return;
        const id = setInterval(() => {
            tick(n => n + 1);
            if (Date.now() >= scene.deadline) {
                clearInterval(id);
                setScene(s => ({ ...s, kind: 'closing' }));
                later(() => setScene(s => {
                    const entry = entryFor(s.position, null);
                    return { ...s, kind: 'between', entries: [...s.entries, entry], between: entry };
                }), 900);
            }
        }, 250);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene.kind, scene.deadline, scene.picked]);
    // Leaving the page ends the demo round, like the real one; unmount clears every timer.
    useEffect(() => { if (!focused) go(IDLE); }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    const round = useMemo(() => {
        const live = scene.kind === 'live' ? { question: SAMPLES[scene.position - 1], attemptId: 'demo' } : null;
        const ended = scene.kind === 'summary';
        return {
            live, item: live || scene.kind === 'closing' ? { position: scene.position, planned: PLANNED } : null, remainingSeconds: remaining, duration: DEMO_SECONDS,
            closing: scene.kind === 'closing', between: scene.kind === 'between' && scene.between ? { attemptId: 'demo', position: scene.position, planned: PLANNED, question: scene.between.question, result: scene.between.result } : null,
            pendingAnswer: scene.picked !== null ? { option: scene.picked, uncertain: false } : null, pendingNext: null, busy: null, error: null,
            result: ended ? { outcome: scene.endedEarly ? 'ended' : 'completed' } : null, ended, mode: 'round', entries: scene.entries, roundSize: PLANNED, planned: PLANNED,
            shortRound: false, endedEarly: scene.endedEarly, unavailableQuestion: false, groupId: null, kind: 'personal',
            answer: async (option: number) => {
                if (scene.kind !== 'live' || scene.picked !== null) return null;
                setScene(s => ({ ...s, picked: option }));
                later(() => setScene(s => {
                    const entry = entryFor(s.position, option);
                    const entries = [...s.entries, entry];
                    // The last answer completes the round straight away, as the server does.
                    return s.position >= PLANNED ? { ...s, kind: 'summary', entries, picked: null } : { ...s, kind: 'between', entries, between: entry, picked: null };
                }), FAKE_SERVER_MS);
                return null;
            },
            next: async () => { if (scene.kind !== 'between') return null; if (scene.position >= PLANNED) go({ ...scene, kind: 'summary' }); else ask(scene.position + 1, scene); return null; },
            leave: () => go({ ...scene, kind: 'summary', endedEarly: true }),
        } as unknown as TimedQuizRoundState;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scene, remaining]);

    const inRound = scene.kind === 'live' || scene.kind === 'between' || scene.kind === 'closing';
    const showEntry = (position: number, option: number | null) => { const entry = entryFor(position, option); go({ ...IDLE, kind: 'between', position, entries: [entry], between: entry }); };
    const roundEnd = (levelUp: string | null) => go({ ...IDLE, kind: 'summary', entries: [entryFor(1, 2), entryFor(2, 0), entryFor(3, null), entryFor(4, 0)], levelUp });

    return <ScreenShell edges={['top', 'left', 'right']} style={{ paddingBottom: 0 }}><QuizFxProvider focused={focused}>
        <View style={{ flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center', backgroundColor: inRound ? '#F3E8FF' : '#F6F1FF' }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, gap: 6, paddingBottom: 16 }}>
            <View accessibilityRole="alert" style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: radii.md, borderWidth: 2, borderColor: FOCAL.goldInk, backgroundColor: FOCAL.electricGold }}>
                <Text style={{ fontWeight: '800', color: FOCAL.ink, fontSize: 13 }}>Demo only: nothing is saved.</Text>
            </View>
            <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '900', color: FOCAL.violetInk }}>Trivia preview</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                <QuizButton label="Play a demo round" onPress={() => ask(1, IDLE)}/>
                <QuizButton label="Show right answer" quiet onPress={() => showEntry(1, 2)}/>
                <QuizButton label="Show not quite" quiet onPress={() => showEntry(2, 0)}/>
                <QuizButton label="Show time up" quiet onPress={() => showEntry(3, null)}/>
                <QuizButton label="Show round end" quiet onPress={() => roundEnd(null)}/>
                <QuizButton label="Show level up" quiet onPress={() => roundEnd('All-Star')}/>
                <QuizButton label="Life Playbook cards" quiet onPress={() => go({ ...IDLE, kind: 'life' })}/>
                <QuizSoundToggle/>
            </ScrollView>
            {scene.kind === 'idle' ? <Text>Pick a button to see a moment, or play a five-question demo round with a real 30-second clock.</Text> : null}
            <View key={sceneKey} style={{ gap: 8 }}>
                <SportQuizRound round={round} busy={false}/>
                {inRound ? <QuizButton label="End round" quiet onPress={() => round.leave('user_end')}/> : null}
                {scene.kind === 'summary' ? <SportQuizRoundSummary round={round} nextWeekLine="This week’s five are done. Next week unlocks a subject off the field."/> : null}
                {scene.kind === 'summary' && scene.levelUp ? <LevelUpCelebration label={scene.levelUp}/> : null}
                {scene.kind === 'life' ? <LifePlaybookHome life={DEMO_LIFE} canStart busy={false} onStart={() => ask(1, IDLE)}/> : null}
            </View>
        </ScrollView>
        <PlayNavBar/>
        </View>
    </QuizFxProvider></ScreenShell>;
}
