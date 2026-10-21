/** QUIZ-02 preparation reveals choices and notice before explicit Start, never a hidden question.
 * QUIZ-03: says the round has up to N questions, that leaving during an explanation ends the round, can preselect a
 * sport (Learn your athlete's sport) and doubles as the group round's preparation (no topic choice there).
 * QUIZ-04: on servers with separate weekly rounds, it names the spot Start uses (your round or the group round), and the
 * group preparation says group play never uses up your own round.
 */
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { TimedQuizSnapshot, TimedQuizTopic } from '@shared/timedSportQuiz';
import { telemetry } from '@/services/TelemetryManager';
import { FOCAL } from '@/theme/motion';
import { QuizButton } from './QuizButton';
const key = (topic: TimedQuizTopic, sport: string | null) => JSON.stringify([topic, sport]);
/** @purpose Duration and notice are voluntary, accessible choices without requesting health information. */
export function SportQuizPreparation({ snapshot, busy, onStart, initialSport = null, quickStart = false, group = null, onCancel }: {
    snapshot: TimedQuizSnapshot;
    busy: boolean;
    onStart: (topic: TimedQuizTopic, sport: string | null, duration: 30 | 90) => void;
    /** Preselects this sport when the viewer has unseen questions in it (case-insensitive match). */
    initialSport?: string | null;
    /** Highlight Play lands here with All sports and 30 seconds already chosen. The notice stays unchecked. */
    quickStart?: boolean;
    /** Group round: the group's own theme decides the questions, so no topic choice is shown. */
    group?: { label: string; theme: string | null } | null;
    onCancel?: () => void;
}) {
    const [duration, setDuration] = useState<30 | 90>(30);
    const [accepted, setAccepted] = useState(false);
    const pools = snapshot.pools.filter(p => p.allowed && p.unseen_count > 0);
    const preselected = initialSport ? pools.find(p => p.topic_category === 'sport' && p.sport.trim().toLowerCase() === initialSport.trim().toLowerCase()) : undefined;
    const topics = [...new Set(pools.map(p => p.topic_category))];
    const [selection, setSelection] = useState<string | null>(preselected ? key('sport', preselected.sport) : quickStart && topics.includes('sport') ? key('sport', null) : null);
    const selected = pools.find(p => key(p.topic_category, p.sport) === selection);
    const size = snapshot.round_size ?? 5;
    const ready = group ? true : !!selection && (!!selected || selection === key('sport', null));
  // Funnel top: one view per preparation shown, one press per Start tap. Views precede presses precede
  // confirmed starts, so viewed-but-never-pressed is friction and pressed-but-never-confirmed is technical.
  // Depend on the kind string (stable), not the group object (rebuilt every render). The dev-only demo
  // never mounts this component, so scripted rounds stay out of the funnel.
  const funnelKind = group ? 'group' : 'personal';
  useEffect(() => { telemetry.trackTriviaStep('view_prep', { kind: funnelKind }); }, [funnelKind]);
  // QUIZ-04 servers keep a separate spot per kind, so name the one this Start uses.
  const separate = !!snapshot.week_spent_by_kind;
  const startSpot = !separate ? 'this UTC week’s opportunity' : group ? 'this UTC week’s group round' : 'your round for this UTC week';
  const lostSpot = !separate ? 'this week’s opportunity' : group ? 'this week’s group round' : 'your round this week';
    return <View style={{ gap: 12, padding: 16, borderRadius: 20, backgroundColor: FOCAL.mistGold, borderWidth: 3, borderColor: FOCAL.electricGold }}>
  <Text accessibilityRole="header" style={{ color: FOCAL.ink, fontSize: 22, fontWeight: '900' }}>{group ? `${group.label} group round` : `Ready for a round of up to ${size} questions?`}</Text>
  {group ? <Text>{`${separate ? 'This uses this week’s group round. Group play never uses up your own round.' : 'This uses your one round this week.'} Everyone in the group plays the same theme: ${group.theme ?? 'all sports'}. The group only sees that you played, never your answers.`}</Text> : null}
  {preselected ? <Text>{`Learning ${preselected.sport} this week.`}</Text> : null}
  <Text>{`Optional testing activity. Start uses ${startSpot}: one round of up to ${size} questions, one at a time. A right answer adds 5 Aura to your card. Right or wrong, completing earns the same private Trivia Explorer badge. No money, voting or school points.`}</Text>
  <Text>Leaving this page, hiding the app or reaching the deadline closes the round. Leaving during an explanation also ends the round. You can always leave. The server decides whether an answer arrived in time.</Text>
  <Text>{`The clock starts when the server issues each question. Delivery uses part of your 30 or 90 seconds. A lost response may still use ${lostSpot}.`}</Text>
  <Text>Choose more time whenever you want; no reason is required.</Text>
  <QuizButton label="30 seconds" quiet selected={duration === 30} disabled={busy} onPress={() => setDuration(30)}/><QuizButton label="90 seconds · more time" quiet selected={duration === 90} disabled={busy} onPress={() => setDuration(90)}/>
  <Text>{`Selected duration: ${duration} seconds per question`}</Text>
  {!group && topics.includes('sport') ? <QuizButton label="All sports" quiet selected={selection === key('sport', null)} disabled={busy} onPress={() => setSelection(key('sport', null))}/> : null}
  {!group ? pools.map(p => <QuizButton key={key(p.topic_category, p.sport)} label={`Choose ${p.sport}`} quiet selected={selection === key(p.topic_category, p.sport)} disabled={busy} onPress={() => setSelection(key(p.topic_category, p.sport))}/>) : null}
  {!group && !pools.length ? <Text>No unseen reviewed question is available for this week’s topic. No repeat or alternative topic will be forced.</Text> : null}
  <Pressable accessibilityRole="checkbox" accessibilityLabel="I understand the trivia notice" accessibilityState={{ checked: accepted, disabled: busy }} disabled={busy} onPress={() => setAccepted(v => !v)} style={{ minHeight: 44, justifyContent: 'center' }}><Text>{accepted ? '✓ ' : '□ '}I understand the trivia notice and choose to participate.</Text></Pressable>
  <QuizButton label={group ? 'Start group round' : 'Start trivia'} disabled={busy || !accepted || !ready} onPress={() => { telemetry.trackTriviaStep('press_start', { kind: funnelKind, topic: group ? null : (selected?.topic_category ?? 'sport') }); if (group)
        onStart('sport', null, duration);
    else if (selection === key('sport', null))
        onStart('sport', null, duration);
    else if (selected)
        onStart(selected.topic_category, selected.topic_category === 'sport' ? selected.sport : null, duration); }}/>
  {onCancel ? <QuizButton label="Not now" quiet disabled={busy} onPress={onCancel}/> : null}
 </View>;
}
