/** Sponsor helper outcomes require confirmed insertion while access refusals preserve their message. */
import { createSponsorAd, fetchSponsorAds, setSponsorAdActive } from '@/lib/sponsorAds';

const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

describe('sponsorAds', () => {
  beforeEach(() => mockFrom.mockReset());

  it('keeps a load failure distinct from an empty placement list', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ order: async () => ({ data: null, error: { message: 'offline' } }) }),
    });
    await expect(fetchSponsorAds()).resolves.toEqual({
      ads: [],
      error: 'Could not load live placements. Try again.',
    });
  });

  it('returns stable write results for create and toggle', async () => {
    mockFrom
      .mockReturnValueOnce({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'ad-1' }, error: null }) }) }) })
      .mockReturnValueOnce({ update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ error: { message: 'denied' } }) }) }) }) });

    await expect(createSponsorAd({
      title: 'Friday Lights',
      placement: 'sideline-board',
      rivalry: null,
    })).resolves.toEqual({ ok: true });
    await expect(setSponsorAdActive('ad-1', false)).resolves.toEqual({ ok: false, message: 'denied' });
  });
});
