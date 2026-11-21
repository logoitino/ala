/** Runtime editor operations respect the order the admin requested, including delayed saves. */
import { act, renderHook } from '@testing-library/react-native';
import { AppRuntimeProvider, useAppRuntime } from '../AppRuntimeContext';
import { cloneAppRuntime, DEFAULT_APP_RUNTIME, type AppRuntimeBundle, type AppRuntimeConfig } from '@/lib/runtime';

let mockConfigured = false;
let mockActorLive = true;
let mockActorId: string | null = 'admin-A';
const mockBind = jest.fn<Promise<object>, unknown[]>(async () => ({}));
const mockChannel = { on: () => mockChannel, subscribe: () => mockChannel };
const mockRead = jest.fn();
const mockSave = jest.fn();
const mockPublish = jest.fn();
jest.mock('@/lib/runtime', () => ({ ...jest.requireActual('@/lib/runtime'),
  fetchAppRuntimeBundle: () => mockRead(), saveAppRuntimeDraft: (next: AppRuntimeConfig) => mockSave(next),
  publishAppRuntime: () => mockPublish(),
}));
jest.mock('@/lib/supabase', () => ({ get isSupabaseConfigured() { return mockConfigured; }, supabase: { channel: () => mockChannel, removeChannel: jest.fn() }, nextRealtimeTopic: () => 'test' }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: () => mockActorId ? { userId: mockActorId, isCurrent: () => mockActorLive } : null } }));
jest.mock('@/lib/offlineActor', () => ({ ...jest.requireActual('@/lib/offlineActor'), createOfflineActorClient: (...args: unknown[]) => mockBind(...args) }));
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function config(label: string) { const value = cloneAppRuntime(DEFAULT_APP_RUNTIME); value.copy.homeLede = label; return value; }
function bundle(draft: string, published: string): AppRuntimeBundle { return { draft: config(draft), published: config(published), publishedAt: null, updatedAt: null }; }
beforeEach(() => { jest.resetAllMocks(); mockConfigured = false; mockActorLive = true; mockActorId = 'admin-A'; mockBind.mockResolvedValue({}); mockRead.mockResolvedValue(bundle('live', 'live')); });
async function mount() { return renderHook(() => useAppRuntime(), { wrapper: AppRuntimeProvider }); }

it('publishes the completed requested draft when the save is delayed', async () => {
  const write = deferred<AppRuntimeBundle>(); const calls: string[] = []; let serverDraft = 'live';
  mockSave.mockImplementation(async (next: AppRuntimeConfig) => { calls.push('save'); const result = await write.promise; serverDraft = next.copy.homeLede; return result; });
  mockPublish.mockImplementation(async () => { calls.push('publish'); return bundle(serverDraft, serverDraft); });
  const hook = await mount(); let saving!: Promise<void>; let publishing!: Promise<void>;
  await act(async () => { saving = hook.result.current.saveDraft(config('B')); publishing = hook.result.current.publishLive(); });
  expect(calls).toEqual(['save']);
  await act(async () => { write.resolve(bundle('B', 'live')); await saving; await publishing; });
  expect(hook.result.current.live.copy.homeLede).toBe('B');
  expect(hook.result.current.dirty).toBe(false);
});

it('keeps a newer optimistic draft visible while an older save completes', async () => {
  const first = deferred<AppRuntimeBundle>(); const second = deferred<AppRuntimeBundle>();
  mockSave.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const hook = await mount(); let savingA!: Promise<void>; let savingB!: Promise<void>;
  await act(async () => { savingA = hook.result.current.saveDraft(config('A')); });
  await act(async () => { savingB = hook.result.current.saveDraft(config('B')); });
  await act(async () => first.resolve(bundle('A', 'live')));
  expect(hook.result.current.draft.copy.homeLede).toBe('B');
  await act(async () => { second.resolve(bundle('B', 'live')); await savingA; await savingB; });
  expect(hook.result.current.draft.copy.homeLede).toBe('B');
});

it('discards after a queued publish using its newly published state', async () => {
  const publish = deferred<AppRuntimeBundle>(); const calls: string[] = [];
  mockPublish.mockImplementation(async () => { calls.push('publish'); return publish.promise; });
  mockSave.mockImplementation(async (next: AppRuntimeConfig) => { calls.push(next.copy.homeLede); return bundle(next.copy.homeLede, 'B'); });
  const hook = await mount(); let publishing!: Promise<void>; let discarding!: Promise<void>;
  await act(async () => { publishing = hook.result.current.publishLive(); discarding = hook.result.current.discardDraft(); });
  expect(calls).toEqual(['publish']);
  await act(async () => { publish.resolve(bundle('B', 'B')); await publishing; await discarding; });
  expect(calls).toEqual(['publish', 'B']);
  expect(hook.result.current.draft.copy.homeLede).toBe('B');
});

it('does not publish an older server draft after the requested save failed', async () => {
  mockSave.mockRejectedValueOnce(new Error('Save unavailable'));
  mockPublish.mockResolvedValue(bundle('live', 'live'));
  const hook = await mount(); let saving!: Promise<unknown>; let publishing!: Promise<unknown>;
  await act(async () => { saving = hook.result.current.saveDraft(config('B')).catch((e) => e); publishing = hook.result.current.publishLive().catch((e) => e); });
  expect(await saving).toBeInstanceOf(Error);
  expect(await publishing).toBeInstanceOf(Error);
  expect(mockPublish).not.toHaveBeenCalled();
  expect(hook.result.current.draft.copy.homeLede).toBe('B');
});

it('refuses a configured hosted write when no actor was captured at request time', async () => {
  mockConfigured = true; mockActorId = null;
  const hook = await mount();
  await act(async () => { await expect(hook.result.current.saveDraft(config('B'))).rejects.toThrow(); });
  expect(mockSave).not.toHaveBeenCalled(); expect(mockBind).not.toHaveBeenCalled();
  expect(hook.result.current.draft.copy.homeLede).toBe('live');
});
it('refuses a queued publication after its actor leaves during an earlier save', async () => {
  mockConfigured = true; const write = deferred<AppRuntimeBundle>(); mockSave.mockReturnValueOnce(write.promise);
  const hook = await mount(); let saving!: Promise<unknown>; let publishing!: Promise<unknown>;
  await act(async () => { saving = hook.result.current.saveDraft(config('A')).catch((e) => e); publishing = hook.result.current.publishLive().catch((e) => e); });
  mockActorLive = false;
  await act(async () => { write.resolve(bundle('A', 'A')); await saving; await publishing; });
  expect(await publishing).toBeInstanceOf(Error); expect(mockPublish).not.toHaveBeenCalled();
  expect(hook.result.current.live.copy.homeLede).toBe('live');
});
it('keeps a new actor draft when the outgoing save completes last', async () => {
  mockConfigured = true; const old = deferred<AppRuntimeBundle>(); const newer = deferred<AppRuntimeBundle>();
  mockSave.mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise);
  const hook = await mount(); let a!: Promise<unknown>; let b!: Promise<unknown>;
  await act(async () => { a = hook.result.current.saveDraft(config('A')).catch((e) => e); });
  mockActorLive = false;
  await act(async () => old.resolve(bundle('A', 'A')));
  mockActorLive = true; mockActorId = 'admin-B';
  await act(async () => { b = hook.result.current.saveDraft(config('B')); });
  expect(hook.result.current.live.copy.homeLede).toBe('live');
  await act(async () => { newer.resolve(bundle('B', 'live')); await a; await b; });
  expect(hook.result.current.draft.copy.homeLede).toBe('B');
});
