/** Configured read failures cannot become seeded awards; real empty and unconfigured previews remain. */
import { fetchSpotlightBoard } from '@/lib/spotlight';

const mockRead = jest.fn();
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: async () => ({ data: null, error: null }),
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const method of ['select', 'lte', 'gte', 'order']) chain[method] = () => chain;
      chain.limit = () => mockRead();
      return chain;
    },
  },
}));
jest.mock('@/data/highlights', () => ({ HIGHLIGHT_CLIPS: [
  { id: 'demo', athleteName: 'Demo Athlete', school: 'Westlake', videoUrl: 'https://demo.test/clip.mp4' },
] }));
jest.mock('@/lib/reels', () => ({ isReelUuid: () => false, resolvePlaybackUrl: async (s: string) => s }));

beforeEach(() => mockRead.mockReset());

it('retains the existing seeded preview after a genuine empty read', async () => {
  mockRead.mockResolvedValue({ data: [], error: null });
  expect(await fetchSpotlightBoard()).toEqual([expect.objectContaining({ id: expect.stringContaining('demo-spotlight') })]);
});

it.each(['42501', 'PGRST202', 'NETWORK_ERROR'])('reports configured %s errors instead of a seeded award', async (code) => {
  const failure = { code, message: 'Read unavailable' };
  mockRead.mockResolvedValue({ data: null, error: failure });
  await expect(fetchSpotlightBoard()).rejects.toEqual(failure);
});

it('retains active/table compatibility fallback when the board read succeeds', async () => {
  mockRead.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
    .mockResolvedValueOnce({ data: [{ id: 'real-award', player_id: '', headline: 'Published award' }], error: null });
  expect(await fetchSpotlightBoard()).toEqual([expect.objectContaining({ id: 'real-award', headline: 'Published award' })]);
});
