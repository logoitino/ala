/** LOCAL-02: exercise the real admin form and list so edits, clearing and parking cannot lose or cross-contaminate venues. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { GamesTool } from '@/components/Admin/GamesTool';
import { fetchAdminGames, fetchAdminSchools, upsertGame } from '@/lib/adminCatalog';
import type { Game } from '@/types/database';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  usePathname: () => '/admin/games', useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: mockPush, canGoBack: () => false }),
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/context/AppRuntimeContext', () => ({ useAppRuntime: () => ({ live: require('@/lib/runtime').DEFAULT_APP_RUNTIME, draft: require('@/lib/runtime').DEFAULT_APP_RUNTIME, pendingCount: 0, dirty: false }) }));
jest.mock('@/context/AdminLensContext', () => ({ useAdminLens: () => ({ lens: 'all', setLens: jest.fn() }) }));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'fixture-admin' }, isAdmin: true, previewAsRole: jest.fn() }) }));
jest.mock('@/context/SoftWallContext', () => ({ useSoftWall: () => ({ requireAuth: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/useSportConfigs', () => ({ useSportConfigs: () => ({ configs: require('@/data/sports').SPORT_CONFIG_SEEDS, configFor: require('@/data/sports').sportConfigFor }) }));
jest.mock('@/components/Admin/OperatorCheckinsPanel', () => ({ OperatorCheckinsPanel: () => null }));
jest.mock('@/lib/adminCatalog', () => ({ fetchAdminGames: jest.fn(), fetchAdminSchools: jest.fn(), upsertGame: jest.fn() }));
jest.mock('@/lib/operator', () => ({ updateGameScore: jest.fn() }));

const recorded: Game = { id: 'g1', home_team: 'Home', away_team: 'Away', home_school: 'Home School', away_school: 'Away School', home_score: 0, away_score: 0, venue: 'Tournament Gym', venue_school: 'Neutral School', venue_address: '12 Main St, Honolulu, HI', venue_notes: 'East entrance', status: 'live', quarter: 'Q1', is_active: true };
let mockGames: Game[];

beforeEach(() => {
  jest.clearAllMocks(); mockGames = [{ ...recorded }];
  jest.mocked(fetchAdminSchools).mockResolvedValue([]);
  jest.mocked(fetchAdminGames).mockImplementation(async () => mockGames);
  jest.mocked(upsertGame).mockImplementation(async (input) => { mockGames = mockGames.map((game) => game.id === input.id ? { ...game, ...input } : game); });
});

async function edit() {
  await render(<GamesTool />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Edit' }));
}

it('prefills and saves the actual venue school and address instead of the home campus', async () => {
  await edit();
  expect(screen.getByLabelText('Venue school (optional)').props.value).toBe('Neutral School');
  await fireEvent.changeText(screen.getByLabelText('Venue address'), '34 Park Rd, Honolulu, HI');
  await fireEvent.press(screen.getByRole('button', { name: 'Save match' }));
  expect(await screen.findByText(/34 Park Rd, Honolulu, HI/)).toBeTruthy();
  expect(jest.mocked(upsertGame).mock.calls[0][0]).toEqual(expect.objectContaining({ venue: 'Tournament Gym', venue_school: 'Neutral School', venue_address: '34 Park Rd, Honolulu, HI', venue_notes: 'East entrance' }));
});

it('clears the address explicitly while retaining venue and notes', async () => {
  await edit();
  await fireEvent.changeText(screen.getByLabelText('Venue address'), '');
  await fireEvent.press(screen.getByRole('button', { name: 'Save match' }));
  expect(await screen.findByText(/Address TBA/)).toBeTruthy();
  expect(jest.mocked(upsertGame).mock.calls[0][0]).toEqual(expect.objectContaining({ venue_address: '', venue: 'Tournament Gym', venue_notes: 'East entrance' }));
});

it('parking a listed game keeps its location while another draft is on the form', async () => {
  await render(<GamesTool />);
  await screen.findByRole('button', { name: 'Edit' });
  await fireEvent.changeText(screen.getByLabelText('Venue address'), 'Different draft address');
  await fireEvent.press(screen.getByRole('button', { name: 'Park' }));
  await waitFor(() => expect(upsertGame).toHaveBeenCalled());
  expect(jest.mocked(upsertGame).mock.calls[0][0]).toEqual(expect.objectContaining({ id: 'g1', venue_address: recorded.venue_address, venue_school: recorded.venue_school, venue_notes: recorded.venue_notes, is_active: false }));
  expect(screen.getByLabelText('Venue address').props.value).toBe('Different draft address');
});

it('parking a different existing game targets that row and preserves the selected edit draft', async () => {
  mockGames.push({ ...recorded, id: 'g2', home_team: 'Other home', venue_address: '56 Tournament Rd' });
  await render(<GamesTool />);
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2));
  await fireEvent.press(screen.getAllByRole('button', { name: 'Edit' })[0]);
  await fireEvent.changeText(screen.getByLabelText('Venue address'), 'Unsaved address for g1');
  await fireEvent.press(screen.getAllByRole('button', { name: 'Park' })[1]);
  await waitFor(() => expect(upsertGame).toHaveBeenCalled());
  expect(jest.mocked(upsertGame).mock.calls[0][0]).toEqual(expect.objectContaining({ id: 'g2', venue_address: '56 Tournament Rd' }));
  expect(mockGames[0]).toEqual(recorded);
  expect(screen.getByLabelText('Venue address').props.value).toBe('Unsaved address for g1');
});

it('does not send unsupported empty columns when editing a legacy game', async () => {
  const { venue_school, venue_address, venue_notes, ...legacy } = recorded;
  void venue_school; void venue_address; void venue_notes;
  mockGames = [legacy];
  await edit();
  await fireEvent.press(screen.getByRole('button', { name: 'Save match' }));
  await waitFor(() => expect(upsertGame).toHaveBeenCalled());
  expect(jest.mocked(upsertGame).mock.calls[0][0]).not.toHaveProperty('venue_address');
});

it('retains venue input after an unavailable schema save', async () => {
  jest.mocked(upsertGame).mockRejectedValue(new Error('Venue details are not switched on.'));
  await edit();
  await fireEvent.press(screen.getByRole('button', { name: 'Save match' }));
  expect(await screen.findByText(/Venue details are not switched on/)).toBeTruthy();
  expect(screen.getByLabelText('Venue address').props.value).toBe(recorded.venue_address);
});

it('locks competing writes and draft changes until the venue save completes', async () => {
  let finish!: () => void;
  jest.mocked(upsertGame).mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  await edit();
  await fireEvent.press(screen.getByRole('button', { name: 'Save match' }));
  expect(screen.getByRole('button', { name: 'Park' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
  expect(screen.getByLabelText('Venue address').props.editable).toBe(false);
  await act(async () => finish());
});
