import { filmerCredit, reelToClip } from '@/lib/reels';
import type { Player, Reel } from '@/types/database';

const reel = (patch: Partial<Reel> = {}): Reel =>
  ({
    id: 'r1',
    title: 'Pick six',
    video_url: 'https://x/v.mp4',
    player_id: 'p1',
    created_at: '2026-09-29T00:00:00Z',
    ...patch,
  }) as Reel;
const sione = { id: 'p1', name: 'Sione Tuilagi' } as Player;

describe('filmer credit + views on a clip', () => {
  it('credits the fan who filmed it', () => {
    expect(filmerCredit(reel({ uploaded_by: 'u1', uploader_name: 'hawksmom' }), sione)).toBe('hawksmom');
  });

  it('shows no credit when the athlete posted it, or the uploader is unknown', () => {
    expect(filmerCredit(reel({ uploaded_by: 'u1', uploader_name: 'Sione' }), sione)).toBeNull();
    expect(filmerCredit(reel({ uploaded_by: 'u1', uploader_name: null }), sione)).toBeNull();
    expect(filmerCredit(reel({ uploader_name: 'hawksmom' }), sione)).toBeNull();
  });

  it('carries view_count onto the clip, undefined before the SQL is applied', () => {
    expect(reelToClip(reel({ view_count: 42 }), sione).viewCount).toBe(42);
    expect(reelToClip(reel(), sione).viewCount).toBeUndefined();
  });
});
