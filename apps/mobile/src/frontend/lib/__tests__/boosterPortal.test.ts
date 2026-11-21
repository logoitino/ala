/** Booster helper errors retain their messages through stored-row confirmation queries. */
import {
  fetchBoosterVerificationQueue,
  insertBoosterRoster,
  updateBoosterJersey,
} from '@/lib/boosterPortal';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

describe('boosterPortal', () => {
  beforeEach(() => mockFrom.mockReset());

  it('returns a retryable error when the verification queue fails', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ order: async () => ({ data: null, error: { message: 'offline' } }) }),
    });
    await expect(fetchBoosterVerificationQueue()).resolves.toEqual({
      rows: [],
      error: 'Could not load verification requests. Try again.',
    });
  });

  it('normalizes roster and jersey write failures', async () => {
    mockFrom
      .mockReturnValueOnce({ insert: () => ({ select: async () => ({ error: { message: 'insert blocked' } }) }) })
      .mockReturnValueOnce({
        update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ error: { message: 'update blocked' } }) }) }) }),
      });

    await expect(insertBoosterRoster([{
      name: 'Kaleo',
      jersey_number: 12,
      position: 'WR',
      school_name: 'Westlake',
      height: '',
      backer_count: 0,
    }])).resolves.toEqual({ ok: false, message: 'insert blocked' });
    await expect(updateBoosterJersey('p1', 7)).resolves.toEqual({ ok: false, message: 'update blocked' });
  });
});
