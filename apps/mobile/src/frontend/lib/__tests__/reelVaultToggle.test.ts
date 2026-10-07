/**
 * toggleReelVaultStatus must not report a Vault flip that the database refused (QA re-verification N2,
 * 2026-10-07): a photo story violates `reels_photo_story_public_check`, so the fallback UPDATE fails and
 * the caller has to hear about it instead of seeing a silent no-op.
 */

const mockRpc = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({ update: (values: unknown) => ({ eq: () => mockUpdate(values) }) }),
  },
}));
jest.mock('@/lib/photoStories', () => ({ storyPhotoPublicUrl: () => null }));
jest.mock('@/services/MediaUploadService', () => ({
  REEL_VAULT_BUCKET: 'reel_vault',
  REEL_VAULT_PREFIX: 'reelvault:',
  uploadHighlight: jest.fn(),
}));

import { toggleReelVaultStatus } from '@/lib/reels';

const REEL_ID = '0b7c4a0e-1d2f-4c3b-9a8e-5f6d7c8b9a01';

beforeEach(() => jest.clearAllMocks());

describe('toggleReelVaultStatus', () => {
  it('returns the RPC result when the RPC succeeds', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    await expect(toggleReelVaultStatus(REEL_ID, false)).resolves.toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('throws a plain message when a photo story refuses Vault', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'new row violates check constraint "reels_photo_story_public_check"' } });
    mockUpdate.mockResolvedValue({ error: { message: 'new row violates check constraint "reels_photo_story_public_check"' } });
    await expect(toggleReelVaultStatus(REEL_ID, false)).rejects.toThrow('Photo stories stay on the free public feed.');
  });

  it('keeps the legacy is_exclusive fallback when is_vault_only is missing', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function not found' } });
    mockUpdate.mockResolvedValueOnce({ error: { message: 'column "is_vault_only" does not exist' } }).mockResolvedValueOnce({ error: null });
    await expect(toggleReelVaultStatus(REEL_ID, false)).resolves.toBe(true);
    expect(mockUpdate).toHaveBeenLastCalledWith({ is_exclusive: true });
  });
});
