/** QUIZ-04 fun presentation (2026-10-15): every rotating cheer and encouragement the trivia screen shows, in one small
 * list so VOICE can review the words in one place. Cheers celebrate learning, never speed, streaks or other people.
 * "Not quite" lines encourage and never shame. The plain verdicts ("That's right!", "Not quite. Here's the fact:",
 * "Time ran out on this one.") stay in SportQuizRound; these lines sit above them as a game-day kicker.
 * Pure data and pickers: no side effects.
 */

/** Per-sport cheers for a right answer. Keys are lower-case words matched inside the question's sport name. */
export const SPORT_CHEERS: readonly { match: readonly string[]; cheers: readonly string[] }[] = [
    { match: ['football'], cheers: ['Touchdown!', 'First down!', 'End zone!'] },
    { match: ['basketball'], cheers: ['Nothing but net!', 'Swish!', 'Buzzer beater!'] },
    { match: ['baseball', 'softball'], cheers: ['Home run!', 'Out of the park!', 'Grand slam!'] },
    { match: ['soccer'], cheers: ['Goal!', 'Top corner!', 'What a strike!'] },
    { match: ['tennis'], cheers: ['Ace!', 'Game, set, match!', 'Right on the line!'] },
    { match: ['volleyball'], cheers: ['Ace!', 'Spike!', 'Perfect set!'] },
    { match: ['hockey'], cheers: ['Goal!', 'Top shelf!', 'Lamp lit!'] },
    { match: ['lacrosse'], cheers: ['Goal!', 'Top shelf!', 'Right in the pocket!'] },
    { match: ['rugby'], cheers: ['Try!', 'Over the line!', 'What a carry!'] },
    { match: ['track', 'field'], cheers: ['Breaking the tape!', 'Clean landing!', 'Photo finish!'] },
    { match: ['wrestling'], cheers: ['Takedown!', 'Pinned it!', 'Clean move!'] },
];

/** Right-answer cheers for Life Playbook, science, geography, general knowledge and any sport not listed above. */
export const GENERAL_CHEERS: readonly string[] = ['Bullseye!', 'Nailed it!', 'Right on target!'];

/** Shown above "Not quite. Here's the fact:". Friendly, never a buzzer or a put-down. */
export const ENCOURAGEMENTS: readonly string[] = ['Good hustle!', 'Great swing!', 'Every rep counts!', 'Nice try, keep rolling!'];

/** Shown when a question's time runs out, above "Time ran out on this one." */
export const TIME_UP_CHEER = 'Whistle!';

/** Round summary kicker for anyone who answered at least one question, right or wrong (equal rewards). */
export const ROUND_CHEERS: readonly string[] = ['What a round!', 'That’s a wrap!', 'Game day learning, done!'];

/** Extra friendly line under "No new facts this time, and that's okay." */
export const ZERO_FACTS_LINE = 'New questions are ready next week.';

/** @purpose The level-up headline, e.g. "Level up: Varsity!". */
export function levelUpLine(label: string): string {
    return `Level up: ${label}!`;
}

const pick = (list: readonly string[], seed: number) => list[Math.abs(Math.trunc(seed)) % list.length];

/** @purpose A right-answer cheer for `sport`, rotating by `seed` (the question number) so each question sounds fresh. */
export function cheerFor(sport: string | null | undefined, seed: number): string {
    const name = (sport ?? '').toLowerCase();
    const row = SPORT_CHEERS.find(r => r.match.some(word => name.includes(word)));
    return pick(row ? row.cheers : GENERAL_CHEERS, seed);
}

/** @purpose A rotating encouragement for a "not quite" answer. */
export function encouragementFor(seed: number): string {
    return pick(ENCOURAGEMENTS, seed);
}

/** @purpose A rotating round-summary kicker. */
export function roundCheerFor(seed: number): string {
    return pick(ROUND_CHEERS, seed);
}
