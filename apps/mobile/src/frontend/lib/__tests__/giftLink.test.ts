/** Gift QR links must always resolve back to a donatable athlete, including athletes without a username. */
import { giftQrTarget, resolveGiftLink } from '@/lib/giftLink';

const mockProfiles = jest.fn();
const mockPlayer = jest.fn();

jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: {} }));
jest.mock('@/lib/privacy', () => ({ getPublicProfiles: (query: unknown) => mockProfiles(query) }));
jest.mock('@/lib/roster', () => ({ fetchGuestPlayer: (id: string) => mockPlayer(id) }));

const ID = '3f2b8c1e-5a4d-4c2b-9e1f-0a1b2c3d4e5f';
const player = { id: ID, name: 'Mele Tupou' };

beforeEach(() => {
  mockProfiles.mockReset();
  mockPlayer.mockReset();
});

describe('giftQrTarget', () => {
  it('prefers the username', () => {
    expect(giftQrTarget('Mele Tupou', '@Mele_T', ID).url).toBe('https://tapuai.app/gift/mele_t');
  });

  it('uses the athlete id when there is no username, so the link still resolves', () => {
    expect(giftQrTarget('Mele Tupou', null, ID.toUpperCase())).toEqual({ handle: ID, url: `https://tapuai.app/gift/${ID}`, athleteName: 'Mele Tupou' });
  });

  it('falls back to a name slug only when neither is known', () => {
    expect(giftQrTarget('Mele Tupou', '  ', 'not-an-id').handle).toBe('mele_tupou');
  });
});

describe('resolveGiftLink', () => {
  it('finds an athlete by username', async () => {
    mockProfiles.mockResolvedValue([{ player_id: ID, full_name: 'Mele T.', username: 'mele_t', athlete_sport: 'Rugby', school_visible: false }]);
    mockPlayer.mockResolvedValue({ player, error: null });
    await expect(resolveGiftLink('@Mele_T')).resolves.toEqual({ status: 'found', handle: 'mele_t', player, name: 'Mele T.', username: 'mele_t', sport: 'Rugby', schoolVisible: false });
    expect(mockProfiles).toHaveBeenCalledWith({ handle: 'mele_t' });
  });

  it('finds an athlete by id even without a public profile', async () => {
    mockProfiles.mockResolvedValue([]);
    mockPlayer.mockResolvedValue({ player, error: null });
    await expect(resolveGiftLink(ID)).resolves.toMatchObject({ status: 'found', name: 'Mele Tupou', username: null, sport: null, schoolVisible: true });
    expect(mockProfiles).toHaveBeenCalledWith({ playerIds: [ID] });
  });

  it('treats an unknown handle or a fan account as not found', async () => {
    mockProfiles.mockResolvedValue([]);
    await expect(resolveGiftLink('nobody')).resolves.toEqual({ status: 'not_found', handle: 'nobody' });
    mockProfiles.mockResolvedValue([{ player_id: null, full_name: 'A Fan', username: 'fan' }]);
    await expect(resolveGiftLink('fan')).resolves.toMatchObject({ status: 'not_found' });
    expect(mockPlayer).not.toHaveBeenCalled();
    await expect(resolveGiftLink('')).resolves.toMatchObject({ status: 'not_found' });
  });

  it('treats an unknown id as not found but a failed roster read for a known athlete as retryable', async () => {
    mockProfiles.mockResolvedValue([]);
    mockPlayer.mockResolvedValue({ player: null, error: 'no rows' });
    await expect(resolveGiftLink(ID)).resolves.toMatchObject({ status: 'not_found' });
    mockProfiles.mockResolvedValue([{ player_id: ID, full_name: 'Mele', username: 'mele' }]);
    await expect(resolveGiftLink('mele')).resolves.toMatchObject({ status: 'error' });
  });

  it('turns a thrown lookup into a retryable error', async () => {
    mockProfiles.mockRejectedValue(new Error('offline'));
    await expect(resolveGiftLink('mele')).resolves.toMatchObject({ status: 'error', message: expect.stringMatching(/try again/) });
  });
});
