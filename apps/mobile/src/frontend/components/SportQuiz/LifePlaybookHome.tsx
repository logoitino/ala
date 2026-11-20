/** QUIZ-04 Life Playbook home for an account that turned Life on: the chapters the server returns for this account
 * (open or coming soon) with their sports framing, private chapter progress ("seen N of M questions"), chapter levels
 * and private Life badges, the trusted-adult line, this week's Life round preparation and Turn off.
 * Only chapters the server returns are ever named (four 13+ chapters since the 2026-10-15 owner simplification);
 * nothing mentions age or unlocking. Explanations come from approved content (simple facts, no money figures, tax or
 * credit topics). This screen has no donation, checkout or money controls.
 * QUIZ-04 fun presentation (2026-10-15): each chapter card gets a small sports emoji accent (decorative, hidden from
 * screen readers), cascades in, and bounces on press; pressing an open chapter's card while a round can start picks
 * that chapter, the same as its "Choose …" button (which stays the accessible control). Life rounds use the same
 * round effects as every other round.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SPRING_BOUNCE } from '@/theme/motion';
import type { LifePlaybookState } from '@/hooks/useLifePlaybook';
import { lifeOn } from '@/hooks/useLifePlaybook';
import { LIFE_DEFAULT_DURATION, type LifeChapterId } from '@shared/lifePlaybook';
import { colors, radii } from '@/constants/theme';
import { DISPLAY_TEXT, figtree, TYPE } from '@/theme/fonts';
import { QuizButton } from './QuizButton';
import { LIFE_TRUSTED_ADULT } from './LifePlaybookCard';
import { PopIn, useQuizFx } from './QuizFx';

/** Sports-themed accents per chapter (decoration only); an unknown chapter gets the playbook. */
const CHAPTER_EMOJI: Record<string, string> = { money_huddle: '🏈', savings_season: '🏟️', scam_defense: '🛡️', smart_plays: '🎯' };

