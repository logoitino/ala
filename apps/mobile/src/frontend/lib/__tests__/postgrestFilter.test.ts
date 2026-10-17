import { likeNeedle, orIlike, realtimeEq } from '@/lib/postgrestFilter';

it('quotes a school name so a period stays inside the search value', () => {
  expect(orIlike('St. Mary\'s')).toBe('"%St. Mary\'s%"');
});

it('drops LIKE wildcards and keeps a comma inside the quotes', () => {
  expect(likeNeedle('100%_a,b')).toBe('100  a,b');
  expect(orIlike('a),id.eq.x')).toBe('"%a),id.eq.x%"');
});

it('builds a realtime filter only for a plain id or slug', () => {
  expect(realtimeEq('id', 'game-1')).toBe('id=eq.game-1');
  expect(realtimeEq('slug', 'westlake-lone-peak')).toBe('slug=eq.westlake-lone-peak');
  expect(realtimeEq('id', 'game-1,id=eq.other')).toBeNull();
  expect(realtimeEq('game_id', 'a.b')).toBeNull();
});
