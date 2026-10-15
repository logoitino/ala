/** QUIZ-04 fun presentation (2026-10-15): the short feedback cues the trivia screen can play, shared by the native
 * (`quizSound.ts`, haptics only) and web (`quizSound.web.ts`, synthesized Web Audio) implementations.
 * Every cue also has an on-screen text equivalent; a cue never carries information on its own.
 */

/** tap = answer press · correct / notQuite / timeUp = the reveal · roundComplete = summary · levelUp = new level. */
export type QuizCue = 'tap' | 'correct' | 'notQuite' | 'timeUp' | 'roundComplete' | 'levelUp';
