/** QUIZ-04 fun presentation (2026-10-15): the round's visual progress pieces.
 * - `QuestionDots`: little jersey numbers 1–5 that fill as the round moves on (progress only: never right / wrong,
 *   so there is no streak or score to compare).
 * - `TimerBar`: a draining shot-clock bar that turns warm gold with a gentle ticking pulse in the last 10 seconds
 *   (never panic red; the pulse is about once a second, well under three flashes a second).
 * - `FactsCountUp`: the round summary's "facts learned" medal that counts up.
 * All three are decorations hidden from screen readers: the visible text beside them ("Question 2 of 5",
 * "12 seconds left", "You learned 3 new facts") carries the same information and keeps its announcements.
 * @sideEffects Reanimated animations; FactsCountUp runs one interval that is cleared on unmount.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { FOCAL, SPRING_BOUNCE } from '@/theme/motion';
import { colors } from '@/constants/theme';
import { DISPLAY_TEXT, figtree, TYPE } from '@/theme/fonts';
import { useQuizFx } from './QuizFx';

const DECOR = { 'aria-hidden': true, importantForAccessibility: 'no-hide-descendants', pointerEvents: 'none' } as const;
/** Last-10-seconds threshold, the same moment the "10 seconds left" announcement fires. */
const WARM_AT = 10;
/** Count-up step: under three changes a second. */
const COUNT_STEP_MS = 360;

/** @purpose Jersey-number dots: `done` positions filled, `current` (the open question) ringed and popped. */
export function QuestionDots({ planned, done, current = null }: { planned: number; done: number; current?: number | null }) {
    const count = Math.max(0, Math.min(planned, 10));
    return <View {...DECOR} testID="quiz-dots" style={styles.dots}>
        {Array.from({ length: count }, (_, i) => i + 1).map(n => <Dot key={n} n={n} state={n === current ? 'current' : n <= done ? 'done' : 'next'}/>)}
    </View>;
}

function Dot({ n, state }: { n: number; state: 'done' | 'current' | 'next' }) {
    const { reduceMotion } = useQuizFx();
    const scale = useSharedValue(1);
    useEffect(() => {
        if (state === 'current' && !reduceMotion) scale.value = withSequence(withTiming(1.25, { duration: 140 }), withSpring(1, SPRING_BOUNCE));
    }, [state, reduceMotion, scale]);
    const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return <Animated.View style={[styles.dot, state === 'done' && styles.dotDone, state === 'current' && styles.dotCurrent, animated]}>
        <Text style={[styles.dotLabel, state !== 'next' && styles.dotLabelOn]}>{n}</Text>
    </Animated.View>;
}

/** @purpose Shot-clock bar for the open question. `remaining` and `duration` come from the round hook (server deadline);
 * the bar only draws them and never changes the clock. */
export function TimerBar({ remaining, duration }: { remaining: number; duration: number | null }) {
    const { reduceMotion, still } = useQuizFx();
    const total = duration && duration > 0 ? duration : 30;
    const share = (seconds: number) => Math.max(0, Math.min(1, seconds / total));
    const warm = remaining <= WARM_AT;
    const fill = useSharedValue(share(remaining));
    const pulse = useSharedValue(1);
    // Drain smoothly toward the next whole second; with Reduce Motion the bar steps once a second instead.
    useEffect(() => {
        fill.value = reduceMotion ? share(remaining) : withTiming(share(remaining - 1), { duration: 1000, easing: Easing.linear });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [remaining, reduceMotion]);
    useEffect(() => {
        if (!warm || still) { cancelAnimation(pulse); pulse.value = 1; return; }
        pulse.value = withRepeat(withSequence(withTiming(1.18, { duration: 450 }), withTiming(1, { duration: 450 })), -1, false);
        return () => cancelAnimation(pulse);
    }, [warm, still, pulse]);
    const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
    const clockStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
    return <View {...DECOR} testID={warm ? 'quiz-timer-warm' : 'quiz-timer'} style={styles.timerRow}>
        <Animated.Text style={[styles.clock, clockStyle]}>⏱️</Animated.Text>
        <View style={[styles.track, warm && styles.trackWarm]}>
            <Animated.View style={[styles.fill, { backgroundColor: warm ? FOCAL.electricGold : FOCAL.neonJade }, fillStyle]}/>
        </View>
    </View>;
}

/** @purpose The summary medal: counts 0 → `to` (instantly with Reduce Motion). The sentence below it stays the
 * screen-reader text, so nobody hears the numbers tick. */
export function FactsCountUp({ to, compact = false }: { to: number; compact?: boolean }) {
    const { reduceMotion } = useQuizFx();
    const [shown, setShown] = useState(reduceMotion ? to : 0);
    const pop = useSharedValue(1);
    useEffect(() => {
        if (reduceMotion || to <= 0) { setShown(to); return; }
        let n = 0;
        setShown(0);
        const timer = setInterval(() => {
            n += 1;
            setShown(Math.min(n, to));
            if (n >= to) clearInterval(timer);
        }, COUNT_STEP_MS);
        return () => clearInterval(timer);
    }, [to, reduceMotion]);
    useEffect(() => {
        if (!reduceMotion && shown > 0) pop.value = withSequence(withTiming(1.15, { duration: 100 }), withSpring(1, SPRING_BOUNCE));
    }, [shown, reduceMotion, pop]);
    const animated = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
    return <View {...DECOR} testID="quiz-facts-medal" style={styles.medalWrap}>
        <Animated.View style={[styles.medal, compact && styles.medalCompact, animated]}>
            <Text style={[styles.medalNumber, compact && styles.medalNumberCompact]}>{shown}</Text>
            <Text style={styles.medalCaption}>{to === 1 ? 'fact' : 'facts'}</Text>
        </Animated.View>
    </View>;
}

const styles = StyleSheet.create({
    dots: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    dot: { minWidth: 28, minHeight: 28, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    dotDone: { backgroundColor: FOCAL.jadeInk, borderColor: FOCAL.jadeInk },
    dotCurrent: { backgroundColor: FOCAL.jadeInk, borderColor: FOCAL.electricGold, borderWidth: 2 },
    dotLabel: { ...TYPE.caption, ...figtree('800'), color: colors.textMuted },
    dotLabelOn: { color: '#FFFFFF' },
    timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    clock: { fontSize: 20 },
    track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: FOCAL.mistSlate, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    trackWarm: { borderColor: FOCAL.goldInk, backgroundColor: FOCAL.mistGold },
    fill: { height: '100%', borderRadius: 4 },
    medalWrap: { alignItems: 'center' },
    // Minimums keep the medal compact; scaled numbers and captions can expand instead of clipping.
    medal: { minWidth: 72, minHeight: 72, padding: 10, borderRadius: 36, borderWidth: 2, borderColor: FOCAL.electricGold, backgroundColor: FOCAL.mistGold, alignItems: 'center', justifyContent: 'center' },
    medalCompact: { minWidth: 60, minHeight: 60, padding: 8 },
    medalNumber: { ...TYPE.display, ...DISPLAY_TEXT, color: FOCAL.goldInk, fontVariant: ['tabular-nums'] },
    medalNumberCompact: { ...TYPE.title },
    medalCaption: { ...TYPE.caption, ...figtree('700'), color: FOCAL.goldInk },
});
