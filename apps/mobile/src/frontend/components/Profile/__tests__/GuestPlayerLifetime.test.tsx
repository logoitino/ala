/** Deferred guest player reads and retained actions must stay on the route subject that initiated them. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import PlayerProfileScreen from '../../../../../app/(guest)/player/[id]';
import type { Player } from '@/data/players';
let mockId = 'A';
const mockFetch = jest.fn(), mockHydrate = jest.fn(), mockBump = jest.fn(), mockRequireAuth = jest.fn();
let mockBumpCallback: (kind: 'seki') => void;
let mockBackedCallback: (count: number) => void;
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: mockId }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: mockRequireAuth }) }));
jest.mock('@/components/UI/HapticPressable', () => ({ HapticPressable: require('react-native').Pressable }));
jest.mock('@/components/ScreenShell', () => ({ ScreenShell: require('react-native').View }));
jest.mock('@/components/Profile/FanBackerBadge', () => ({ FanBackerBadge: ({ player }: { player: Player }) => { const { Text } = require('react-native'); return <Text>{`backers:${player.backer_count}`}</Text>; } }));
jest.mock('@/components/Profile/HypeBoard', () => ({ HypeBoard: ({ onBump, hype }: { onBump: typeof mockBumpCallback; hype: { seki_count: number } }) => {
  const { Text } = require('react-native'); mockBumpCallback = onBump; return <Text>{`seki:${hype.seki_count}`}</Text>;
} }));
jest.mock('@/components/TipCheckout', () => ({ TipCheckout: ({ onBacked, player }: { onBacked: typeof mockBackedCallback; player: Player }) => {
  const { Text } = require('react-native'); mockBackedCallback = onBacked; return <Text>{`checkout:${player.id}`}</Text>;
} }));
jest.mock('@/lib/roster', () => ({ fetchGuestPlayer: (...args: unknown[]) => mockFetch(...args) }));
jest.mock('@/lib/hype', () => ({
  hydratePlayerHype: (...args: unknown[]) => mockHydrate(...args), bumpPlayerHype: (...args: unknown[]) => mockBump(...args),
  hypeFromPlayer: (player: Player) => ({ view_count: 0, aura_count: 0, flex_count: 0, seki_count: player.seki_count ?? 0 }),
}));
function player(id: string): Player { return { id, name: `Player ${id}`, jersey_number: 1, position: '', height: '', school_name: '', backer_count: 0, seki_count: 0 }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  jest.clearAllMocks(); mockId = 'A'; mockFetch.mockReset().mockImplementation(async (id: string) => ({ player: player(id), error: null }));
  mockHydrate.mockReset().mockImplementation(async (value: Player) => value);
  mockBump.mockReset().mockResolvedValue({ seki_count: 9, aura_count: 0, flex_count: 0, view_count: 0 });
});
it('keeps B loading when an old A read fails late', async () => {
  const a = deferred<unknown>(), b = deferred<unknown>(); mockFetch.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const view = await render(<PlayerProfileScreen />); mockId = 'B'; await view.rerender(<PlayerProfileScreen />);
  await act(async () => a.resolve({ player: null, error: 'Old failure' }));
  expect(screen.getByText('Loading player…')).toBeTruthy(); expect(screen.queryByText('Old failure')).toBeNull();
  await act(async () => b.resolve({ player: player('B'), error: null })); expect(screen.getByText('Player B')).toBeTruthy();
});
it('discards A hydration that completes after B is loaded', async () => {
  const a = deferred<Player>(); mockHydrate.mockReturnValueOnce(a.promise);
  const view = await render(<PlayerProfileScreen />); await waitFor(() => expect(mockHydrate).toHaveBeenCalled());
  mockId = 'B'; await view.rerender(<PlayerProfileScreen />); await waitFor(() => expect(screen.getByText('Player B')).toBeTruthy());
  await act(async () => a.resolve(player('A')));
  expect(screen.getByText('Player B')).toBeTruthy(); expect(screen.queryByText('Player A')).toBeNull();
});
it('refuses a retained hype action from the preceding route', async () => {
  const view = await render(<PlayerProfileScreen />); await waitFor(() => expect(screen.getByText('Player A')).toBeTruthy());
  const old = mockBumpCallback; mockId = 'B'; await view.rerender(<PlayerProfileScreen />); await waitFor(() => expect(screen.getByText('Player B')).toBeTruthy());
  await act(async () => old('seki')); expect(mockBump).not.toHaveBeenCalled();
});
it('does not merge an issued A hype completion into B', async () => {
  const pending = deferred<unknown>(); mockBump.mockReturnValueOnce(pending.promise);
  const view = await render(<PlayerProfileScreen />); await waitFor(() => expect(screen.getByText('Player A')).toBeTruthy());
  await act(async () => mockBumpCallback('seki')); mockId = 'B'; await view.rerender(<PlayerProfileScreen />); await waitFor(() => expect(screen.getByText('Player B')).toBeTruthy());
  await act(async () => pending.resolve({ seki_count: 9, aura_count: 0, flex_count: 0, view_count: 0 }));
  expect(screen.getByText('seki:0')).toBeTruthy();
});
it('refuses a delayed Soft-Wall resume for another route subject', async () => {
  const view = await render(<PlayerProfileScreen />); await waitFor(() => expect(screen.getByText('Player A')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: /Player A/ }));
  const resume = mockRequireAuth.mock.calls[0][0].resume;
  mockId = 'B'; await view.rerender(<PlayerProfileScreen />); await waitFor(() => expect(screen.getByText('Player B')).toBeTruthy());
  await act(async () => resume()); expect(screen.queryByText('checkout:B')).toBeNull();
});
it('resets checkout on route change and rejects old backed callbacks', async () => {
  const view = await render(<PlayerProfileScreen />); await waitFor(() => expect(screen.getByText('Player A')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: /Player A/ })); await act(async () => mockRequireAuth.mock.calls[0][0].resume());
  const old = mockBackedCallback; mockId = 'B'; await view.rerender(<PlayerProfileScreen />); await waitFor(() => expect(screen.getByText('Player B')).toBeTruthy());
  expect(screen.queryByText('checkout:B')).toBeNull(); await act(async () => old(99)); expect(screen.getByText('backers:0')).toBeTruthy();
});
