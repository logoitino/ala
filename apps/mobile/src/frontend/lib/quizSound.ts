/** QUIZ-04 fun presentation (2026-10-15), phones: trivia feedback is haptics only, because no audio package is
 * installed and none can be added while the npm registry is blocked. The browser build uses `quizSound.web.ts`
 * (Metro picks it by platform) to synthesize short sounds instead.
 * Haptics follow the phone's own system haptics setting (iOS / Android switch them off there), and the trivia
 * "Sound off" toggle silences them too, so one switch quiets every quiz cue.
 * @sideEffects expo-haptics impact / notification calls; never throws, never waits.
 */
import * as Haptics from 'expo-haptics';
import type { QuizCue } from './quizSound.types';

export type { QuizCue } from './quizSound.types';

/** One haptic per cue: success for a right answer or a finished round, a light tap for everything gentle. */
function haptic(cue: QuizCue): Promise<void> {
    switch (cue) {
        case 'correct':
        case 'roundComplete':
        case 'levelUp':
            return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        case 'timeUp':
            return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        default:
            // tap and notQuite: a light tap, never the error buzz.
            return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
}

/**
 * NATIVE AUDIO PLUG-IN POINT. When `expo-audio` can be installed (needs the npm registry and an INFRASTRUCTURE
 * register entry), load one short bundled sound per cue here and play it at low volume. This is the only place
 * that needs to change: the screen, the toggle and the tests already route every cue through `playQuizCue`.
 * Until then it does nothing on purpose.
 */
function playNativeAudio(_cue: QuizCue): void {
    // Intentionally empty: no native audio package is available in this build.
}

/** @purpose Phones need no gesture unlock (haptics only); returns a no-op cleanup so the screen code is shared. */
export function armQuizSound(_enabled: boolean): () => void {
    return () => {};
}

/** @purpose Fire one cue's feedback. `enabled` false (the person chose Sound off) does nothing at all. */
export function playQuizCue(cue: QuizCue, enabled: boolean): void {
    if (!enabled) return;
    try {
        void haptic(cue).catch(() => {});
        playNativeAudio(cue);
    } catch {
        // A simulator or device without a haptics engine: stay silent rather than interrupt the round.
    }
}
