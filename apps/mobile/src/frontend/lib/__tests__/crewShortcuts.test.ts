/**
 * Desktop left-rail Crew shortcuts: real follows only, capped list.
 */
import { fetchCrewShortcuts } from '@/lib/crew';

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => {
      if (table === 'crew_follows') {
        return {
          select: () => ({
            eq: async () => ({
              data: [{ athlete_id: 'a1' }, { athlete_id: 'a2' }, { athlete_id: 'a3' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'players') {
        return {
          select: () => ({
            in: async () => ({
              data: [
                { id: 'a1', name: 'Malia T.' },
                { id: 'a2', name: 'Sione F.' },
              ],
              error: null,
            }),
          }),
        };
      }
      return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
    },
  },
}));

describe('fetchCrewShortcuts', () => {
  it('returns named followed athletes for the left rail', async () => {
    const rows = await fetchCrewShortcuts('user-1', 5);
    expect(rows).toEqual([
      { id: 'a1', name: 'Malia T.' },
      { id: 'a2', name: 'Sione F.' },
      { id: 'a3', name: 'Athlete' },
    ]);
  });

  it('returns empty for guests', async () => {
    expect(await fetchCrewShortcuts(null)).toEqual([]);
  });
});
