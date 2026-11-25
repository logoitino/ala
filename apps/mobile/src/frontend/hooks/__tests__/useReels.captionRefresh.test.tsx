/** A feed read started before a caption save must not undo the confirmed editor result. */
import { act, renderHook } from '@testing-library/react-native';
import { useReels } from '@/hooks/useReels';
import { fetchReels } from '@/lib/reels';
import { saveReelDescription } from '@/lib/postCaptions';
import { untypedRpc } from '@/lib/rpc';
import type { ReelWithPlayer } from '@/types/database';

jest.mock('@/lib/reels', () => ({ fetchReels: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true }));
jest.mock('@/lib/offlineActor', () => ({
  assertCurrent: () => {},
  createOfflineActorClient: async () => ({}),
  isOfflineActorChanged: () => false,
}));
jest.mock('@/lib/rpc', () => ({ untypedRpc: jest.fn() }));

const fetch = jest.mocked(fetchReels);
const rpc = jest.mocked(untypedRpc);
const row = { id: 'reel', uploaded_by: 'author', title: 'Old caption', seki_count: 1 } as ReelWithPlayer;
const actor = { userId: 'account', profileId: 'author', isCurrent: () => true };

function deferredRows() {
  let resolve!: (rows: ReelWithPlayer[]) => void;
  const promise = new Promise<ReelWithPlayer[]>(finish => { resolve = finish; });
  return { promise, resolve };
}

beforeEach(() => { fetch.mockReset(); rpc.mockReset(); });

it('preserves the saved caption when an older refresh returns fresh reaction counts', async () => {
  fetch.mockResolvedValueOnce([row]);
  const { result } = await renderHook(() => useReels());
  const older = deferredRows();
  fetch.mockReturnValueOnce(older.promise);
  await act(async () => { void result.current.refresh(); });
  rpc.mockResolvedValueOnce({ data: { id: row.id, caption: 'New caption' }, error: null });
  await act(async () => { await saveReelDescription(actor, row.id, row.title, 'New caption'); });
  expect(result.current.reels[0].title).toBe('New caption');

  await act(async () => older.resolve([{ ...row, seki_count: 12 }]));
  expect(result.current.reels[0]).toMatchObject({ title: 'New caption', seki_count: 12 });

  fetch.mockResolvedValueOnce([{ ...row, title: 'Changed elsewhere' }]);
  await act(async () => { await result.current.refresh(); });
  expect(result.current.reels[0].title).toBe('Changed elsewhere');
});

it('ignores an older refresh after a newer refresh has removed the row', async () => {
  fetch.mockResolvedValueOnce([row]);
  const { result } = await renderHook(() => useReels());
  const older = deferredRows();
  fetch.mockReturnValueOnce(older.promise).mockResolvedValueOnce([]);
  await act(async () => { void result.current.refresh(); });
  await act(async () => { await result.current.refresh(); });
  expect(result.current.loading).toBe(false);
  await act(async () => older.resolve([row]));
  expect(result.current.reels).toEqual([]);
});

it('does not carry a confirmed caption onto a row flagged while the refresh was pending', async () => {
  fetch.mockResolvedValueOnce([row]);
  const { result } = await renderHook(() => useReels());
  const pending = deferredRows();
  fetch.mockReturnValueOnce(pending.promise);
  await act(async () => { void result.current.refresh(); });
  rpc.mockResolvedValueOnce({ data: { id: row.id, caption: 'New caption' }, error: null });
  await act(async () => { await saveReelDescription(actor, row.id, row.title, 'New caption'); });

  await act(async () => pending.resolve([{ ...row, is_flagged: true }]));
  expect(result.current.reels[0]).toMatchObject({ title: row.title, is_flagged: true });
});
