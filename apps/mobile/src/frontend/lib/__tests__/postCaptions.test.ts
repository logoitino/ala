/** Caption receipts must match the initiating account and exact write before any mounted feed changes. */
import { BEYOND_RIGHTS_VERSION, BEYOND_SAFETY_VERSION, parseBeyondPost } from '@tapuai/shared-types/beyondGame';
import { applyReelCaptionChange, saveBeyondDescription, saveReelDescription, subscribeReelCaptionChanges } from '@/lib/postCaptions';
import { createOfflineActorClient, type OfflineActorClient } from '@/lib/offlineActor';
import { untypedRpc } from '@/lib/rpc';

jest.mock('@/lib/offlineActor', () => ({
  createOfflineActorClient: jest.fn(),
  assertCurrent: (actor: { isCurrent: () => boolean }) => {
    if (!actor.isCurrent()) throw new Error('Actor changed');
  },
  isOfflineActorChanged: (error: Error) => error?.message === 'Actor changed',
}));
jest.mock('@/lib/rpc', () => ({ untypedRpc: jest.fn() }));

const rpc = jest.mocked(untypedRpc);
const client = {} as OfflineActorClient;
const row = { id: 'reel', uploaded_by: 'author', title: ' Original ', video_path: 'unchanged' };
const actor = { userId: 'account', profileId: 'author', isCurrent: () => true };

beforeEach(() => {
  rpc.mockReset();
  jest.mocked(createOfflineActorClient).mockReset().mockResolvedValue(client);
});

it('applies a confirmed patch to matching rows while leaving newer or different rows alone', async () => {
  const apply = jest.fn();
  const stop = subscribeReelCaptionChanges(apply);
  try {
    rpc.mockResolvedValue({ data: { id: 'reel', caption: 'New 🏉' }, error: null });
    await expect(saveReelDescription(actor, row.id, row.title, ' New 🏉 ')).resolves.toBe('New 🏉');
    expect(rpc).toHaveBeenCalledWith('edit_reel_caption', {
      expected_actor_id: 'author', reel_id: row.id, expected_caption: ' Original ', new_caption: 'New 🏉',
    }, client);
    const patch = apply.mock.calls[0][0];
    expect(applyReelCaptionChange([row], patch)).toEqual([{ ...row, title: 'New 🏉' }]);
    const newer = [{ ...row, title: 'Newer' }];
    const other = [{ ...row, uploaded_by: 'other' }];
    expect(applyReelCaptionChange(newer, patch)).toBe(newer);
    expect(applyReelCaptionChange(other, patch)).toBe(other);
  } finally { stop(); }
});

it('does not apply stale, mismatched or abandoned writes, and never retries them', async () => {
  const apply = jest.fn();
  const stop = subscribeReelCaptionChanges(apply);
  try {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '40001' } })
      .mockResolvedValueOnce({ data: { id: 'other', caption: 'New' }, error: null });
    await expect(saveReelDescription(actor, row.id, row.title, 'New')).rejects.toThrow('Refresh and reopen');
    await expect(saveReelDescription(actor, row.id, row.title, 'New')).rejects.toThrow('Could not confirm');
    let current = true;
    rpc.mockImplementationOnce(async () => {
      current = false;
      return { data: { id: row.id, caption: 'New' }, error: null };
    });
    await expect(saveReelDescription({ ...actor, isCurrent: () => current }, row.id, row.title, 'New'))
      .rejects.toThrow('Your account changed');
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(apply).not.toHaveBeenCalled();
  } finally { stop(); }
});

it('accepts Beyond’s new pending revision only with the original media and visibility', async () => {
  const postId = '10000000-0000-4000-a000-000000000001';
  const profileId = '10000000-0000-4000-a000-000000000002';
  const mediaId = '10000000-0000-4000-a000-000000000003';
  const wire = { id: postId, creator_id: profileId, category: 'workout', audience: 'friends', status: 'approved',
    caption: 'Original', revision: 2, created_at: '2026-11-24T00:00:00Z', submitted_at: '2026-11-24T00:00:00Z',
    attested_at: '2026-11-24T00:00:00Z', rights_version: BEYOND_RIGHTS_VERSION, safety_version: BEYOND_SAFETY_VERSION,
    cleanup: 'not_requested', media: [{ id: mediaId, position: 0, kind: 'photo', mime: 'image/jpeg',
      path: `${profileId}/${postId}/${mediaId}.jpg`, bytes: 10, height: 3, width: 2 }] };
  const post = parseBeyondPost(wire);
  const revised = { ...wire, revision: 3, status: 'pending', caption: 'New' };
  rpc.mockResolvedValueOnce({ data: { ...revised, audience: 'everyone' }, error: null })
    .mockResolvedValueOnce({ data: revised, error: null });
  await expect(saveBeyondDescription({ ...actor, profileId }, post, 'New')).rejects.toThrow('Could not confirm');
  await expect(saveBeyondDescription({ ...actor, profileId }, post, 'New')).resolves.toMatchObject({
    id: post.id, revision: 3, status: 'pending', caption: 'New', audience: 'friends', media: post.media,
  });
  expect(rpc).toHaveBeenLastCalledWith('beyond_edit_caption', {
    expected_actor_id: profileId, post_id: postId, expected_revision: 2, new_caption: 'New',
  }, client);
});
