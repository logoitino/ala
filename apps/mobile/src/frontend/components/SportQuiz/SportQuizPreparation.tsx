/** QUIZ-02 preparation reveals choices and notice before explicit Start, never a hidden question. */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { TimedQuizSnapshot, TimedQuizTopic } from '@shared/timedSportQuiz';
import { QuizButton } from './QuizButton';
/** @purpose Duration and notice are voluntary, accessible choices without requesting health information. */
export function SportQuizPreparation({ snapshot, busy, onStart }: {
    snapshot: TimedQuizSnapshot;
    busy: boolean;
    onStart: (topic: TimedQuizTopic, sport: string | null, duration: 30 | 90) => void;
}) {
    const [duration, setDuration] = useState<30 | 90>(30);
    const [accepted, setAccepted] = useState(false);
    const pools = snapshot.pools.filter(p => p.allowed && p.unseen_count > 0);
    const [selection, setSelection] = useState<string | null>(null);
    const selected = pools.find(p => JSON.stringify([p.topic_category, p.sport]) === selection);
    const topics = [...new Set(pools.map(p => p.topic_category))];
    return <View style={{ gap: 12 }}>
  <Text accessibilityRole="header">Ready for one small question?</Text>
  <Text>Optional testing activity. Start uses this UTC week’s opportunity. Right or wrong, completing earns the same private Trivia Explorer badge. No money, Aura, voting or school points.</Text>
  <Text>Leaving this page, hiding the app or reaching the deadline closes the round. You can always leave. The server decides whether an answer arrived in time.</Text>
  <Text>The clock starts when the server issues the question. Delivery uses part of your 30 or 90 seconds. A lost response may still use this week’s opportunity.</Text>
  <Text>Choose more time whenever you want; no reason is required.</Text>
  <QuizButton label="30 seconds" quiet disabled={busy} onPress={() => setDuration(30)}/><QuizButton label="90 seconds · more time" quiet disabled={busy} onPress={() => setDuration(90)}/>
  <Text>{`Selected duration: ${duration} seconds`}</Text>
  {topics.includes('sport') ? <QuizButton label="All sports" quiet disabled={busy} onPress={() => setSelection(JSON.stringify(['sport', null]))}/> : null}
  {pools.map(p => <QuizButton key={JSON.stringify([p.topic_category, p.sport])} label={`Choose ${p.sport}`} quiet disabled={busy} onPress={() => setSelection(JSON.stringify([p.topic_category, p.sport]))}/>)}
  {!pools.length ? <Text>No unseen reviewed question is available for this week’s topic. No repeat or alternative topic will be forced.</Text> : null}
  <Pressable accessibilityRole="checkbox" accessibilityLabel="I understand the trivia notice" accessibilityState={{ checked: accepted, disabled: busy }} disabled={busy} onPress={() => setAccepted(v => !v)}><Text>{accepted ? '✓ ' : '□ '}I understand the trivia notice and choose to participate.</Text></Pressable>
  <QuizButton label="Start trivia" disabled={busy || !accepted || !selection || (!selected && selection !== JSON.stringify(['sport', null]))} onPress={() => { if (selection === JSON.stringify(['sport', null]))
        onStart('sport', null, duration);
    else if (selected)
        onStart(selected.topic_category, selected.topic_category === 'sport' ? selected.sport : null, duration); }}/>
 </View>;
}
