/** QUIZ-04 fun presentation (2026-10-15): the game-show-meets-game-day effects kit for the trivia screen.
 * - `QuizFxProvider` shares the person's Reduce Motion setting, whether the page is in front, and the sound choice.
 * - `PopIn` (springy entrance; a plain fade with Reduce Motion), `Wiggle` (one soft shake for "not quite"),
 *   `InviteBounce` (a gentle bounce inviting Next), `CheerStage` (the cheer banner with a small confetti burst
 *   clipped inside it), `LevelUpCelebration` (the one-time "Level up: …!" moment) and `QuizSoundToggle` ("Sound on / Sound off", saved on this device).
 * Rules every piece follows: animations run on the UI thread (Reanimated); decorations are hidden from screen readers,
 * take no touches and never cover answers, the timer text, Next or End round (confetti is clipped to its banner);
 * every cue also exists as text; nothing flashes; nothing here waits before an answer, Next or End is sent.
 * @sideEffects Reanimated animations and one confetti burst per mounted CheerStage; sound via `useQuizSound`.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useQuizSound } from '@/hooks/useQuizSound';
import type { QuizCue } from '@/lib/quizSound';
import { FOCAL, SPRING_BOUNCE, SPRING_CARD } from '@/theme/motion';
import { colors, radii } from '@/constants/theme';
import { DISPLAY_TEXT, figtree, TYPE } from '@/theme/fonts';
import { levelUpLine } from './quizCheers';

type QuizFx = {
    /** The person's Reduce Motion setting: no confetti, wiggles or bounces, only fades. */
    reduceMotion: boolean;
    /** Reduce Motion, or the page is not in front: no looping or bursting effects at all. */
    still: boolean;
    soundOn: boolean;
    toggleSound: () => void;
    play: (cue: QuizCue) => void;
};
/** Outside the trivia screen (for example the Home invitation card) everything stays still and silent. */
const QUIET: QuizFx = { reduceMotion: true, still: true, soundOn: false, toggleSound: () => {}, play: () => {} };
const QuizFxContext = createContext<QuizFx>(QUIET);

/** Props that take a decoration out of the accessibility tree and out of touch handling. */
const DECOR = { 'aria-hidden': true, importantForAccessibility: 'no-hide-descendants', pointerEvents: 'none' } as const;

/** @purpose Mount once around the trivia screen; `focused` false pauses every looping or bursting effect. */
export function QuizFxProvider({ focused, children }: { focused: boolean; children: ReactNode }) {
    const reduceMotion = useReduceMotion();
    const sound = useQuizSound();
    const value = useMemo<QuizFx>(() => ({ reduceMotion, still: reduceMotion || !focused, soundOn: sound.enabled, toggleSound: sound.toggle, play: sound.play }),
        [reduceMotion, focused, sound.enabled, sound.toggle, sound.play]);
    return <QuizFxContext.Provider value={value}>{children}</QuizFxContext.Provider>;
}

/** @purpose Read the effects settings and the cue player. */
export function useQuizFx(): QuizFx {
    return useContext(QuizFxContext);
}

