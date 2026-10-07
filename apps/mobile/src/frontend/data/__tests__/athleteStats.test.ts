/** Sport identity regressions: a profile's sport owns both Stats and Aura labels, never a position guess. */
import { careerColumnsForSport, demoAthleteStats, inferAthleteSport } from '@/data/athleteStats';
import type { Player } from '@/types/database';

const player: Player = { id: 'demo-volleyball', name: 'Ana', jersey_number: 0,
  position: 'Middle Blocker', height: '', school_name: 'North High', backer_count: 0 };

it.each([
  ['Middle Blocker', 'Volleyball'], ['Outside Hitter', 'Volleyball'],
  ['Defensive Specialist', 'Volleyball'], ['MB', 'Volleyball'],
  ['Linebacker', 'Football'], ['LB', 'Football'],
  ['Center', ''], ['Goalie', ''], ['Pitcher', ''], ['', ''], ['Captain', ''],
  ['Fullback', ''], ['Wing', ''], ['Forward', ''], ['Keeper', ''],
])('resolves only unambiguous positions: %s', (position, sport) => {
  expect(inferAthleteSport(position)).toBe(sport);
});

it('keeps the explicit sport ahead of a conflicting roster position', () => {
  expect(inferAthleteSport('Linebacker', ' Volleyball ')).toBe('Volleyball');
});

it('does not supply football yards when the sport is unknown', () => {
  expect(careerColumnsForSport('').volume).not.toBe('Yards');
});

it('uses volleyball labels for a volleyball demo, including matches on Aura', () => {
  const stats = demoAthleteStats(player);
  expect(stats.career.sport).toBe('Volleyball');
  expect(stats.topThree.map((row) => row.label)).toEqual(['Matches Played', 'Kills', 'Digs']);
});
