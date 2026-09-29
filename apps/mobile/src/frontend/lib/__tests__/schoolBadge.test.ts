const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import { fetchSchoolBadge, parseSchoolBadge, schoolBadgeColors, schoolMonogram } from '@/lib/schoolBadge';
import { RESERVED_BADGE_MARKS } from '@/data/verification';

const ROW = {
  school_id: 'a1000000-0000-4000-8000-000000000002',
  school_name: 'Lone Peak High',
  mascot: 'Knights',
  logo_url: 'https://cdn.example/lp.png',
  color_primary: '#1D3F8F',
  color_secondary: '#FFFFFF',
  confirmed_at: '2026-09-29T18:00:00Z',
  confirmed_by: 'athletic_director',
};

beforeEach(() => mockRpc.mockReset());

describe('school badge', () => {
  it('parses the server badge', () => {
    expect(parseSchoolBadge(ROW)).toMatchObject({
      schoolName: 'Lone Peak High',
      logoUrl: 'https://cdn.example/lp.png',
      colorPrimary: '#1D3F8F',
      confirmedBy: 'athletic_director',
    });
  });

  it('drops a non-https logo and non-hex colours', () => {
    const badge = parseSchoolBadge({ ...ROW, logo_url: 'http://x/lp.png', color_primary: 'red', confirmed_by: 'fan' });
    expect(badge?.logoUrl).toBeNull();
    expect(badge?.colorPrimary).toBeNull();
    expect(badge?.confirmedBy).toBe('tapuai');
  });

  it('no badge unless the server returns one', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchSchoolBadge('p1')).resolves.toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('athlete_school_badge', { target_player_id: 'p1' });
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Could not find the function' } });
    await expect(fetchSchoolBadge('p1')).resolves.toBeNull();
    await expect(fetchSchoolBadge(null)).resolves.toBeNull();
  });

  it('fallback colours are stable per school', () => {
    const a = schoolBadgeColors({ schoolId: ROW.school_id, colorPrimary: null, colorSecondary: null });
    expect(schoolBadgeColors({ schoolId: ROW.school_id, colorPrimary: null, colorSecondary: null })).toEqual(a);
    expect(schoolBadgeColors({ schoolId: ROW.school_id, colorPrimary: '#000000', colorSecondary: null }).primary).toBe('#000000');
  });

  it('monograms skip filler words', () => {
    expect(schoolMonogram('Lone Peak High')).toBe('LP');
    expect(schoolMonogram('Westlake High')).toBe('WE');
    expect(schoolMonogram('American Leadership Academy')).toBe('AL');
  });

  it('check marks are reserved in names', () => {
    expect(RESERVED_BADGE_MARKS.test('Sione ✓')).toBe(true);
    expect(RESERVED_BADGE_MARKS.test('Sione ✅')).toBe(true);
    expect(RESERVED_BADGE_MARKS.test('Sione Fifita')).toBe(false);
  });
});
