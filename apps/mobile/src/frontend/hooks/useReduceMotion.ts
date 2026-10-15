/** The person's Reduce Motion setting (iOS / Android accessibility, or `prefers-reduced-motion` in a browser), kept
 * current while the screen is open. Used by the QUIZ-04 trivia effects (2026-10-15): with it on, no confetti,
 * wiggles or bounces, only simple fades.
 * It reads `true` until the setting is known, so nothing bursts or bounces before we know it is welcome.
 * @sideEffects One AccessibilityInfo read and one `reduceMotionChanged` listener per mounted hook.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** @purpose Live Reduce Motion flag; true while unknown. */
export function useReduceMotion(): boolean {
    const [reduce, setReduce] = useState(true);
    useEffect(() => {
        let live = true;
        // Optional calls: some test and web builds expose a partial AccessibilityInfo.
        Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
            .then(value => { if (live) setReduce(value === true); })
            .catch(() => { if (live) setReduce(false); });
        const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value: boolean) => { if (live) setReduce(value === true); });
        return () => { live = false; subscription?.remove?.(); };
    }, []);
    return reduce;
}
