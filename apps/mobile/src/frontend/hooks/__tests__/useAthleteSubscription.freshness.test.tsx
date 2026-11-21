/** Private passes follow the active owner/athlete lifetime; cached passes cannot override server revocation. */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAthleteSubscription } from '@/hooks/useAthleteSubscription';
const mockFetch = jest.fn(), mockInsert = jest.fn();
let mockUser = 'A', mockGeneration = 0;
let mockGuard = () => true;
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: mockUser }, isSessionCurrent: mockGuard }) }));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true }));
jest.mock('@/services/OfflineQueue', () => ({ offlineQueue: { captureActor: () => {
  const userId = mockUser, generation = mockGeneration;
  return { userId, isCurrent: () => userId === mockUser && generation === mockGeneration };
} } }));
jest.mock('@/lib/offlineActor', () => ({ createOfflineActorClient: async () => ({}), assertCurrent: (actor: {isCurrent: () => boolean}) => { if (!actor.isCurrent()) throw new Error('Account changed'); } }));
jest.mock('@/lib/subscriptions', () => ({ isPlayerUuid: () => true, fetchActiveSubscription: (...args: unknown[]) => mockFetch(...args), insertSubscription: (...args: unknown[]) => mockInsert(...args) }));
function switchTo(id: string) { mockUser = id; mockGeneration++; }
beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear(); mockUser = 'A'; mockGeneration = 0; mockGuard = () => true; mockFetch.mockResolvedValue({ active: false, failed: false }); mockInsert.mockResolvedValue({ ok: true }); });
it('masks a delayed old-account pass read even when the same account returns', async () => {
  let release!: (value: unknown) => void;
  mockFetch.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const { result, rerender } = await renderHook(() => useAthleteSubscription('athlete'));
  switchTo('B'); await rerender({});
  switchTo('A'); await rerender({});
  await act(async () => release({ active: true, failed: false }));
  expect(result.current.subscribed).toBe(false);
});
it('uses a successful revoked pass read over the cached unlock', async () => {
  await AsyncStorage.setItem('tapuai.exclusiveSub.A.athlete', '1');
  const { result } = await renderHook(() => useAthleteSubscription('athlete'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.subscribed).toBe(false);
  expect(await AsyncStorage.getItem('tapuai.exclusiveSub.A.athlete')).toBeNull();
});
it('never publishes a paid grant whose account changes during insert', async () => {
  let release!: (value: unknown) => void;
  mockInsert.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
  const { result, rerender } = await renderHook(() => useAthleteSubscription('athlete'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  const payment = { actor: { userId: 'A', isCurrent: () => mockUser === 'A' && mockGeneration === 0 }, client: {} as never };
  let outcome!: Promise<unknown>;
  await act(async () => { outcome = result.current.grant(payment).catch((error: unknown) => error); });
  switchTo('B'); await rerender({});
  await act(async () => { release({ ok: true }); await outcome; });
  expect(result.current.subscribed).toBe(false);
  expect(await AsyncStorage.getItem('tapuai.exclusiveSub.B.athlete')).toBeNull();
});

it('masks an already-loaded pass when A→B→A changes the Auth lifetime in one render', async () => {
  mockFetch.mockResolvedValueOnce({ active: true, failed: false });
  const { result, rerender } = await renderHook(() => useAthleteSubscription('athlete'));
  await waitFor(() => expect(result.current.subscribed).toBe(true));
  let release!: (value: unknown) => void;
  mockFetch.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  mockGeneration += 2; mockGuard = () => true;
  await rerender({});
  expect(result.current.subscribed).toBe(false);
  await act(async () => release({ active: false, failed: false }));
});
