/** PRIV-01 client: settings parse fail-closed, and each call sends the argument names the SQL declares. Synthetic data. */
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

import {
  adminFetchPrivacy, blockUser, fetchMyFriends, parsePrivacy, privacyPayload, requestFriend, respondFriend,
} from '@/lib/privacy';
import { NOT_SWITCHED_ON } from '@/lib/rpc';

beforeEach(() => mockRpc.mockReset().mockResolvedValue({ data: null, error: null }));

it('falls back to the private defaults for anything missing or unknown', () => {
  const s = parsePrivacy({ audience: { bio: 'everyone', photo: 'nonsense' } });
  expect(s.accountPrivate).toBe(true);
  expect(s.audience.bio).toBe('everyone');
  expect(s.audience.photo).toBe('friends');
  expect(s.audience.social_links).toBe('only_me');
  expect(s.tagReview).toBe('review_all');
  expect(parsePrivacy(null).accountPrivate).toBe(true);
  // MINOR-01: the teen default survives the round trip; anything else unknown reads as "anyone".
  expect(parsePrivacy({ friend_requests_from: 'teens' }).friendRequestsFrom).toBe('teens');
  expect(parsePrivacy({ friend_requests_from: 'strangers' }).friendRequestsFrom).toBe('everyone');
});

it('sends only the settings that changed, with the database names', () => {
  expect(privacyPayload({ accountPrivate: false, hideFromSearch: true })).toEqual({ account_private: false, hide_from_search: true });
});

it('calls each function with its exact argument names', async () => {
  mockRpc.mockResolvedValueOnce({ data: 'friends', error: null });
  await expect(requestFriend('p2')).resolves.toBe('friends');
  await respondFriend('r1', false);
  expect(mockRpc).toHaveBeenLastCalledWith('respond_friend', { request_id: 'r1', accept: false });
  await blockUser('p3');
  expect(mockRpc).toHaveBeenLastCalledWith('block_user', { target_profile_id: 'p3' });
});

it('maps friend rows and drops malformed ones', async () => {
  mockRpc.mockResolvedValueOnce({ data: [
    { request_id: 'r1', profile_id: 'p1', display_name: 'Sina', username: 'sina', avatar_url: null, status: 'incoming', since: '2026-10-14' },
    { request_id: 'r2', profile_id: 'p2', status: 'weird' },
  ], error: null });
  await expect(fetchMyFriends()).resolves.toEqual([{ requestId: 'r1', profileId: 'p1', name: 'Sina', username: 'sina', avatarUrl: null, status: 'incoming', since: '2026-10-14' }]);
});

it('reports a missing migration as not switched on', async () => {
  mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
  await expect(adminFetchPrivacy('p1')).rejects.toThrow(NOT_SWITCHED_ON);
});
