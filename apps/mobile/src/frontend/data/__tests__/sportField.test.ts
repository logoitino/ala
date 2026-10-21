/** Every sport — including ones an admin adds later — must map to a playing surface, never to nothing. */
import { ATHLETE_SPORTS } from '@/data/teams';
import { sportFieldKind, type SportFieldKind } from '@/data/sportField';

describe('sportFieldKind', () => {
  it('maps each catalog sport to its own surface', () => {
    const expected: Record<(typeof ATHLETE_SPORTS)[number], SportFieldKind> = {
      Football: 'gridiron',
      Basketball: 'court',
      Rugby: 'rugby',
      Volleyball: 'volleyball',
      Soccer: 'pitch',
      Baseball: 'diamond',
      Softball: 'diamond',
      Wrestling: 'mat',
      'Track & Field': 'track',
      Lacrosse: 'pitch',
      'Ice Hockey': 'rink',
      Tennis: 'tennis',
    };
    for (const sport of ATHLETE_SPORTS) expect([sport, sportFieldKind(sport)]).toEqual([sport, expected[sport]]);
  });

  it('reads admin-added and differently cased sport names by keyword', () => {
    expect(sportFieldKind('flag football')).toBe('gridiron');
    expect(sportFieldKind('Beach Volleyball')).toBe('volleyball');
    expect(sportFieldKind('Cross Country')).toBe('track');
    expect(sportFieldKind('Field Hockey')).toBe('pitch');
    expect(sportFieldKind('  BASKETBALL ')).toBe('court');
    expect(sportFieldKind('Rugby League')).toBe('rugby');
    expect(sportFieldKind('Football (Soccer)')).toBe('pitch');
  });

  it('falls back to a generic field for unknown or missing sports', () => {
    expect(sportFieldKind('Water Polo')).toBe('field');
    expect(sportFieldKind('')).toBe('field');
    expect(sportFieldKind(null)).toBe('field');
    expect(sportFieldKind(undefined)).toBe('field');
  });
});
