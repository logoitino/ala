/** QUIZ-04 fun presentation (2026-10-15): the trivia screen's "Sound on / Sound off" choice, saved on this device
 * (AsyncStorage), and the one `play(cue)` the screen calls. Sound starts on; "Sound off" also stops quiz haptics
 * on phones, so one switch quiets every cue. Phones play haptics only until a native audio package can be installed
 * (see the plug-in point in `lib/quizSound.ts`); the browser synthesizes short sounds after the first gesture.
 * `play` is synchronous and swallows every failure, so a cue can never delay or block an answer, Next or End.
 * @sideEffects AsyncStorage read once and write on toggle; web gesture listeners while Sound is on.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { armQuizSound, playQuizCue, type QuizCue } from '@/lib/quizSound';

/** Device-local preference key; holds 'on' or 'off'. Not account data and never sent anywhere. */
const QUIZ_SOUND_KEY = 'tapuai.trivia.sound.v1';

/** @purpose Saved sound preference plus a never-throwing cue player. */
export function useQuizSound() {
    const [enabled, setEnabled] = useState(true);
    const enabledRef = useRef(true);
    enabledRef.current = enabled;
    // Read the saved choice once; a failed read keeps the default (on).
    useEffect(() => {
        let live = true;
        AsyncStorage.getItem(QUIZ_SOUND_KEY).then(value => { if (live && value === 'off') setEnabled(false); }).catch(() => {});
        return () => { live = false; };
    }, []);
    // The browser only unlocks audio while Sound is on; leaving the page removes the listeners.
    useEffect(() => armQuizSound(enabled), [enabled]);
    const toggle = useCallback(() => {
        const next = !enabledRef.current;
        enabledRef.current = next;
        setEnabled(next);
        AsyncStorage.setItem(QUIZ_SOUND_KEY, next ? 'on' : 'off').catch(() => {});
    }, []);
    const play = useCallback((cue: QuizCue) => {
        try { playQuizCue(cue, enabledRef.current); } catch { /* presentation only: never interrupt the round */ }
    }, []);
    return { enabled, toggle, play };
}