/** @purpose Springy entrance on mount (slide up, slide from the right, or pop); a short fade with Reduce Motion. */
export function PopIn({ children, delay = 0, from = 'up', style }: { children: ReactNode; delay?: number; from?: 'up' | 'right' | 'pop'; style?: StyleProp<ViewStyle> }) {
    const { reduceMotion } = useQuizFx();
    const progress = useSharedValue(0);
    useEffect(() => {
        progress.value = withDelay(delay, reduceMotion ? withTiming(1, { duration: 200 }) : withSpring(1, SPRING_CARD));
        // Mount-only: an entrance plays once per question / card.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const animated = useAnimatedStyle(() => {
        const p = progress.value;
        if (reduceMotion) return { opacity: p };
        const transform = from === 'right' ? [{ translateX: (1 - p) * 40 }] : from === 'pop' ? [{ scale: 0.85 + p * 0.15 }] : [{ translateY: (1 - p) * 24 }];
        return { opacity: Math.min(1, p * 1.5), transform };
    });
    return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/** @purpose One soft side-to-side shake on mount when `active` (a "not quite" answer). Never with Reduce Motion. */
export function Wiggle({ children, active }: { children: ReactNode; active: boolean }) {
    const { reduceMotion } = useQuizFx();
    const on = active && !reduceMotion;
    const x = useSharedValue(0);
    useEffect(() => {
        if (on) x.value = withSequence(withTiming(-6, { duration: 70 }), withTiming(6, { duration: 90 }), withTiming(-4, { duration: 80 }), withTiming(3, { duration: 70 }), withTiming(0, { duration: 60 }));
        // Mount-only: one wiggle per reveal.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const animated = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
    return <Animated.View testID={on ? 'quiz-wiggle' : undefined} style={animated}>{children}</Animated.View>;
}

/** @purpose After a short pause, two gentle bounces that invite the next tap. The wrapped button works the whole time. */
export function InviteBounce({ children }: { children: ReactNode }) {
    const { still } = useQuizFx();
    const scale = useSharedValue(1);
    useEffect(() => {
        if (still) { cancelAnimation(scale); scale.value = 1; return; }
        scale.value = withDelay(1400, withRepeat(withSequence(withTiming(1.05, { duration: 220 }), withSpring(1, SPRING_BOUNCE)), 2, false));
        return () => cancelAnimation(scale);
    }, [still, scale]);
    const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return <Animated.View testID={still ? undefined : 'quiz-invite-bounce'} style={animated}>{children}</Animated.View>;
}

/** Banner looks per moment. Calm cyan for encouragement, warm gold for the whistle and big moments; never red. */
const TONES = {
    cheer: { bg: FOCAL.mistJade, ink: FOCAL.jadeInk, border: FOCAL.neonJade, emoji: '🎉' },
    encourage: { bg: FOCAL.mistCyan, ink: FOCAL.cyanInk, border: FOCAL.islandCyan, emoji: '💪' },
    whistle: { bg: FOCAL.mistGold, ink: FOCAL.goldInk, border: FOCAL.electricGold, emoji: '⏱️' },
    round: { bg: FOCAL.mistGold, ink: FOCAL.goldInk, border: FOCAL.electricGold, emoji: '🏅' },
    level: { bg: FOCAL.mistViolet, ink: FOCAL.violetInk, border: FOCAL.electricViolet, emoji: '🏆' },
} as const;
const CONFETTI_COLORS = [FOCAL.neonJade, FOCAL.electricGold, FOCAL.islandCyan, FOCAL.electricViolet, '#FFFFFF'];
/** Modest bursts: enough to feel like game day, light enough for older phones. */
const BURST_COUNT = { small: 36, big: 64 } as const;

/** @purpose The game-day kicker banner ("Touchdown!", "Good hustle!", "Whistle!"). Its confetti is clipped inside the
 * banner so it never covers a control; with Reduce Motion (or the page in the background) there is no confetti and
 * the words simply fade in. The words are ordinary text, so screen readers read them in order. */
export function CheerStage({ text, tone, burst = null, compact = false }: { text: string; tone: keyof typeof TONES; burst?: keyof typeof BURST_COUNT | null; compact?: boolean }) {
    const { reduceMotion, still } = useQuizFx();
    const look = TONES[tone];
    const [width, setWidth] = useState(320);
    const pop = useSharedValue(0);
    useEffect(() => {
        pop.value = reduceMotion ? withTiming(1, { duration: 200 }) : withSequence(withSpring(1.12, SPRING_BOUNCE), withSpring(1, SPRING_CARD));
        // Mount-only: one pop per moment.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const animated = useAnimatedStyle(() => reduceMotion ? { opacity: pop.value } : { opacity: Math.min(1, pop.value * 2), transform: [{ scale: 0.6 + pop.value * 0.4 }] });
    const onLayout = (event: LayoutChangeEvent) => { const w = Math.round(event.nativeEvent.layout.width); if (w > 0 && w !== width) setWidth(w); };
    return <View onLayout={onLayout} style={[styles.stage, compact && styles.stageCompact, { backgroundColor: look.bg, borderColor: look.border }]}>
        {burst && !still ? <View testID="quiz-confetti" {...DECOR} style={StyleSheet.absoluteFill}>
            <ConfettiCannon count={BURST_COUNT[burst]} origin={{ x: width / 2, y: 0 }} explosionSpeed={320} fallSpeed={2000} fadeOut colors={CONFETTI_COLORS}/>
        </View> : null}
        <Animated.View style={[styles.kickerRow, animated]}>
            <Text {...DECOR} style={[styles.emoji, compact && styles.emojiCompact]}>{look.emoji}</Text>
            <Text style={[styles.kicker, compact && styles.kickerCompact, { color: look.ink }]}>{text}</Text>
        </Animated.View>
    </View>;
}

/** @purpose The one-time level-up celebration: kicker with confetti, plain text and the bigger fanfare. */
export function LevelUpCelebration({ label }: { label: string }) {
    const line = levelUpLine(label);
    // iOS ignores live regions; announce the new level once (Android reads the polite region below).
    useEffect(() => { if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility?.(line); }, [line]);
    return <View style={{ gap: 8 }}>
        <CheerStage text={line} tone="level" burst="big"/>
        <Text accessibilityLiveRegion="polite" style={styles.body}>{`You reached ${label}. Levels never go down.`}</Text>
    </View>;
}
/** @purpose "Sound on / Sound off" switch, saved on this device. On phones it controls trivia vibrations for now. */
export function QuizSoundToggle() {
    const fx = useQuizFx();
    return <Pressable accessibilityRole="switch" accessibilityLabel="Trivia sound" accessibilityState={{ checked: fx.soundOn }}
        accessibilityHint={Platform.OS === 'web' ? 'Turns short trivia sounds on or off.' : 'On phones this turns trivia vibrations on or off.'}
        onPress={fx.toggleSound} style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
        <Text style={styles.toggleLabel}>{fx.soundOn ? '🔊 Sound on' : '🔇 Sound off'}</Text>
    </Pressable>;
}

const styles = StyleSheet.create({
    stage: { minHeight: 56, borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10 },
    stageCompact: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 10 },
    kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, maxWidth: '100%' },
    emoji: { fontSize: 26 },
    emojiCompact: { fontSize: 18 },
    kicker: { ...TYPE.title, ...DISPLAY_TEXT, flexShrink: 1 },
    kickerCompact: { ...TYPE.section },
    toggle: { minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, justifyContent: 'center', maxWidth: '100%' },
    toggleLabel: { ...TYPE.button, ...figtree('600'), color: colors.text },
    body: { ...TYPE.body, ...figtree(), color: colors.text },
    pressed: { opacity: 0.7 },
});
