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
    from: () => ({ update: (values: unknown) => ({ eq: () => ({ select: () => ({ single: () => mockUpdate(values) }) }) }) }),
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

  it('rejects an unsaved legacy Vault fallback instead of returning success', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Missing function' } });
    mockUpdate.mockResolvedValueOnce({ error: { code: '42703', message: 'column "is_vault_only" does not exist' } }).mockResolvedValueOnce({ error: { code: '42501', message: 'Denied' } });
    await expect(toggleReelVaultStatus(REEL_ID, false)).rejects.toThrow('Denied');
  });
  it('keeps the legacy is_exclusive fallback when is_vault_only is missing', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    mockUpdate.mockResolvedValueOnce({ error: { code: '42703', message: 'column "is_vault_only" does not exist' } }).mockResolvedValueOnce({ data: {id: REEL_ID, is_exclusive:true}, error: null });
    await expect(toggleReelVaultStatus(REEL_ID, false)).resolves.toBe(true);
    expect(mockUpdate).toHaveBeenLastCalledWith({ is_exclusive: true });
  });
});

it('rejects a zero-row clip privacy UPDATE without success', async()=>{
 mockRpc.mockResolvedValue({data:null,error:{code:'PGRST202',message:'Missing function'}});
 mockUpdate.mockResolvedValueOnce({data:null,error:null});
 await expect(toggleReelVaultStatus(REEL_ID,false)).rejects.toThrow();
});
