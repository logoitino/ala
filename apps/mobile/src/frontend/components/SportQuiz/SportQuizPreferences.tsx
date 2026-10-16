/** QUIZ-02 invitation/topic choices; Manual only is persisted Off, not a third invitation mode. QUIZ-03: weekly rounds. */
import { Text, View } from 'react-native';
import { TIMED_QUIZ_NOTICE_VERSION, type TimedQuizPreferencesInput, type TimedQuizSnapshot } from '@shared/timedSportQuiz';
import { QuizButton } from './QuizButton';
/** @purpose Saving Off stops this presentation immediately; an unconfirmed server save stays explicit. */
export function SportQuizPreferences({ snapshot, busy, suppressed, uncertain, onSave }: {
    snapshot: TimedQuizSnapshot;
    busy: boolean;
    suppressed: boolean;
    uncertain: boolean;
    onSave: (p: TimedQuizPreferencesInput) => void;
}) {
    const save = (invitation_mode: 'off' | 'weekly', topic_mode = snapshot.preferences.topic_mode) => onSave({ invitation_mode, topic_mode, notice_version: TIMED_QUIZ_NOTICE_VERSION });
    return <View style={{ gap: 10 }}><Text accessibilityRole="header">Your trivia choices</Text>
 <Text>Invitations start off. Manual play is optional. Weekly invitations appear quietly on Home or your account home, with no popup or push. Saving these choices accepts the optional trivia notice shown here: one round of up to five timed questions per UTC week, private learning history and noncash completion badges.</Text>
 <Text>{suppressed ? 'Invitations off on this view.' : `Invitations: ${snapshot.preferences.invitation_mode}.`}</Text>
 {uncertain ? <Text accessibilityRole="alert">Server save not confirmed. Refresh to review it, or retry the same choices. Manual only does not end an active round.</Text> : null}
 <QuizButton label="Manual only · invitations off" quiet disabled={busy} onPress={() => save('off')}/>
 <QuizButton label="Enable quiet weekly invitations" quiet disabled={busy || snapshot.availability !== 'ready'} onPress={() => save('weekly')}/>
 <QuizButton label="Sports only" quiet disabled={busy} onPress={() => save(snapshot.preferences.invitation_mode, 'sports')}/>
 <QuizButton label="Mostly sports with optional fun topics" quiet disabled={busy} onPress={() => save(snapshot.preferences.invitation_mode, 'mix')}/>
 <Text>{snapshot.preferences.topic_mode === 'mix' ? 'The server schedules four sport weeks and one optional fun-topic week.' : 'Sports only.'} No unseen question means no forced repeat.</Text></View>;
}
