/**
 * Spotlight demo-video fallback (UX-05c QA): the stock demo clip fills only a genuine demo / seeded award.
 * An award that points at a real reel row (for example a photo story, or a removed clip) shows no Watch clip
 * instead of someone else's footage.
 */

jest.mock('@/data/highlights', () => ({
  HIGHLIGHT_CLIPS: [
    { id: 'hl-3', athleteName: 'Tyler Nguyen', school: 'Westlake', tag: 'Grab', videoUrl: 'https://demo.test/stock.mp4' },
  ],
}));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, supabase: {} }));

import { demoSpotlightAward, withDemoVideo } from '@/lib/spotlight';
import type { SpotlightAward } from '@/types/database';

const REAL_REEL = '22222222-2222-4222-8222-222222222222';

const award = (patch: Partial<SpotlightAward>): SpotlightAward => ({
  ...demoSpotlightAward(),
  id: '33333333-3333-4333-8333-333333333333',
  video_url: null,
  ...patch,
});

describe('withDemoVideo', () => {
  it('never substitutes the stock clip for an award that points at a real reel', () => {
    expect(withDemoVideo(award({ reel_id: REAL_REEL })).video_url).toBeNull();
  });

  it('keeps a real reel video as-is', () => {
    expect(withDemoVideo(award({ reel_id: REAL_REEL, video_url: 'https://x/real.mp4' })).video_url).toBe('https://x/real.mp4');
  });

  it('still fills the demo clip for a seeded / no-reel award', () => {
    expect(withDemoVideo(award({ reel_id: null })).video_url).toBe('https://demo.test/stock.mp4');
    expect(withDemoVideo(award({ reel_id: 'hl-3' })).video_url).toBe('https://demo.test/stock.mp4');
  });
});
