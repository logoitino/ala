/** The five-week mix must match the server slot: four sport weeks, then one fun week. */
import { nextWeekUnlockLine, quizWeekKind, shiftQuizWeek, thisWeekSubject } from '../quizWeek';

describe('quiz week subjects', () => {
  it('keeps sports-only accounts on sports', () => {
    expect(quizWeekKind('2026-10-12', 'sports')).toBe('sport');
    expect(nextWeekUnlockLine('2026-10-12', 'sports')).toBe('This week’s five are done. Next week unlocks a new subject.');
  });

  it('puts the fun subject on slot 4 and sports on the other four', () => {
    const start = '2026-10-12';
    const kinds = [0, 1, 2, 3, 4].map(step => quizWeekKind(shiftQuizWeek(start, step * 7), 'mix'));
    expect(kinds.filter(kind => kind === 'fun')).toHaveLength(1);
    expect(kinds.filter(kind => kind === 'sport')).toHaveLength(4);
    const funAt = kinds.indexOf('fun');
    expect(nextWeekUnlockLine(shiftQuizWeek(start, (funAt - 1) * 7), 'mix')).toMatch(/off the field/);
    expect(thisWeekSubject('fun')).toMatch(/off the field/);
    expect(thisWeekSubject('sport')).toMatch(/sports/);
    expect(thisWeekSubject(null)).toBe('This week’s five.');
  });
});
