/**
 * `reels_feed.player_id` is a CASE expression (tag privacy), so PostgREST cannot follow it to `players` and a
 * `players(...)` embed detours through the locked `reel_tag_rejections` junction (42501, every athlete profile
 * failed). Clips must load without the embed and get their athlete from one separate `players` read.
 */

const mockReelSelect = jest.fn();
const mockPlayerIn = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => ({
      select: (columns: string) => {
        if (table === 'players') {
          return { in: (_column: string, ids: string[]) => Promise.resolve(mockPlayerIn(columns, ids)) };
        }
        return {
          order: () => {
            const result = mockReelSelect(columns);
            const response = Object.assign(Promise.resolve(result), { retry: () => Promise.resolve(result) });
            return Object.assign(response, { eq: () => response });
          },
        };
      },
    }),
  },
}));

import { fetchReelsForPlayer, playerFromReel, reelToClip } from '@/lib/reels';
import type { ReelWithPlayer, Player } from '@/types/database';

const row = (id: string, playerId: string | null) => ({
  id, title: id, video_url: `https://x/${id}.mp4`, player_id: playerId, created_at: '2026-10-21T00:00:00Z',
});

beforeEach(() => {
  mockReelSelect.mockReset();
  mockPlayerIn.mockReset();
});

describe('clip athletes without the players embed', () => {
  it('preserves a recorded sport and never restores a privacy-blanked player identity', () => {
    const athlete = { id: 'private-player', name: 'Private' } as Player;
    const tagged = { ...row('private', null), sport: 'Volleyball', players: athlete } as ReelWithPlayer;
    expect(playerFromReel(tagged, [athlete])).toBeNull();
    const clip = reelToClip(tagged, athlete);
    expect(clip.sport).toBe('Volleyball');
    expect(clip.playerId).toBeNull();
    expect(clip.athleteName).toBe('Not tagged yet');
    expect(clip.school).toBe('');
    expect(reelToClip({ ...tagged, sport: undefined }, null).sport).toBeNull();
  });
  it('never asks reels_feed to embed players and attaches them from one players read', async () => {
    mockReelSelect.mockReturnValue({ data: [row('a', 'p1'), row('b', 'p1'), row('c', null)], error: null, status: 200 });
    mockPlayerIn.mockReturnValue({ data: [{ id: 'p1', name: 'Mele Tupou' }], error: null });

    const clips = await fetchReelsForPlayer('p1');

    for (const [columns] of mockReelSelect.mock.calls) expect(columns).not.toMatch(/players\s*\(/);
    expect(mockPlayerIn).toHaveBeenCalledTimes(1);
    expect(mockPlayerIn.mock.calls[0][1]).toEqual(['p1']);
    expect(clips.map((clip) => [clip.id, (clip.players as { name?: string } | null)?.name ?? null])).toEqual([['a', 'Mele Tupou'], ['b', 'Mele Tupou'], ['c', null]]);
  });

  it('keeps the clips when the players read fails', async () => {
    mockReelSelect.mockReturnValue({ data: [row('a', 'p1')], error: null, status: 200 });
    mockPlayerIn.mockReturnValue({ data: null, error: { message: 'offline' } });

    const clips = await fetchReelsForPlayer('p1');

    expect(clips).toHaveLength(1);
    expect(clips[0].players).toBeNull();
  });
});
