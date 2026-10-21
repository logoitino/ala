/** Signed-in Terms writes require a confirmed server row before a convenience cache can claim acceptance. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGAL_TERMS_VERSION } from '@/data/legal';
import { hasLegalAck, recordLegalAck } from '../legal';

const mockUpdate = jest.fn();
const mockReadback = jest.fn();
const originalGetItem = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: () => ({ update: (patch: Record<string, unknown>) => {
    mockUpdate(patch);
    const query = {
      select: () => query,
      maybeSingle: () => mockReadback(),
      then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => mockReadback().then(resolve, reject),
    };
    return { eq: () => query };
  } }) },
}));
beforeEach(async () => {
  await AsyncStorage.clear(); jest.clearAllMocks(); mockUpdate.mockReset(); mockReadback.mockReset();
  (AsyncStorage.getItem as jest.Mock).mockReset().mockImplementation(originalGetItem);
  mockReadback.mockImplementation(() => Promise.resolve({ data: {
    user_id: 'owner-A', legal_terms_accepted_at: mockUpdate.mock.calls[0][0].legal_terms_accepted_at,
    legal_terms_version: LEGAL_TERMS_VERSION,
  }, error: null }));
});

it('does not cache a failed signed-in server write or expose its diagnostic', async () => {
  mockReadback.mockResolvedValueOnce({ data: null, error: { message: 'private provider diagnostic' } });
  await expect(recordLegalAck('owner-A')).rejects.toThrow('Could not save Terms acknowledgment. Please try again.');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('does not cache a zero-row signed-in write', async () => {
  mockReadback.mockResolvedValueOnce({ data: null, error: null });
  await expect(recordLegalAck('owner-A')).rejects.toThrow('Could not save Terms acknowledgment. Please try again.');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it.each([
  { user_id: 'another-owner', legal_terms_accepted_at: '2026-10-20', legal_terms_version: LEGAL_TERMS_VERSION },
  { user_id: 'owner-A', legal_terms_accepted_at: null, legal_terms_version: LEGAL_TERMS_VERSION },
  { user_id: 'owner-A', legal_terms_accepted_at: '2026-10-20', legal_terms_version: 'old-version' },
])('rejects an unconfirmed acknowledgment row', async (data) => {
  mockReadback.mockResolvedValueOnce({ data, error: null });
  await expect(recordLegalAck('owner-A')).rejects.toThrow('Could not save Terms acknowledgment. Please try again.');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('keeps a server-confirmed acknowledgment successful if its device cache is unavailable', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('device cache unavailable'));
  await expect(recordLegalAck('owner-A')).resolves.toEqual(expect.any(String));
  expect(mockReadback).toHaveBeenCalledTimes(1);
});

it('requires a guest local acknowledgment to save, without a server write', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('device cache unavailable'));
  await expect(recordLegalAck(null)).rejects.toThrow('Could not save Terms acknowledgment. Please try again.');
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('preserves guest local acknowledgment without a server write', async () => {
  const acceptedAt = await recordLegalAck(null);
  expect(acceptedAt).toEqual(expect.any(String));
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(expect.stringContaining('guest'), expect.stringContaining(LEGAL_TERMS_VERSION));
});

it('does not let a legacy device cache waive missing signed-in remote acknowledgment', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify({ version: LEGAL_TERMS_VERSION, acceptedAt: '2026-10-20T00:00:00Z' }));
  expect(await hasLegalAck('owner-A', null, null)).toBe(false);
  expect(AsyncStorage.getItem).not.toHaveBeenCalled();
});

it('requires the exact current remote version for a configured signed-in account', async () => {
  expect(await hasLegalAck('owner-A', '2026-10-20T00:00:00Z', null)).toBe(false);
  expect(await hasLegalAck('owner-A', '2026-10-20T00:00:00Z', 'old-version')).toBe(false);
  expect(await hasLegalAck('owner-A', '2026-10-20T00:00:00Z', LEGAL_TERMS_VERSION)).toBe(true);
});

it('recognizes a preserved guest acknowledgment from the local record', async () => {
  await recordLegalAck(null);
  expect(await hasLegalAck(null)).toBe(true);
});