/** A chapter card with a press bounce. Not a separate screen-reader control: the "Choose …" button below is. */
function ChapterCard({ id, onPick, children }: { id: string; onPick: (() => void) | null; children: ReactNode }) {
    const { reduceMotion } = useQuizFx();
    const scale = useSharedValue(1);
    const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return <Animated.View style={animated}>
        <Pressable accessible={false} disabled={!onPick} onPress={onPick ?? undefined}
            onPressIn={() => { if (!reduceMotion) scale.value = withSpring(0.97, SPRING_BOUNCE); }}
            onPressOut={() => { if (!reduceMotion) scale.value = withSpring(1, SPRING_BOUNCE); }}
            style={{ minHeight: 44, flexDirection: 'row', gap: 8, padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            <Text aria-hidden style={{ fontSize: 26 }}>{CHAPTER_EMOJI[id] ?? '📘'}</Text>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>{children}</View>
        </Pressable>
    </Animated.View>;
}

/** @purpose Life home; `canStart` is the screen's decision that no other round is open and this page is idle. */
export function LifePlaybookHome({ life, canStart, busy, onStart }: {
    life: LifePlaybookState;
    canStart: boolean;
    busy: boolean;
    onStart: (chapter: LifeChapterId | null, duration: 30 | 90) => void;
}) {
    const [chapter, setChapter] = useState<LifeChapterId | null>(null);
    const [duration, setDuration] = useState<30 | 90>(LIFE_DEFAULT_DURATION);
    const [accepted, setAccepted] = useState(false);
    const s = life.snapshot;
    if (!s || !s.profile_id || s.preferences?.life_opt_in !== true) return null;
    const turnOff = <>
        <Text style={{ ...TYPE.body, ...figtree(), color: colors.textMuted }}>Turning Life Playbook off ends any open Life Playbook round. Your past rounds stay in your private history.</Text>
        <QuizButton label="Turn off Life Playbook" quiet disabled={life.saving || busy} onPress={() => { void life.setOptIn(false); }}/>
        {life.saveError ? <Text accessibilityRole="alert" style={{ ...TYPE.body, ...figtree(), color: colors.text }}>{life.saveError}</Text> : null}
    </>;
    // Turned on, but the server cannot serve Life right now: no chapters or Start, only a plain line and Turn off.
    if (!lifeOn(s)) return <View style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={{ ...TYPE.section, ...figtree('700'), color: colors.text }}>Life Playbook</Text>
        <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>Life Playbook isn’t available right now. Your setting is saved.</Text>
        {turnOff}
    </View>;
    const chapters = life.chapters?.chapters ?? [];
    // Progress is shown only for chapters the server returned in the chapter list for this account.
    const progressFor = (id: LifeChapterId) => life.progress?.chapters.find(c => c.id === id) ?? null;
    const playable = chapters.filter(c => c.open && c.unseen_count > 0);
    const chosen = chapter !== null && playable.some(c => c.id === chapter) ? chapter : null;
    const ready = canStart && s.availability === 'ready' && !s.week_spent && playable.length > 0;
    const size = s.round_size;
    return <View style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={{ ...TYPE.section, ...figtree('700'), color: colors.text }}>Life Playbook</Text>
        <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>Real-life skills, sports style. Your Life Playbook rounds, progress and badges are private to you.</Text>
        <Text style={{ ...TYPE.body, ...figtree('600'), color: colors.text }}>{LIFE_TRUSTED_ADULT}</Text>
        {s.week_spent ? <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>You’ve played this week’s Life Playbook round. New questions come next week.</Text> : null}
        {!s.week_spent && s.availability === 'empty' ? <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>You’ve seen every Life Playbook question we have right now. More are on the way.</Text> : null}
        <Text accessibilityRole="header" style={{ ...TYPE.section, ...figtree('700'), color: colors.text }}>Chapters</Text>
        {life.loading && !life.chapters ? <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>Loading chapters…</Text> : null}
        {chapters.map((c, index) => {
            const p = progressFor(c.id);
            const pick = ready && !busy && playable.some(open => open.id === c.id) ? () => setChapter(c.id) : null;
            return <PopIn key={c.id} delay={index * 60}><ChapterCard id={c.id} onPick={pick}>
                <Text style={{ ...TYPE.section, ...DISPLAY_TEXT, color: colors.text }}>{c.title}</Text>
                {c.framing ? <Text style={{ ...TYPE.body, ...figtree(), color: colors.textMuted }}>{c.framing}</Text> : null}
                <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>{c.open ? 'Open' : 'Coming soon'}</Text>
                {p && p.approved_count > 0 ? <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>{`Seen ${Math.min(p.seen_count, p.approved_count)} of ${p.approved_count} questions`}</Text> : null}
                {p ? <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>{`Chapter level: ${p.level_label}`}</Text> : null}
                {p?.badge_earned ? <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>{`${c.title} Playbook badge earned. Only you see it.`}</Text> : null}
            </ChapterCard></PopIn>;
        })}
        {ready ? <View style={{ gap: 10 }}>
            <Text accessibilityRole="header" style={{ ...TYPE.section, ...figtree('700'), color: colors.text }}>{`This week’s Life Playbook round: up to ${size} questions`}</Text>
            <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>One question at a time, each with its own timer. Leaving this page, hiding the app or tapping End round ends the round, and leaving during an explanation also ends it.</Text>
            <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>The clock starts when the server issues each question. Delivery uses part of your time. A lost response may still use this week’s Life Playbook round.</Text>
            <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>Every answered question counts toward your level, right or wrong. This round never uses up your own round or your group round.</Text>
            <QuizButton label="Any open chapter" quiet selected={chosen === null} disabled={busy} onPress={() => setChapter(null)}/>
            {playable.map(c => <QuizButton key={c.id} label={`Choose ${c.title}`} quiet selected={chosen === c.id} disabled={busy} onPress={() => setChapter(c.id)}/>)}
            <QuizButton label="90 seconds" quiet selected={duration === 90} disabled={busy} onPress={() => setDuration(90)}/>
            <QuizButton label="30 seconds · quicker" quiet selected={duration === 30} disabled={busy} onPress={() => setDuration(30)}/>
            <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>{`Selected time: ${duration} seconds per question`}</Text>
            {/* Its own name: the personal round's checkbox can be on the same page. */}
            <Pressable accessibilityRole="checkbox" accessibilityLabel="I understand the trivia notice and choose to play Life Playbook" accessibilityState={{ checked: accepted, disabled: busy }} disabled={busy}
                onPress={() => setAccepted(v => !v)} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ ...TYPE.body, ...figtree(), color: colors.text }}>{accepted ? '✓ ' : '□ '}I understand the trivia notice and choose to play Life Playbook.</Text>
            </Pressable>
            <QuizButton label="Start Life Playbook round" disabled={busy || !accepted} onPress={() => onStart(chosen, duration)}/>
        </View> : null}
        {turnOff}
    </View>;
}
