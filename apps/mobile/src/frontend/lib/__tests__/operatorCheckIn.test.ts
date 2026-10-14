import { saveOperatorCheckIn } from '@/lib/operator';

const mockInsert = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({ insert: (...args: unknown[]) => mockInsert(...args) }),
  },
}));

describe('saveOperatorCheckIn', () => {
  beforeEach(() => mockInsert.mockReset());

  it('does not report success when the database rejects the field check-in', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'permission denied' } });
    await expect(saveOperatorCheckIn(40.123, -111.456)).resolves.toEqual({
      ok: false,
      message: 'permission denied',
    });
  });

  it('writes the location rounded to about 1 km, never the exact GPS (PRIVACY_ENGINEERING 2026-10-13)', async () => {
    mockInsert.mockResolvedValue({ error: null });
    await expect(saveOperatorCheckIn(40.760780, -111.891045)).resolves.toEqual({ ok: true });
    expect(mockInsert).toHaveBeenCalledWith({ latitude: 40.76, longitude: -111.89 });
  });
});
