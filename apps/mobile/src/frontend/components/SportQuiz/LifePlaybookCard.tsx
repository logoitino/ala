/** QUIZ-04 Life Playbook opt-in card: "Life Playbook: real-life skills, sports style." Shows the Life notice (design §4,
 * including the trusted-adult line) with separate Turn on and Not now buttons; nothing is preselected. Turning on sends
 * the notice version this text belongs to. Shown only when the server says Life is available to this account, so
 * there is no teaser while Life is switched off. Copy never mentions age or unlocking.
 */
import { useEffect, useRef, useState } from 'react';
import { Text, View, type TextInstance } from 'react-native';
import type { LifePlaybookState } from '@/hooks/useLifePlaybook';
import { LIFE_NOTICE_VERSION } from '@shared/lifePlaybook';
import { colors, radii } from '@/constants/theme';
import { QuizButton } from './QuizButton';
import { focusSoon } from './SportQuizRound';

/** The trusted-adult line (design §3); also shown on the Life home. */
export const LIFE_TRUSTED_ADULT = 'For real decisions, talk with a parent, guardian, school counselor or another trusted adult.';
/** The Life notice text for LIFE_NOTICE_VERSION ('life-playbook-v1-testing'). A new wording needs a new version. */
export const LIFE_NOTICE_TEXT = [
    'Life Playbook is optional trivia about everyday money and life skills. It teaches general ideas, not advice for your situation, and never recommends products.',
    LIFE_TRUSTED_ADULT,
    'We save your rounds the same way as other trivia so we can avoid repeats and show your private badges.',
] as const;

/** @purpose The opt-in card for an account that has not turned Life on; hidden unless the server offers it. */
export function LifePlaybookCard({ life }: { life: LifePlaybookState }) {
    const [later, setLater] = useState(false);
    // After About Life Playbook, a screen reader lands on the card's title instead of losing its place.
    const [reopened, setReopened] = useState(0);
    const title = useRef<TextInstance>(null);
    useEffect(() => reopened ? focusSoon(title) : undefined, [reopened]);
    const s = life.snapshot;
    // Offer only the notice text this build holds; a newer server notice waits for an app update.
    if (!s || s.availability !== 'not_opted_in' || s.preferences?.life_opt_in === true || s.notice_version !== LIFE_NOTICE_VERSION) return null;
    if (later) return <QuizButton label="About Life Playbook" quiet onPress={() => { setLater(false); setReopened(n => n + 1); }}/>;
    return <View style={{ gap: 10, padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <Text ref={title} accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Life Playbook: real-life skills, sports style.</Text>
        {LIFE_NOTICE_TEXT.map(line => <Text key={line}>{line}</Text>)}
        <Text style={{ color: colors.textMuted }}>It has its own round each week and never uses up your other rounds. You can turn it off any time.</Text>
        {life.saveError ? <Text accessibilityRole="alert">{life.saveError}</Text> : null}
        <QuizButton label="Turn on Life Playbook" disabled={life.saving} onPress={() => { void life.setOptIn(true); }}/>
        <QuizButton label="Not now" quiet disabled={life.saving} onPress={() => setLater(true)}/>
    </View>;
}
