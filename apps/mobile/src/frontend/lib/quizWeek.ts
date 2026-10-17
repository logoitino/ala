/** QUIZ-03 week names. The five-week mix matches the server: four sport weeks, then one fun week.
 * Fun questions are the off-the-field pool (history, the job site, practice fuel, and the other fun facts).
 * Sports-only accounts stay on sports. This file does not start a round or store a streak.
 */

const MIX_EPOCH_MS = Date.UTC(1970, 0, 5);
const DAY_MS = 86_400_000;

export type QuizWeekKind = 'sport' | 'fun';

/** @purpose The server's five-week slot for a Monday `YYYY-MM-DD` week start. Slot 4 is the fun week. */
export function quizWeekKind(weekStart: string, topicMode: 'sports' | 'mix'): QuizWeekKind {
  if (topicMode !== 'mix') return 'sport';
  const [year, month, day] = weekStart.split('-').map(Number);
  if (!year || !month || !day) return 'sport';
  const days = Math.round((Date.UTC(year, month - 1, day) - MIX_EPOCH_MS) / DAY_MS);
  const slot = ((Math.floor(days / 7) % 5) + 5) % 5;
  return slot === 4 ? 'fun' : 'sport';
}

/** @purpose Shift a Monday week start by whole days, in UTC, as `YYYY-MM-DD`. */
export function shiftQuizWeek(weekStart: string, days: number): string {
  const [year, month, day] = weekStart.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** @purpose The Highlight line for the subject the server already scheduled. */
export function thisWeekSubject(kind: QuizWeekKind | null): string {
  if (kind === 'fun') return 'This week’s five are off the field.';
  if (kind === 'sport') return 'This week’s five are sports.';
  return 'This week’s five.';
}

/** @purpose The finished-round line. Sports-only stays general; mix names sports or the off-the-field week. */
export function nextWeekUnlockLine(weekStart: string, topicMode: 'sports' | 'mix'): string {
  if (topicMode !== 'mix') return 'This week’s five are done. Next week unlocks a new subject.';
  const next = quizWeekKind(shiftQuizWeek(weekStart, 7), 'mix');
  return next === 'fun'
    ? 'This week’s five are done. Next week unlocks a subject off the field.'
    : 'This week’s five are done. Next week unlocks sports.';
}
