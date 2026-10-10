import { parseSportConfig } from '@/lib/sports';

describe('parseSportConfig scoring and callouts', () => {
  it('keeps labeled rows, slugs a missing id, and drops a blank label', () => {
    const config = parseSportConfig({
      sport: 'Basketball',
      scoring: [
        { label: 'Free Throw', points: 1, event_type: 'free_throw' },
        { id: 'three', label: 'Three', points: '3' },
        { label: '   ' },
        null,
      ],
      callouts: [
        { label: 'And one', emoji: '🔥', eventType: 'and_one' },
        { label: 'Timeout' },
        { label: '' },
      ],
    });

    expect(config?.scoring).toEqual([
      { id: 'free-throw', label: 'Free Throw', points: 1, eventType: 'free_throw' },
      { id: 'three', label: 'Three', points: 3, eventType: 'Three' },
    ]);
    expect(config?.callouts).toEqual([
      { id: 'and-one', label: 'And one', emoji: '🔥', eventType: 'and_one' },
      { id: 'timeout', label: 'Timeout', emoji: '⚡', eventType: 'Timeout' },
    ]);
  });
});
